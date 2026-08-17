// tests/regression-army.test.mjs —— 回归军单测（装置清单递归防护 + 分片确定性 + 账本落盘）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'

// 驱动器会再调回归军：入列装置清单即无限递归（装置事实）
test('驱动器不入装置清单（递归防护）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'regression-army.mjs'), 'utf-8')
  assert.ok(src.includes("'regression-army-experiment.mjs'"), 'EXPERIMENTS 应排除 E25 驱动器')
  assert.ok(src.includes("'parallel-penalty-experiment.mjs'"), 'EXPERIMENTS 应排除 E26 驱动器')
  assert.ok(src.includes("'audit-army-experiment.mjs'"), 'EXPERIMENTS 应排除 E27 驱动器')
  assert.ok(src.includes("'scheduler-command-experiment.mjs'"), 'EXPERIMENTS 应排除 E29 驱动器')
  assert.ok(src.includes("'dual-army-deploy-experiment.mjs'"), 'EXPERIMENTS 应排除 E30 驱动器')
  assert.ok(src.includes("'timeout-penalty-experiment.mjs'"), 'EXPERIMENTS 应排除 E31 驱动器')
  assert.ok(src.includes("'alpha-drift-experiment.mjs'"), 'EXPERIMENTS 应排除 E33 驱动器')
  assert.ok(src.includes("'dialogue-narrative-experiment.mjs'"), 'EXPERIMENTS 应排除 E35 跨仓库实验（CI 无外部仓库）')
  assert.ok(src.includes('!f.startsWith(\'ref-\')'), 'EXPERIMENTS 应排除 ref 夹具')
})

test('分片贪心确定性（同输入同输出，最长优先）', async () => {
  const { partition } = await import('../regression-army.mjs')
  const exps = ['a', 'b', 'c', 'd', 'e']
  const times = { a: 100, b: 80, c: 60, d: 40, e: 20 }
  const r1 = partition(exps, 2, times)
  const r2 = partition(exps, 2, times)
  assert.deepEqual(r1, r2, '同输入必须同输出')
  assert.equal(r1.length, 2)
  const flat = r1.flat().sort()
  assert.deepEqual(flat, exps.slice().sort(), '所有实验恰好分入一兵')
})

test('未知耗时实验以 1ms 占位不崩', async () => {
  const { partition } = await import('../regression-army.mjs')
  const r = partition(['x', 'y', 'z'], 3, {})
  assert.equal(r.length, 3, '无历史账本时每兵一实验')
})

test('回归结果落盘取证（无 pipe 环境可读）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'regression-army.mjs'), 'utf-8')
  assert.ok(src.includes('last-regression-run.json'), '结果应落盘 shared/consensus/last-regression-run.json')
})

test('侦察兵单装置超时防护 + 失败重试一次（并行资源竞争装置事实）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'regression-scout.mjs'), 'utf-8')
  assert.ok(src.includes('timeout: 420000'), '单装置应有超时上限')
  assert.ok(src.includes('log(`retry ${exp}'), '非零退出应重试一次并记日志')})
