// tests/crosscheck.test.mjs —— 多方质证判定器单测（E28 核心逻辑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proposeChair, crosscheckConsistency, crosscheckOutlier, courtVote, reviewCourt } from '../crosscheck-brain.mjs'

const normal = [1, 2, 3, 4, 5].map(n => ({ taskId: n, keyNumbers: { severity: 20 + n * 8 }, summary: `威胁度 ${20 + n * 8}`, request: '常规记录' }))

test('chair 提议 = 取最优（现状逻辑保留为提议方）', () => {
  const p = proposeChair(normal)
  assert.equal(p.taskId, 5)
  assert.equal(p.severity, 60)
})

test('自洽质证：summary 与 severity 一致 → 信', () => {
  const r = { taskId: 1, keyNumbers: { severity: 60 }, summary: '威胁度 60' }
  assert.equal(crosscheckConsistency(r).trust, true)
})

test('自洽质证：summary 数字与 severity 矛盾 → 不信', () => {
  const r = { taskId: 1, keyNumbers: { severity: 999 }, summary: '威胁度只有 30' }
  const v = crosscheckConsistency(r)
  assert.equal(v.trust, false)
  assert.match(v.reason, /30/)
})

test('离群质证：正常样本内的 severity → 信', () => {
  const r = { taskId: 5, keyNumbers: { severity: 60 } }
  assert.equal(crosscheckOutlier(r, normal).trust, true)
})

test('离群质证：极端 severity（假阳性）→ 不信', () => {
  const r = { taskId: 6, keyNumbers: { severity: 999 }, summary: '威胁度 999' }
  const all = [...normal, r]
  const v = crosscheckOutlier(r, all)
  assert.equal(v.trust, false)
  assert.match(v.reason, /σ/)
})

test('courtVote：正常集全票放行', () => {
  const c = courtVote(normal)
  assert.equal(c.status, 'unanimous')
  assert.equal(c.agree, 3)
})

test('courtVote：自洽假阳性 + 高风险 → contested-high-risk（不放行）', () => {
  const poisoned = [...normal, { taskId: 6, keyNumbers: { severity: 999 }, summary: '威胁度 999', request: '紧急增援' }]
  const c = courtVote(poisoned)
  assert.equal(c.status, 'contested-high-risk')
  assert.equal(c.proposal.severity, 999)
  assert.equal(c.agree, 2)
})

test('courtVote：矛盾假阳性 → vetoed', () => {
  const poisoned = [...normal, { taskId: 7, keyNumbers: { severity: 999 }, summary: '威胁度只有 30', request: '常规记录' }]
  const c = courtVote(poisoned)
  assert.equal(c.status, 'vetoed')
  assert.equal(c.agree, 1)
})

test('courtVote：真阳性 severity=88 低于阈值 → 全票放行（不误杀）', () => {
  const real = [...normal, { taskId: 8, keyNumbers: { severity: 88 }, summary: '威胁度 88', request: '建议增援' }]
  const c = courtVote(real)
  assert.equal(c.status, 'unanimous')
})

test('部署域战报（无 keyNumbers）不破坏质证', () => {
  const deploy = [{ taskId: 1, evidence: '词检 0 命中' }, { taskId: 2, evidence: '测试 exit 0' }]
  const c = courtVote(deploy)
  assert.equal(c.status, 'unanimous')
})

test('离群质证：样本同值（MAD=0）时不误拦（交复核轮）', () => {
  const uniform = [1, 2, 3, 4, 5].map(n => ({ taskId: n, keyNumbers: { severity: 1 }, summary: '通过' }))
  const odd = { taskId: 6, keyNumbers: { severity: 90 }, summary: '失败' }
  const v = crosscheckOutlier(odd, [...uniform, odd])
  assert.equal(v.trust, true, '全体一致时统计无基线，不得靠离群误拦')
  assert.match(v.reason, /review/)
})

test('复核轮：正常集首轮放行不触发复核', () => {
  const r = reviewCourt(normal, normal)
  assert.equal(r.final, 'release')
  assert.equal(r.round, 1)
})

test('复核轮：噪声首轮否决 → 复核翻转放行', () => {
  const noisy = [...normal, { taskId: 99, keyNumbers: { severity: 999 }, summary: '威胁度 999', request: '紧急增援' }]
  const r = reviewCourt(noisy, normal)
  assert.equal(r.final, 'flipped-release')
})

test('复核轮：稳定假阳性两轮否决 → 两次一致定案', () => {
  const p1 = [...normal, { taskId: 99, keyNumbers: { severity: 999 }, summary: '威胁度 999', request: '紧急增援' }]
  const p2 = [...normal, { taskId: 98, keyNumbers: { severity: 995 }, summary: '威胁度 995', request: '紧急增援' }]
  const r = reviewCourt(p1, p2)
  assert.ok(r.final.startsWith('confirmed-'), r.final)
})
