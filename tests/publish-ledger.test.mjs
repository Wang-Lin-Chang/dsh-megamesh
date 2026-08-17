// tests/publish-ledger.test.mjs —— 发布账本单测（append-only + 资格判据核心断言）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PublishLedger } from '../publish-ledger.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const seed = (n, accidentAt = null) => {
  const ledger = new PublishLedger(fs.mkdtempSync(path.join(os.tmpdir(), 'pltest-')))
  for (let i = 0; i < n; i++) {
    ledger.record({ version: `v${i}`, checks: { words: 0, tests: 0, preflight: 0 }, outcome: accidentAt === i ? 'accident' : 'success' })
  }
  return ledger
}

test('append-only 账本：记录与回读一致', () => {
  const ledger = seed(3)
  assert.equal(ledger.history().length, 3)
  assert.equal(ledger.history()[2].version, 'v2')
})

test('样本不足 → 未达标（nMin 门槛）', () => {
  const ledger = seed(10)
  const e = ledger.eligibility({ nMin: 20, epsilon: 0.01 })
  assert.equal(e.eligible, false)
  assert.match(e.reason, /样本不足/)
})

test('零流程违规且样本足 → 资格达标；不可预见事故不扣资格', () => {
  const ledger = seed(20, 10)   // 第 10 条是不可预见事故（checks 全绿但 outcome accident）
  const e = ledger.eligibility({ nMin: 20, epsilon: 0.01 })
  assert.equal(e.violations, 0)
  assert.equal(e.accidents, 1)
  assert.equal(e.eligible, true)
})

test('流程违规（预检红却发布）→ 计入违规率 → 资格可能撤销', () => {
  const ledger = new PublishLedger(fs.mkdtempSync(path.join(os.tmpdir(), 'pltest-')))
  for (let i = 0; i < 20; i++) {
    ledger.record(i === 5
      ? { version: `v${i}`, checks: { words: 1, tests: 0, preflight: 0 }, outcome: 'accident' }   // 词检红却发布 = 流程违规
      : { version: `v${i}`, checks: { words: 0, tests: 0, preflight: 0 }, outcome: 'success' })
  }
  const e = ledger.eligibility({ nMin: 20, epsilon: 0.01 })
  assert.equal(e.violations, 1)
  assert.ok(e.wilson > 0)
})
