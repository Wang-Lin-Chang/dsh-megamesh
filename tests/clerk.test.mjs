// tests/clerk.test.mjs —— 文书官单测（渲染/解析/双区校验/批注过军法）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, parse, verify, applyAnnotations } from '../clerk-worker.mjs'

const good = {
  agentId: 's1', taskId: '57', summary: '蜀中发现盐路被断，威胁度100',
  keyNumbers: { severity: 100, task: 57 },
  stateChanges: [{ field: 'threat', target: '蜀中', delta: 100, note: '盐路被断' }],
  request: '建议增援',
}

test('渲染后机器解析全过（两区一致）', () => {
  const md = render(good)
  const v = verify(md)
  assert.equal(v.ok, true, v.errors.join(';'))
  const p = parse(md)
  assert.equal(p.json.summary, good.summary)
  assert.equal(p.json.keyNumbers.severity, 100)
})

test('篡改 Markdown 区 → 两区矛盾拒收', () => {
  const md = render(good).replace('威胁度100', '威胁度99')
  const v = verify(md)
  assert.ok(v.errors.some(e => e.includes('两区矛盾')))
})

test('篡改 JSON 区 → 军法 + 两区双抓', () => {
  const md = render(good).replace('"severity": 100', '"severity": 250')
  const v = verify(md)
  assert.ok(v.errors.some(e => e.includes('RANGE_SEVERITY')))
  assert.ok(v.errors.some(e => e.includes('两区矛盾')))
})

test('批注过军法才生效：违军法驳回，合法应用两区同步', () => {
  const md = render(good)
  const r1 = applyAnnotations(md + '\n> 【批注】{"request":"常规记录"}\n')
  assert.equal(r1.rejected.length, 1)   // severity 100 改常规记录 → 军法驳回
  assert.equal(r1.report.request, '建议增援')
  const r2 = applyAnnotations(md + '\n> 【批注】{"note":"已确认断点：青城渡口"}\n')
  assert.equal(r2.applied.length, 1)
  assert.equal(r2.report.note, '已确认断点：青城渡口')
  assert.equal(verify(r2.md).ok, true)
})
