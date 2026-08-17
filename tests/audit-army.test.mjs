// tests/audit-army.test.mjs —— 审计军单测（任务生成 + 体检关口径 + 结果落盘）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'

test('审计任务生成：每仓库 × 4 体检关', async () => {
  const { auditTasks } = await import('../audit-army.mjs')
  const tasks = auditTasks(['dsh-megamesh', 'dsh-mesh'])
  assert.equal(tasks.length, 8)
  assert.deepEqual(tasks[0], { repo: 'dsh-megamesh', check: 'words' })
  const checks = new Set(tasks.map(t => t.check))
  assert.deepEqual([...checks].sort(), ['ci', 'drift', 'version', 'words'])
})

test('审计侦察兵：四关实现 + 词检口径（发布树跳过 shared/lab）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'audit-scout.mjs'), 'utf-8')
  assert.ok(src.includes("['node_modules', '.git', 'lab', 'dist', 'vendor', 'shared']"), '词检应跳过运行时账本目录')
  assert.ok(src.includes('checkWords'))
  assert.ok(src.includes('checkCi'))
  assert.ok(src.includes('checkDrift'))
  assert.ok(src.includes('checkVersion'))
})

test('审计侦察兵：npm scoped 包名映射（dsh-story/schedule-core 查 scoped）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'audit-scout.mjs'), 'utf-8')
  assert.ok(src.includes("'dsh-story': '@wang--lin--chang/dsh-story'"), 'dsh-story 应映射 scoped 包名')
  assert.ok(src.includes("'schedule-core': '@wang--lin--chang/schedule-core'"), 'schedule-core 应映射 scoped 包名')
})

test('审计侦察兵：平台后端库无 npm 包 = 设计事实（不误报）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'audit-scout.mjs'), 'utf-8')
  assert.ok(src.includes("'dsh-cross-platform'"), 'cross-platform 应在无 npm 白名单')
  assert.ok(src.includes("'dsh-macos'"), 'macos 应在无 npm 白名单')
})

test('审计军结果落盘取证（last-audit-run.json）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'audit-army.mjs'), 'utf-8')
  assert.ok(src.includes('last-audit-run.json'), '结果应落盘 shared/consensus/last-audit-run.json')
})

test('审计军 import 零副作用（isMain 守卫，auditTasks 可导入）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'audit-army.mjs'), 'utf-8')
  assert.ok(src.includes('isMain'), '应有 isMain 守卫')
  assert.ok(src.includes('export function auditTasks'), 'auditTasks 应可导出')
})
