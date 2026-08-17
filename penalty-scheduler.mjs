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
// 风险项（E31）：超时率账本存在时，riskAware(N) = penalizedMakespan × (1 + γ·r(N))——γ 由最坏档实测锚定
// α 账本策略（E33）：alpha-policy.json 落盘——strategy=indeterminate（样本不足）时不冒充定论，
// 生产上取最近一轮实测 α（最接近当前负载），历史供将来判别策略用
export function scheduleN(times, collectPath = path.join(HERE, 'shared', 'consensus', 'penalty-collect.json'), { maxN = 8, timeoutPath = null } = {}) {
  let alpha = 0
  let degraded = false
  if (fs.existsSync(collectPath)) {
    const collect = JSON.parse(fs.readFileSync(collectPath, 'utf-8'))
    const keys = Object.keys(collect).map(Number).filter(n => n > 0)
    if (keys.length >= 2) alpha = fitAlpha(collect)
    else degraded = true
  } else degraded = true
  // 账本策略（E33）：历史账本存在时，α 取最近一轮实测（策略判别样本不足时以最近实测为准——不冻结、不冒充）
  const historyPathResolved = path.join(HERE, 'shared', 'consensus', 'penalty-history.jsonl')
  let alphaSource = degraded ? 'degraded' : 'penalty-collect.json'
  let policyNote = null
  if (fs.existsSync(historyPathResolved)) {
    try {
      const lines = fs.readFileSync(historyPathResolved, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
      if (lines.length > 0) {
        alpha = lines[lines.length - 1].alpha   // 最近一轮实测
        alphaSource = `penalty-history.jsonl(round ${lines[lines.length - 1].round})`
        const policyPath = path.join(HERE, 'shared', 'consensus', 'alpha-policy.json')
        if (fs.existsSync(policyPath)) {
          const pol = JSON.parse(fs.readFileSync(policyPath, 'utf-8'))
          policyNote = pol.note ?? null
        }
      }
    } catch (e) { /* 协议豁免：账本解析失败回退快照 α（上方已赋值）——不是债，是降级语义 */ }
  }
  // 超时风险账本（E31）：timeout-collect.json，超时率 r(N) + γ
  let gamma = 0
  const timeoutPathResolved = timeoutPath ?? path.join(HERE, 'shared', 'consensus', 'timeout-collect.json')
  const rates = []
  if (fs.existsSync(timeoutPathResolved)) {
    const tc = JSON.parse(fs.readFileSync(timeoutPathResolved, 'utf-8'))
    const entries = Object.entries(tc).map(([n, d]) => [Number(n), d.rows.filter(r => r.exit !== 0).length / d.rows.length])
    for (const [n, r] of entries) rates.push({ n, r })
  }
  const maxRate = rates.length > 0 ? Math.max(...rates.map(x => x.r)) : 0
  gamma = maxRate > 0 ? 1 / maxRate : 0
  const rateOf = (N) => {
    if (rates.length === 0) return 0
    const sorted = [...rates].sort((a, b) => a.n - b.n)
    if (N <= sorted[0].n) return 0
    for (let i = 0; i < sorted.length - 1; i++) {
      if (N <= sorted[i + 1].n) return sorted[i].r + (sorted[i + 1].r - sorted[i].r) * (N - sorted[i].n) / (sorted[i + 1].n - sorted[i].n)
    }
    return sorted[sorted.length - 1].r
  }
  let best = null
  for (let N = 1; N <= Math.min(maxN, EXPERIMENTS.length); N++) {
    const mk = penalizedMakespan(EXPERIMENTS, times, alpha, N)
    const risk = mk * (1 + gamma * rateOf(N))
    if (best === null || risk < best.risk - 0.5) best = { N, mk, risk }
  }
  return { N: best?.N ?? 1, makespanMs: best?.mk ?? 0, riskAdjustedMs: best?.risk ?? 0, alpha, gamma, degraded, source: alphaSource, policyNote }
}
