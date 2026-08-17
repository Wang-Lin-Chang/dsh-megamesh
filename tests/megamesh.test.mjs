// tests/megamesh.test.mjs —— 统一入口冒烟单测（战场/军法/任期/冷引用/终态审计）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MegaMesh } from '../megamesh.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const setup = () => new MegaMesh(fs.mkdtempSync(path.join(os.tmpdir(), 'mmtest-')), { leaseMs: 2500, heartbeatMs: 600 })

test('任务生命周期：enqueue/claim/finish + EXIT:0', () => {
  const mm = setup()
  mm.enqueue(1, { n: 1 })
  assert.equal(mm.lifecycle(1), 'pending')
  assert.ok(mm.claim(1, 'w', process.pid, Math.floor(Date.now() / 1000)))
  assert.equal(mm.lifecycle(1), 'running')
  mm.finish(1, JSON.stringify({ ok: true }))
  assert.equal(mm.lifecycle(1), 'done')
  assert.equal(mm.exitCode(1), 0)
  mm.release(1)
})

test('军法 + 战报读取', () => {
  const mm = setup()
  mm.enqueue(7, { n: 7 })
  const r = { agentId: 's', taskId: '7', summary: '北境发现魔教探子，威胁度50', keyNumbers: { severity: 50, task: 7 }, stateChanges: [], request: '常规记录' }
  fs.writeFileSync(path.join(mm.root, 'shared', 'reports', 'report-7.json'), JSON.stringify(r))
  assert.equal(mm.reports().length, 1)
  assert.deepEqual(mm.lawCourt(r), [])
  assert.deepEqual(mm.lawCourt({ ...r, keyNumbers: { severity: 250, task: 7 } }), ['RANGE_SEVERITY', 'REQUEST_CONSISTENT'])
})

test('全文冷引用：归档→本地取回 + 主宇宙回源 + 未归档 null', () => {
  const main = setup()
  const d = main.archiveFullText('1', '全文内容')
  assert.equal(main.lookupFullText(d), '全文内容')
  const altRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mmalt-'))
  const alt = new MegaMesh(altRoot, { primaryFulltext: path.join(main.root, 'shared', 'fulltext') })
  assert.equal(alt.lookupFullText(d), '全文内容')   // 本地无 → 主宇宙回源
  assert.equal(alt.lookupFullText('0'.repeat(64)), null)
})

test('终态审计：成对/因果/军法/锁残留全查', () => {
  const mm = setup()
  mm.enqueue(5, { n: 5 })
  mm.claim(5, 'w', process.pid, Math.floor(Date.now() / 1000))
  mm.finish(5, JSON.stringify({ ok: true }))
  mm.release(5)
  fs.writeFileSync(path.join(mm.root, 'shared', 'reports', 'report-5.json'), JSON.stringify({ agentId: 's', taskId: '5', summary: '北境发现魔教探子，威胁度36', keyNumbers: { severity: 36, task: 5 }, stateChanges: [], request: '常规记录' }))
  const a = mm.auditBattlefield()
  assert.equal(a.doneUnpaired.length, 0)
  assert.equal(a.orphans.length, 0)
  assert.equal(Object.keys(a.lawViolations).length, 0)
  assert.equal(a.staleLocks.length, 0)
})

test('任期锁解析 + 决策文书', () => {
  const mm = setup()
  fs.writeFileSync(path.join(mm.root, 'shared', 'consensus', 'term.lock'), 'brain-alpha:1:1700000000:2')
  assert.equal(mm.term().term, 2)
  fs.writeFileSync(path.join(mm.root, 'shared', 'consensus', 'decrees', 'decree-2.json'), JSON.stringify({ term: 2, chair: 'brain-alpha', verdict: { taskId: 57 } }))
  assert.equal(mm.decree(2).verdict.taskId, 57)
  assert.deepEqual(mm.decrees(), ['decree-2'])
})
