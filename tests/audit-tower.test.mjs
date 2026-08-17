// tests/audit-tower.test.mjs —— 审计塔 φ 衰减模型单测（E39 核心逻辑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PHI, INVERSE_PHI, PHI_DETECTION, makeRng, auditLayer, auditTower, towerStatistics } from '../audit-tower.mjs'

test('φ 常数与等价条件（解析边界）', () => {
  assert.ok(Math.abs(PHI - 1.618034) < 1e-4)
  assert.ok(Math.abs(INVERSE_PHI - 0.618034) < 1e-4)
  assert.ok(Math.abs(PHI_DETECTION - 0.382) < 1e-3, 'φ 衰减 ⟺ p=1/φ²≈0.382')
  assert.ok(Math.abs((1 - PHI_DETECTION) - INVERSE_PHI) < 1e-4, '1-p=1/φ')
})

test('确定性 RNG：同种子同序列（D6 可复现）', () => {
  const a = makeRng(42)
  const b = makeRng(42)
  assert.equal(a(), b())
  assert.equal(a(), b())
})

test('auditLayer：检出率 p 的统计语义（大样本逼近）', () => {
  const defects = Array.from({ length: 1000 }, (_, i) => `D${i}`)
  const rng = makeRng(7)
  const { detected, missed } = auditLayer(defects, 0.7, rng)
  assert.equal(detected.length + missed.length, 1000)
  assert.ok(Math.abs(detected.length / 1000 - 0.7) < 0.05, `检出 ${detected.length}/1000 应逼近 0.7`)
})

test('auditTower：残余率同分母口径 r_n=(1-p)^n', () => {
  const defects = Array.from({ length: 10000 }, (_, i) => `D${i}`)
  const t = auditTower(defects, 0.7, makeRng(3))
  const [r1, r2, r3] = t.residuals
  assert.ok(Math.abs(r1 - 0.3) < 0.02, `r1=${r1} 应≈0.3`)
  assert.ok(Math.abs(r2 - 0.09) < 0.02, `r2=${r2} 应≈0.09（(1-p)²）`)
  assert.ok(Math.abs(r3 - 0.027) < 0.01, `r3=${r3} 应≈0.027`)
  assert.ok(Math.abs(t.ratios[0] - 0.3) < 0.05, '衰减比 ≈ 1-p')
})

test('towerStatistics：φ 特例 p=0.382 衰减比 ≈ 1/φ', () => {
  const defects = Array.from({ length: 10000 }, (_, i) => `D${i}`)
  const seeds = Array.from({ length: 10 }, (_, i) => 100 + i)
  const s = towerStatistics(defects, PHI_DETECTION, seeds)
  assert.ok(Math.abs(s.meanRatio - INVERSE_PHI) < 0.08, `实测 ${s.meanRatio.toFixed(3)} 应≈1/φ ${INVERSE_PHI.toFixed(3)}`)
  assert.equal(s.analytical, 1 - PHI_DETECTION)
})

test('towerStatistics：p=0.9 时衰减比 ≈ 0.1 ≠ 1/φ（φ 是特例）', () => {
  const defects = Array.from({ length: 10000 }, (_, i) => `D${i}`)
  const seeds = Array.from({ length: 10 }, (_, i) => 200 + i)
  const s = towerStatistics(defects, 0.9, seeds)
  assert.ok(Math.abs(s.meanRatio - 0.1) < 0.05, `实测 ${s.meanRatio.toFixed(3)} 应≈0.1`)
  assert.ok(Math.abs(s.meanRatio - INVERSE_PHI) > 0.2)
})
