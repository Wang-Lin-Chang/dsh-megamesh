// tests/penalty-scheduler.test.mjs —— α 调度器直接单测（D7 覆盖债）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitAlpha, penalizedMakespan, pickN } from '../penalty-scheduler.mjs'

const collect = {
  1: { rows: [{ exp: 'a', elapsedMs: 100 }, { exp: 'b', elapsedMs: 200 }, { exp: 'c', elapsedMs: 300 }] },
  8: { rows: [{ exp: 'a', elapsedMs: 110 }, { exp: 'b', elapsedMs: 240 }, { exp: 'c', elapsedMs: 400 }] },
}
const times = { a: 100, b: 200, c: 300 }
const exps = ['a', 'b', 'c']

test('fitAlpha：中位数拟合 + 脏数据剔除（负值/超界）', () => {
  // a: (110-100)/(100*7)=0.014, b: (240-200)/(200*7)=0.029, c: (400-300)/(300*7)=0.048 → 中位 0.029
  const alpha = fitAlpha(collect)
  assert.ok(Math.abs(alpha - 0.029) < 0.001, `alpha=${alpha}`)
  const dirty = {
    1: { rows: [{ exp: 'a', elapsedMs: 100 }, { exp: 'b', elapsedMs: 200 }] },
    8: { rows: [{ exp: 'a', elapsedMs: 50 }, { exp: 'b', elapsedMs: 9999 }] },   // 负膨胀 + 超界膨胀
  }
  const a2 = fitAlpha(dirty)
  assert.equal(a2, 0, '脏数据应全部剔除 → α=0')
})

test('fitAlpha：缺数据 → α=0（诚实降级）', () => {
  assert.equal(fitAlpha({}), 0)
  assert.equal(fitAlpha({ 1: { rows: [] } }), 0)
})

test('penalizedMakespan：惩罚项缩放（α=0 时退化纯 makespan）', () => {
  // α=0：单桶全装 = 600
  assert.equal(penalizedMakespan(exps, times, 0, 1), 600)
  // α=1，N=2：每装置 ×2，贪心分 2 桶 → 600×2/2=600 近似
  const v = penalizedMakespan(exps, times, 1, 2)
  assert.ok(v >= 600, `v=${v}`)
})

test('pickN：扫参取最小（平局取最少兵）', () => {
  // α=0：N=2 与 N=3 平局（300/300）→ 平局取最少兵 2
  const r = pickN(exps, times, 0, 3)
  assert.equal(r.N, 2)
  const r2 = pickN(exps, times, 0, 8)
  assert.equal(r2.N, 2, 'maxN 不应超过装置数，平局取最少')
})

test('pickN：惩罚项让大 N 变贵（E26 核心语义）', () => {
  // α 大时：并行惩罚压过并行收益 → 小 N 更优
  const r = pickN(exps, times, 2, 3)
  assert.equal(r.N, 1, 'α=2 时全并行代价过高，应选 1 兵')
})
