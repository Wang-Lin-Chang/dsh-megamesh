// tests/publish-deploy.test.mjs —— 发布部署单单测（判据扫描 + 最优挑选）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PublishLedger } from '../publish-ledger.mjs'
import { scanCriteria, pickCriteria } from '../publish-deploy.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const seed = (n, accidentAt = null) => {
  const ledger = new PublishLedger(fs.mkdtempSync(path.join(os.tmpdir(), 'pdtest-')))
  for (let i = 0; i < n; i++) {
    ledger.record({ version: `v${i}`, checks: { words: 0, tests: 0, preflight: 0 }, outcome: accidentAt === i ? 'accident' : 'success' })
  }
  return ledger
}

test('scanCriteria：零违规历史 → 所有组合稳定达标，首达位置由 nMin 决定', () => {
  const ledger = seed(25)
  const scan = scanCriteria(ledger)
  assert.ok(scan.length === 20)
  for (const s of scan) {
    assert.equal(s.stable, true)
    assert.equal(s.firstAt, s.nMin)   // 零违规：第 nMin 条即达标
  }
})

test('pickCriteria：最早稳定达标 = 最小 nMin', () => {
  const scan = scanCriteria(seed(25))
  const picked = pickCriteria(scan)
  assert.equal(picked.best.nMin, 5)
  assert.equal(picked.best.firstAt, 5)
})

test('scanCriteria：违规记录破坏早期窗口的稳定性', () => {
  const ledger = new PublishLedger(fs.mkdtempSync(path.join(os.tmpdir(), 'pdtest-')))
  for (let i = 0; i < 25; i++) {
    ledger.record(i === 3
      ? { version: `v${i}`, checks: { words: 1, tests: 0, preflight: 0 }, outcome: 'accident' }   // 词检红却发布
      : { version: `v${i}`, checks: { words: 0, tests: 0, preflight: 0 }, outcome: 'success' })
  }
  const scan = scanCriteria(ledger)
  // 含违规的窗口：小 epsilon 组合首达更晚（Wilson 下限>ε 时不达标）
  const s = scan.find(x => x.nMin === 5 && x.epsilon === 0.001)
  assert.ok(s.firstAt > 5)
})
