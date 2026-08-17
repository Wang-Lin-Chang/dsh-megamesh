// tests/strategy-governor.test.mjs —— 策略执政官单测（影子把关/转正/回退/成本判据）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { StrategyGovernor } from '../strategy-governor.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const FALLBACK = { kind: 'gap', delta: 2 }
const CHALLENGER = { kind: 'topk', k: 10 }

test('影子期：20 次零误判观察 → 转正上岗', () => {
  const gov = new StrategyGovernor(fs.mkdtempSync(path.join(os.tmpdir(), 'gtest-')), FALLBACK)
  assert.equal(gov.status().current, FALLBACK)
  for (let i = 0; i < 20; i++) gov.observe(CHALLENGER, true)
  assert.equal(gov.status().current, CHALLENGER)
  assert.equal(gov.status().promotes, 1)
})

test('转正后误判 → 降级回退 fallback + 影子清零', () => {
  const gov = new StrategyGovernor(fs.mkdtempSync(path.join(os.tmpdir(), 'gtest-')), FALLBACK)
  for (let i = 0; i < 20; i++) gov.observe(CHALLENGER, true)
  assert.equal(gov.status().current, CHALLENGER)
  gov.demote(CHALLENGER)
  assert.equal(gov.status().current, FALLBACK)
  assert.equal(gov.status().demotes, 1)
  assert.equal(gov.court.status('CHALLENGER'), 'shadow')
  assert.equal(gov.court.state.rules.CHALLENGER.observations, 0)   // 清零重考
})

test('v2 成本判据：成本劣于现任 → 永不转正', () => {
  const gov = new StrategyGovernor(fs.mkdtempSync(path.join(os.tmpdir(), 'gtest-')), FALLBACK)
  for (let i = 0; i < 30; i++) gov.observe(CHALLENGER, true, { cost: 10, fallbackCost: 2 })
  assert.equal(gov.status().current, FALLBACK)
  assert.equal(gov.court.status('CHALLENGER'), 'shadow')
})

test('v2 成本判据：成本不劣于现任且零误判 → 正常转正', () => {
  const gov = new StrategyGovernor(fs.mkdtempSync(path.join(os.tmpdir(), 'gtest-')), FALLBACK)
  for (let i = 0; i < 20; i++) gov.observe(CHALLENGER, true, { cost: 2, fallbackCost: 2 })
  assert.equal(gov.status().current, CHALLENGER)
})
