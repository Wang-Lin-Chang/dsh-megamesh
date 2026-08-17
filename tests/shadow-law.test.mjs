// tests/shadow-law.test.mjs —— 影子法庭单测（Wilson 数学 + promote/demote 核心断言）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ShadowCourt, wilsonLower } from '../shadow-law.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

test('wilsonLower：零误杀时下限为 0，误杀越多下限越高', () => {
  assert.equal(wilsonLower(0, 20), 0)
  assert.ok(wilsonLower(1, 20) > 0)
  assert.ok(wilsonLower(5, 20) > wilsonLower(1, 20))
})

test('影子观察只记录不生效，样本足且零误杀时转正', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sltest-'))
  const court = new ShadowCourt(root)
  for (let i = 0; i < 25; i++) court.observe('R', true, true)   // 25 次全真伪造
  assert.equal(court.status('R'), 'shadow')
  assert.equal(court.considerPromotion('R', { nMin: 20, epsilon: 0.01 }), true)
  assert.equal(court.status('R'), 'promoted')
})

test('样本不足不转正（nMin 门槛）', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sltest-'))
  const court = new ShadowCourt(root)
  for (let i = 0; i < 19; i++) court.observe('R', true, true)
  assert.equal(court.considerPromotion('R', { nMin: 20, epsilon: 0.01 }), false)
})

test('误杀混入则永不转正（安全阀）', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sltest-'))
  const court = new ShadowCourt(root)
  for (let i = 0; i < 30; i++) court.observe('R', true, i % 10 === 0)   // 每 10 个混 1 个误杀
  assert.equal(court.considerPromotion('R', { nMin: 20, epsilon: 0.01 }), false)
  assert.equal(court.status('R'), 'shadow')
})

test('转正后误杀申诉 → 降级回影子并清零', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sltest-'))
  const court = new ShadowCourt(root)
  for (let i = 0; i < 25; i++) court.observe('R', true, true)
  court.considerPromotion('R', { nMin: 20, epsilon: 0.01 })
  assert.equal(court.status('R'), 'promoted')
  court.observe('R', true, false)   // 申诉：真报被误杀
  assert.equal(court.status('R'), 'shadow')
  assert.equal(court.state.rules.R.observations, 0)   // 清零重考
  assert.equal(court.state.demoted.length, 1)
})
