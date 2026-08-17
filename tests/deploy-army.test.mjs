// tests/deploy-army.test.mjs —— 部署军单测（联邦脑 schema 兼容回归 + 部署侦察兵检查关逻辑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'

// 联邦脑 schema 兼容回归：无 keyNumbers 的部署域战报不能崩脑（历史 bug：undefined.severity 抛错被吞 → 主循环死亡）
test('联邦脑 processReports 对无 keyNumbers 战报不崩（schema 兼容）', async () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'federal-brain.mjs'), 'utf-8')
  assert.ok(src.includes('r.keyNumbers?.severity ?? -1'), '联邦脑应有 severity 可选链兼容')
  assert.ok(src.includes('best.summary ?? best.evidence ?? \'\''), 'verdict summary 应有降级提取')
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
