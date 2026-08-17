// tests/war-law.test.mjs —— 军法解释器 + 统一规则源单测（node --test）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { violations } from '../war-law-engine.mjs'
import { DEFAULT_RULES, courtMartial } from '../war-law.mjs'

const good = { agentId: 's1', taskId: '7', summary: '北境发现魔教探子，威胁度50', keyNumbers: { severity: 50, task: 7 }, stateChanges: [], request: '常规记录' }

test('真报零违规', () => {
  assert.deepEqual(violations(DEFAULT_RULES, good), [])
  assert.deepEqual(courtMartial(good), [])
})

test('severity 越界被抓', () => {
  const r = { ...good, keyNumbers: { severity: 250, task: 7 } }
  assert.deepEqual(violations(DEFAULT_RULES, r).sort(), ['RANGE_SEVERITY', 'REQUEST_CONSISTENT'].sort())
})

test('request 与 severity 矛盾被抓', () => {
  const r = { ...good, keyNumbers: { severity: 90, task: 7 }, request: '常规记录' }
  assert.deepEqual(violations(DEFAULT_RULES, r), ['REQUEST_CONSISTENT'])
})

test('taskId 与 keyNumbers.task 不符被抓', () => {
  const r = { ...good, keyNumbers: { severity: 50, task: 999 } }
  assert.deepEqual(violations(DEFAULT_RULES, r), ['TASK_MATCH'])
})

test('summary 超百字被抓', () => {
  const r = { ...good, summary: '越界威胁' + '。'.repeat(120) }
  assert.deepEqual(violations(DEFAULT_RULES, r), ['SUMMARY_BOUND'])
})

test('courtMartial 与 violations 零分歧（双表示统一）', () => {
  const inputs = [
    good,
    { ...good, keyNumbers: { severity: 250, task: 7 } },
    { ...good, request: '建议增援' },
    { ...good, summary: '发现魔教探子，威胁度50' },
  ]
  for (const r of inputs) {
    const a = courtMartial(r).map(v => v.id).sort()
    const b = violations(DEFAULT_RULES, r).sort()
    assert.deepEqual(a, b)
  }
})
