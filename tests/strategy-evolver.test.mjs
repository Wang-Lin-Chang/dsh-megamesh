// tests/strategy-evolver.test.mjs —— 策略进化器单测（变异/进化主循环/纪律/可复现）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evolve, mutate } from '../strategy-evolver.mjs'

const REGIONS = ['北境', '江南', '蜀中', '东海', '西域']
const REINFORCED = ['北境', '蜀中', '江南']
const reports = Array.from({ length: 60 }, (_, i) => ({ taskId: String(i + 1), keyNumbers: { severity: 1 + ((i + 1) * 7) % 100, task: i + 1 } }))
const truth = { regionOf: (id) => REGIONS[Number(id) % 5], answer: '14' }
const seeds = [{ kind: 'gap', delta: 50 }, { kind: 'gap', delta: 0.5 }, { kind: 'topk', k: 1 }, { kind: 'topk', k: 20 }, { kind: 'gap', delta: 7 }, { kind: 'topk', k: 4 }, { kind: 'gap', delta: 3 }, { kind: 'topk', k: 8 }]

test('变异：参数扰动且保型（gap 变 gap 或翻 topk）', () => {
  let s = 7
  const rng = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let i = 0; i < 20; i++) {
    const m = mutate({ kind: 'gap', delta: 5 }, rng)
    assert.ok(m.kind === 'gap' || m.kind === 'topk')
    if (m.kind === 'gap') assert.ok(m.delta >= 0.5)
    else assert.ok(m.k >= 1 && m.k <= 20)
  }
})

test('进化：冠军正确且成本收敛到最优带', () => {
  const r = evolve({ seeds, trainReports: reports, truth, reinforced: REINFORCED, generations: 10, population: 8, stopAfter: 3 })
  assert.ok(r.champion !== null)
  assert.equal(r.champion.cost, 2)   // 最优带 = 展开 2 × 往返 1
  assert.ok(r.champion.kind === 'gap' || r.champion.kind === 'topk')
})

test('纪律：真值被篡改时进化全灭，不产出冠军', () => {
  const r = evolve({ seeds, trainReports: reports, truth: { ...truth, answer: '999' }, reinforced: REINFORCED, generations: 3, population: 8, stopAfter: 3 })
  assert.equal(r.champion, null)
  assert.ok(r.history.some(h => h.note && h.note.includes('全灭')))
})

test('可复现：同种子两次进化逐代账本一致', () => {
  const a = evolve({ seeds, trainReports: reports, truth, reinforced: REINFORCED, generations: 10, population: 8, stopAfter: 3 })
  const b = evolve({ seeds, trainReports: reports, truth, reinforced: REINFORCED, generations: 10, population: 8, stopAfter: 3 })
  assert.deepEqual(a.history, b.history)
  assert.deepEqual(a.champion, b.champion)
})
