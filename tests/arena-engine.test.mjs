// tests/arena-engine.test.mjs —— 推理竞技场引擎单测（E40 核心逻辑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { witnessClaim, structuralAudit, arenaVerdict, parallelUniverse, judgeRegistry, costLedger } from '../arena-engine.mjs'

test('证词带立场与信用（claimId 确定性）', () => {
  const c1 = witnessClaim({ modelId: 'm1', credit: 10, premiseIds: ['ROOT'], claim: 'X', support: 'Y' })
  const c2 = witnessClaim({ modelId: 'm1', credit: 10, premiseIds: ['ROOT'], claim: 'X', support: 'Y' })
  assert.equal(c1.claimId, c2.claimId, '同内容同 ID（幂等）')
  assert.equal(c1.modelId, 'm1')
  assert.equal(c1.credit, 10)
})

test('军法结构审：假前提引用被抓', () => {
  const c = witnessClaim({ modelId: 'm', credit: 10, premiseIds: ['c-ghost'], claim: 'X', support: 'Y' })
  const vio = structuralAudit([c])
  assert.ok(vio.some(v => v.code === 'DANGLING_REF'))
})

test('军法结构审：互引循环被抓', () => {
  const c3 = witnessClaim({ modelId: 'm3', credit: 10, premiseIds: ['c-temp'], claim: 'C', support: 'x' })
  const c4 = witnessClaim({ modelId: 'm4', credit: 10, premiseIds: [c3.claimId], claim: 'D', support: 'x' })
  const c3f = { ...c3, premiseIds: [c4.claimId] }
  const vio = structuralAudit([c3f, c4])
  assert.ok(vio.some(v => v.code === 'CYCLE'), JSON.stringify(vio))
})

test('军法结构审：合法 DAG 零违规', () => {
  const a = witnessClaim({ modelId: 'm', credit: 10, premiseIds: ['ROOT'], claim: 'A', support: 'x' })
  const b = witnessClaim({ modelId: 'm', credit: 10, premiseIds: [a.claimId], claim: 'B', support: 'x' })
  assert.equal(structuralAudit([a, b]).length, 0)
})

test('擂台：正常证词 winner（三票）', () => {
  const claims = [witnessClaim({ modelId: 'a', credit: 10, premiseIds: ['ROOT'], claim: 'X', support: '充分' })]
  const v = arenaVerdict(claims)
  assert.equal(v.status, 'winner')
  assert.equal(v.agree, 3)
})

test('擂台：自洽矛盾 → contested（非 LLM 防线）', () => {
  const claims = [
    witnessClaim({ modelId: 'a', credit: 10, premiseIds: ['ROOT'], claim: 'X', support: '充分' }),
    witnessClaim({ modelId: 'b', credit: 12, premiseIds: ['ROOT'], claim: '威胁度只有 30', support: '实测 999' }),
  ]
  const v = arenaVerdict(claims)
  assert.equal(v.status, 'contested')
  assert.equal(v.votes.consistency, false)
})

test('裁判治理：两次误判降级清零（快照语义）', () => {
  const jr = judgeRegistry()
  jr.promote('j', { credit: 20 })
  jr.verdictMistake('j')
  const after1 = jr.get('j')
  assert.equal(after1.credit, 20, '一次误判不清零')
  jr.verdictMistake('j')
  const after2 = jr.get('j')
  assert.equal(after2.credit, 0, '两次误判清零')
  assert.equal(after2.promotions, 0)
  assert.equal(after2.term, 2)
})

test('裁判快照：get 返回副本（修改副本不影响注册表）', () => {
  const jr = judgeRegistry()
  jr.promote('j', { credit: 5 })
  const snap = jr.get('j')
  snap.credit = 999
  assert.equal(jr.get('j').credit, 5, '快照修改不得回流注册表')
})

test('成本计量累加', () => {
  const cl = costLedger()
  cl.add(3)
  cl.add(2)
  assert.equal(cl.total(), 5)
})

test('平行宇宙：被否结论休眠 + 新证据复活', () => {
  const c = witnessClaim({ modelId: 'e', credit: 5, premiseIds: ['ROOT'], claim: 'H', support: '不足' })
  const pu = parallelUniverse({ rejected: [c] })
  assert.equal(pu.branches[0].status, 'dormant')
  const pu2 = parallelUniverse({ rejected: [c], revived: [c.claimId] })
  assert.ok(pu2.revived.includes(c.claimId))
})
