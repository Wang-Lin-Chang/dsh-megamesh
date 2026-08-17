// tests/deploy-army.test.mjs —— 部署军单测（联邦脑 schema 兼容回归 + 部署侦察兵检查关逻辑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'

// 联邦脑 schema 兼容回归：无 keyNumbers 的部署域战报不能崩脑（历史 bug：undefined.severity 抛错被吞 → 主循环死亡）
// 0.13 起联邦脑升级多方质证（courtVote：chair 提议 + 自洽/离群双质证）——部署域无 keyNumbers 时质证跳过矛盾/离群，全票放行
test('联邦脑 processReports 对无 keyNumbers 战报不崩（schema 兼容）', async () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'federal-brain.mjs'), 'utf-8')
  const cc = fs.readFileSync(path.join(process.cwd(), 'crosscheck-brain.mjs'), 'utf-8')
  assert.ok(src.includes('courtVote'), '联邦脑应使用多方质证 courtVote')
  assert.ok(cc.includes('keyNumbers?.severity'), '质证提议应有 severity 可选链兼容')
  assert.ok(cc.includes('summary ?? best.evidence'), 'verdict summary 应有降级提取')
})

test('部署军部署单字段完整（checks/decree/advice）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'deploy-army.mjs'), 'utf-8')
  assert.ok(src.includes('checks:'))
  assert.ok(src.includes('decree:'))
  assert.ok(src.includes('advice:'))
  assert.ok(src.includes('allPassed'))
})

test('部署侦察兵三关定义完整（words/tests/preflight）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'deploy-scout.mjs'), 'utf-8')
  assert.ok(src.includes("check === 'words'"))
  assert.ok(src.includes("check === 'tests'"))
  assert.ok(src.includes('preflight-experiment.mjs'))
})
