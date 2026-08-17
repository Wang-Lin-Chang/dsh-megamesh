// dsh-megamesh/penalty-scheduler.mjs —— 并行惩罚感知调度器（E26 产物，E29 起生产服役）
// α 从账本 penalty-collect.json 拟合（数据定参，非拍脑袋）；选 N 时 makespan 带惩罚项缩放
// 纯函数可导入；回归军/审计军 --auto 模式共用
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXPERIMENTS, partition } from './regression-army.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// 从采集账本拟合全局 α（每装置膨胀率 α_i 的中位数；脏数据防护：α_i 为负或非有限值剔除）
export function fitAlpha(collect) {
  const alphas = []
  const rows = (n) => (collect[n]?.rows ?? [])
  const t1 = Object.fromEntries(rows(1).map(r => [r.exp, r.elapsedMs]))
  const tMax = Object.fromEntries(rows(Math.max(...Object.keys(collect).map(Number))).map(r => [r.exp, r.elapsedMs]))
  const N = Math.max(...Object.keys(collect).map(Number))
  for (const exp of Object.keys(t1)) {
    const a = tMax[exp] !== undefined && t1[exp] > 0 ? (tMax[exp] - t1[exp]) / (t1[exp] * (N - 1)) : NaN
    if (Number.isFinite(a) && a >= 0 && a <= 1) alphas.push(a)   // α > 1 = 数据污染（每兵翻倍以上不合理），剔除
  }
  alphas.sort((x, y) => x - y)
  return alphas.length > 0 ? alphas[Math.floor(alphas.length / 2)] : 0
}

// 惩罚感知 makespan 重演：每装置耗时按 (1 + α(N-1)) 缩放后贪心分片
export function penalizedMakespan(experiments, times, alpha, N) {
  const scaled = {}
  for (const [f, v] of Object.entries(times)) scaled[f] = v * (1 + alpha * (N - 1))
  return Math.max(...partition(experiments, N, scaled).map(b => b.reduce((s, e) => s + (scaled[e] ?? 1), 0)))
}

// 调度：扫参 N∈[1..maxN]，取惩罚感知 makespan 最小的 N（平局取最少兵）
export function pickN(experiments, times, alpha, maxN = 8) {
  let best = null
  for (let N = 1; N <= Math.min(maxN, experiments.length); N++) {
    const mk = penalizedMakespan(experiments, times, alpha, N)
    if (best === null || mk < best.mk - 0.5) best = { N, mk }
  }
  return best ?? { N: 1, mk: 0 }
}

// 生产入口：读账本 → 拟合 α → 定 N（账本缺失时降级 α=0 → 等价纯 makespan，诚实记录降级）
export function scheduleN(times, collectPath = path.join(HERE, 'shared', 'consensus', 'penalty-collect.json'), { maxN = 8 } = {}) {
  let alpha = 0
  let degraded = false
  if (fs.existsSync(collectPath)) {
    const collect = JSON.parse(fs.readFileSync(collectPath, 'utf-8'))
    const keys = Object.keys(collect).map(Number).filter(n => n > 0)
    if (keys.length >= 2) alpha = fitAlpha(collect)
    else degraded = true
  } else degraded = true
  const { N, mk } = pickN(EXPERIMENTS, times, alpha, maxN)
  return { N, makespanMs: mk, alpha, degraded, source: degraded ? 'degraded(no ledger)' : 'penalty-collect.json' }
}
