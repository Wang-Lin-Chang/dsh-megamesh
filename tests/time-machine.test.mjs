// tests/time-machine.test.mjs —— 时间战场核心单测（快照对账/瞬态排除/diff/restore/merge）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TimeMachine } from '../time-machine.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const setup = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tmtest-'))
  for (const d of ['intent-queue', 'done', 'shared/reports', 'shared/expand-resps', 'shared/consensus']) fs.mkdirSync(path.join(root, d), { recursive: true })
  return root
}

test('checkpoint/audit：干净账本快照零带伤', async () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'done', 'task-1.json'), JSON.stringify({ id: 1 }))
  fs.writeFileSync(path.join(root, 'done', 'task-1.result.json'), JSON.stringify({ ok: true }))
  fs.writeFileSync(path.join(root, 'shared', 'reports', 'report-1.json'), JSON.stringify({ taskId: '1' }))
  const tm = new TimeMachine(root)
  await tm.checkpoint('t1')
  const a = tm.audit('t1')
  assert.equal(a.corrupt.length, 0)
  assert.equal(a.orphans.length, 0)
  assert.equal(a.unpaired.length, 0)
  assert.equal(a.dups.length, 0)
})

test('成对撕裂检测：done 任务缺 result 被抓', async () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'done', 'task-2.json'), JSON.stringify({ id: 2 }))   // 无 result
  const tm = new TimeMachine(root)
  await tm.checkpoint('t2')
  const a = tm.audit('t2')
  assert.deepEqual(a.unpaired, ['2'])
})

test('瞬态协议区不入快照（跨宇宙状态泄漏防护）', async () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'shared', 'expand-resps', 'resp-7-region.json'), JSON.stringify({ taskId: '7', region: '北境', digestOk: true }))
  const tm = new TimeMachine(root)
  await tm.checkpoint('t3')
  assert.equal(fs.existsSync(path.join(root, 'timeline', 't3', 'shared', 'expand-resps')), false)
})

test('语义 diff 与 naive mtime diff 对照（元数据噪音假阳性）', async () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'done', 'task-3.json'), '{"x":1}')
  const tm = new TimeMachine(root)
  await tm.checkpoint('a')
  await tm.checkpoint('b')
  const now = new Date()
  fs.utimesSync(path.join(root, 'timeline', 'b', 'done', 'task-3.json'), now, now)
  assert.ok(tm.naiveDiff('a', 'b').changed > 0)   // mtime 噪音 → 假变更
  const d = tm.diff('a', 'b')
  assert.equal(d.changed, 0)
  assert.equal(d.added, 0)
})

test('restore + 在途任务清点 + 锁不复制', async () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'intent-queue', 'task-9.json'), JSON.stringify({ id: 9 }))
  fs.writeFileSync(path.join(root, 'intent-queue', 'task-9.lock'), 'scout-0:123:999')
  const tm = new TimeMachine(root)
  await tm.checkpoint('mid')
  const newRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tmrestore-'))
  const r = tm.restore('mid', newRoot)
  assert.deepEqual(r.inFlight, ['9'])
  assert.equal(fs.existsSync(path.join(newRoot, 'intent-queue', 'task-9.lock')), false)   // 锁不复制
  assert.equal(fs.existsSync(path.join(newRoot, 'intent-queue', 'task-9.json')), true)
})

test('三向 merge：分歧留双档，朴素覆盖静默丢数据', async () => {
  const root = setup()
  const tm = new TimeMachine(root)
  fs.writeFileSync(path.join(root, 'shared', 'reports', 'report-1.json'), JSON.stringify({ severity: 10 }))
  await tm.checkpoint('base')
  fs.writeFileSync(path.join(root, 'shared', 'reports', 'report-1.json'), JSON.stringify({ severity: 55 }))
  await tm.checkpoint('branch-a')
  const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'tmbranch-'))
  tm.restore('base', rootB)
  fs.writeFileSync(path.join(rootB, 'shared', 'reports', 'report-1.json'), JSON.stringify({ severity: 88 }))
  const tmB = new TimeMachine(rootB)
  await tmB.checkpoint('branch-b')
  const naiveDir = path.join(root, 'shared', 'reports-naive')
  tm.mergeReports(path.join(root, 'timeline', 'base'), path.join(root, 'timeline', 'branch-a'), path.join(rootB, 'timeline', 'branch-b'), naiveDir, { naive: true })
  assert.equal(JSON.parse(fs.readFileSync(path.join(naiveDir, 'report-1.json'), 'utf-8')).severity, 88)   // a 版被静默覆盖
  const threeDir = path.join(root, 'shared', 'reports-3way')
  const r = tm.mergeReports(path.join(root, 'timeline', 'base'), path.join(root, 'timeline', 'branch-a'), path.join(rootB, 'timeline', 'branch-b'), threeDir)
  assert.deepEqual(r.conflicts, ['report-1.json'])
  assert.ok(fs.existsSync(path.join(root, 'shared', 'conflicts', 'report-1.json.a.json')))
  assert.ok(fs.existsSync(path.join(root, 'shared', 'conflicts', 'report-1.json.b.json')))
})
