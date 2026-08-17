// tests/lifecycle.test.mjs —— witness 五态推导 + EXIT 协议单测
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveState, recordExit, exitCode, readLock } from '../lifecycle.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const setup = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lftest-'))
  for (const d of ['intent-queue', 'done', 'shared/dead-letter']) fs.mkdirSync(path.join(root, d), { recursive: true })
  return root
}

test('pending → running → done（EXIT:0）', () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'intent-queue', 'task-1.json'), '{}')
  assert.equal(deriveState(root, '1'), 'pending')
  fs.writeFileSync(path.join(root, 'intent-queue', 'task-1.lock'), `w:${process.pid}:${Math.floor(Date.now() / 1000)}`)
  assert.equal(deriveState(root, '1'), 'running')
  fs.renameSync(path.join(root, 'intent-queue', 'task-1.json'), path.join(root, 'done', 'task-1.json'))
  fs.writeFileSync(path.join(root, 'done', 'task-1.result.json'), '{}')
  assert.equal(deriveState(root, '1'), 'done-no-exit')   // 无 EXIT = 非正常结束形态
  recordExit(root, '1', 0)
  assert.equal(deriveState(root, '1'), 'done')
  assert.equal(exitCode(root, '1'), 0)
})

test('orphaned → adopted：死持有者锁残留', () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'intent-queue', 'task-2.json'), '{}')
  fs.writeFileSync(path.join(root, 'intent-queue', 'task-2.lock'), `ghost:999999:${Math.floor(Date.now() / 1000)}`)   // 不存在的 pid
  assert.equal(deriveState(root, '2'), 'orphaned')
  fs.writeFileSync(path.join(root, 'shared', 'dead-letter', 'task-2.json'), '{}')
  fs.unlinkSync(path.join(root, 'intent-queue', 'task-2.lock'))
  assert.equal(deriveState(root, '2'), 'adopted')
})

test('readLock 协议格式（agentId:pid:startSec）', () => {
  const root = setup()
  fs.writeFileSync(path.join(root, 'intent-queue', 'task-3.lock'), 'scout-3:4242:1700000000')
  assert.equal(readLock(root, '3'), 'scout-3:4242:1700000000')
})
