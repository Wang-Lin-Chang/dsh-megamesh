// tests/auto-publish.test.mjs —— 自治发布判据单测（决策器影子转正 + 事故降级核心断言）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PublishJudge, auditChange } from '../auto-publish.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const KNOWN = [{ id: 'BAD', test: (t) => t.includes('bad-word') }]
const THREATS = [...KNOWN, { id: 'NEW', test: (t) => t.includes('alien-pattern') }]

test('已知危险 → hold，安全 → publish', () => {
  const judge = new PublishJudge(fs.mkdtempSync(path.join(os.tmpdir(), 'aptest-')), KNOWN)
  assert.equal(judge.judge({ text: 'feat: bad-word here' }).action, 'hold')
  assert.equal(judge.judge({ text: 'fix: normal' }).action, 'publish')
})

test('影子期建议不执行，样本足且零误判才转正；转正后自动执行', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aptest-'))
  const judge = new PublishJudge(root, KNOWN)
  for (let i = 0; i < 20; i++) {
    const r = judge.round({ text: `fix: #${i}` }, [])
    assert.equal(r.executed, false)   // 影子期零执行
  }
  assert.equal(judge.court.status('PUBLISH_JUDGE'), 'promoted')   // 20 次零误判 → 转正
  for (let i = 20; i < 25; i++) {
    const r = judge.round({ text: `fix: #${i}` }, [])
    assert.equal(r.executed, true)   // 转正后自动执行
  }
})

test('转正后自动执行；新威胁误判 → 事故 → 降级清零', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aptest-'))
  const judge = new PublishJudge(root, KNOWN)
  for (let i = 0; i < 25; i++) judge.round({ text: `fix: #${i}` }, [])
  assert.equal(judge.court.status('PUBLISH_JUDGE'), 'promoted')
  const r = judge.round({ text: 'fix: normal' }, [])
  assert.equal(r.executed, true)   // 转正后自动执行
  // 新威胁：决策器不认识 → 建议发布 → 审计出事故 → 降级
  const bad = judge.round({ text: 'feat: alien-pattern injected' }, ['NEW'])
  assert.equal(bad.executed, true)
  assert.equal(bad.accident, true)
  assert.equal(judge.court.status('PUBLISH_JUDGE'), 'shadow')
  assert.equal(judge.court.state.rules.PUBLISH_JUDGE.observations, 0)   // 清零重考
})

test('auditChange 事后审计：ground truth 由装置提供', () => {
  assert.deepEqual(auditChange({ text: 'feat: bad-word' }, THREATS), ['BAD'])
  assert.deepEqual(auditChange({ text: 'feat: alien-pattern' }, THREATS), ['NEW'])
  assert.deepEqual(auditChange({ text: 'fix: ok' }, THREATS), [])
})
