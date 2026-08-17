// tests/strategy-selector.test.mjs —— 平行宇宙策略竞标单测（策略池/Pareto 选择/决策正确性）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STRATEGY_POOL, decide, selectBest } from '../strategy-selector.mjs'

const REGIONS = ['北境', '江南', '蜀中', '东海', '西域']
const REINFORCED = ['北境', '蜀中', '江南']
const reports = Array.from({ length: 60 }, (_, i) => ({ taskId: String(i + 1), keyNumbers: { severity: 1 + ((i + 1) * 7) % 100, task: i + 1 } }))
const truth = {
  regionOf: (id) => REGIONS[Number(id) % 5],
  answer: '14',
}

test('策略池：10 个候选，gap/topk 两类', () => {
  assert.equal(STRATEGY_POOL.length, 10)
  assert.ok(STRATEGY_POOL.some(s => s.kind === 'gap'))
  assert.ok(STRATEGY_POOL.some(s => s.kind === 'topk'))
})

test('候选决策：在训练批上全部正确（真值 14）', () => {
  for (const s of STRATEGY_POOL) {
    const m = decide(s, reports, REINFORCED, truth)
    assert.equal(m.correct, true, `${s.id} 应正确`)
    assert.equal(m.answer.taskId, '14')
  }
})

test('Pareto 选择：100% 正确候选里选最低成本', () => {
  const metrics = STRATEGY_POOL.map(s => ({ id: s.id, ...decide(s, reports, REINFORCED, truth) }))
  const sel = selectBest(metrics)
  assert.ok(sel.winner !== null)
  const cost = sel.winner.expands * sel.winner.roundtrips
  for (const m of metrics) {
    assert.ok(cost <= m.expands * m.roundtrips, `胜者成本应不高于 ${m.id}`)
  }
})

test('无正确候选时 selectBest 明确报空（不硬选）', () => {
  const sel = selectBest([{ id: 'a', correct: false, expands: 1, roundtrips: 1 }, { id: 'b', correct: false, expands: 2, roundtrips: 1 }])
  assert.equal(sel.winner, null)
  assert.match(sel.note, /策略池该扩容/)
})
