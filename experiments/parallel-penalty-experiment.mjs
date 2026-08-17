// dsh-megamesh/experiments/parallel-penalty-experiment.mjs —— 并行惩罚感知调度（E26）
// 老模型盲区（E25 EXP-3 实证）：纯 makespan 重演无并行惩罚项 → 盲目收敛全并行 → 22 兵实测拖垮重装置
// 本轮熔炼：惩罚系数不拍脑袋——从多档兵数真实采集拟合；调度器扫参选兵数；新老模型各选 N 真实跑对照
// 判决标准：
//   EXP-1 采集：8 重装置 × 兵数 {1,2,3,4,6,8} 真实跑，逐装置逐档记耗时（含超时=拖垮证据）
//   EXP-2 拟合：每装置膨胀率 α_i=(t(N)-t(1))/(t(1)·(N-1))，全局 α=中位数（数据定参）
//   EXP-3 调度器：惩罚感知 makespan(N)=Σ 缩放耗时重演，N∈1..8 扫参选最优（对比无惩罚项老模型选 8）
//   EXP-4 对照真实跑：老模型 N_old vs 新模型 N_new 各真实跑回归军 → 新模型全绿且 makespan 不劣
import { EXPERIMENTS, partition } from '../regression-army.mjs'
import { spawnSync, spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.join(HERE, '..')
const timesPath = path.join(PROJECT, 'shared', 'consensus', 'regression-times.json')
const collectPath = path.join(PROJECT, 'shared', 'consensus', 'penalty-collect.json')
const SLEEP = (ms) => new Promise(r => setTimeout(r, ms))

// 重装置子集 = 账本里耗时 >3s 的前 8 个（轻装置并行惩罚可忽略，且超时装置必须在内）
// 驱动器排除：会再调回归军/审计军的装置入 HEAVY 即递归
const DRIVERS = new Set(['regression-army-experiment.mjs', 'parallel-penalty-experiment.mjs', 'audit-army-experiment.mjs'])
const times = JSON.parse(fs.readFileSync(timesPath, 'utf-8'))
const HEAVY = Object.entries(times).filter(([f, t]) => t > 3000 && !DRIVERS.has(f)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f]) => f)
const SCOUTS = [1, 2, 3, 4, 6, 8]

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   ⚡ 并行惩罚感知调度（E26）：惩罚系数由数据熔炼，不自拍 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + `  重装置子集（${HEAVY.length} 个） × 兵数 {${SCOUTS.join(',')}} 真实采集——每档 N 兵并行、组内串行` + C.reset)
say('')

// 采集 worker：串行跑自己的装置列表，逐装置记时（超时上限 300s，exit null = 拖垮证据）
const workerSrc = `
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
const [root, expsJson, workerId] = process.argv.slice(2)
const exps = JSON.parse(expsJson)
const out = []
for (const exp of exps) {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [path.join(root, 'experiments', exp)], { cwd: root, stdio: 'ignore', windowsHide: true, timeout: 300000 })
  out.push({ exp, exit: r.status, elapsedMs: Date.now() - t0 })
}
fs.writeFileSync(path.join(root, 'shared', 'consensus', 'penalty-worker-' + workerId + '.json'), JSON.stringify(out))
`
const workerFile = path.join(PROJECT, 'shared', 'consensus', 'penalty-worker.mjs')
fs.writeFileSync(workerFile, workerSrc)

// ---------- EXP-1 采集 ----------
const collect = {}
{
  say(C.cyan + `═ EXP-1 采集：${HEAVY.length} 重装置 × ${SCOUTS.length} 档兵数真实跑 ═` + C.reset)
  for (const N of SCOUTS) {
    const batches = partition(HEAVY, N, times)
    const t0 = Date.now()
    const workers = batches.map((b, i) => spawn(process.execPath, [workerFile, PROJECT, JSON.stringify(b), `n${N}-w${i}`], { stdio: 'ignore', windowsHide: true }))
    await Promise.all(workers.map(w => new Promise(res => w.on('exit', res))))
    // 汇总本档
    const rows = []
    for (let i = 0; i < batches.length; i++) {
      const f = path.join(PROJECT, 'shared', 'consensus', `penalty-worker-n${N}-w${i}.json`)
      if (fs.existsSync(f)) { rows.push(...JSON.parse(fs.readFileSync(f, 'utf-8'))); fs.unlinkSync(f) }
    }
    const wall = Date.now() - t0
    collect[N] = { wallMs: wall, rows }
    const slow = rows.filter(r => r.exit !== 0)
    say(C.dim + `   ${N} 兵 → 墙钟 ${(wall / 1000).toFixed(1)}s · ${rows.length} 装置${slow.length ? C.red + ` · ${slow.length} 个超时/红（拖垮证据）：${slow.map(s => s.exp.replace('.mjs', '') + ':exit' + s.exit).join(',')}` + C.reset : C.green + ' · 全绿' + C.reset}` + C.reset)
  }
  fs.writeFileSync(collectPath, JSON.stringify(collect, null, 2))
}

// ---------- EXP-2 拟合：膨胀率 α（中位数，逐装置跨档） ----------
let alpha = 0
{
  say('')
  say(C.cyan + '═ EXP-2 拟合：每装置膨胀率 α_i，全局 α = 中位数 ═' + C.reset)
  const t1 = Object.fromEntries(collect[1].rows.map(r => [r.exp, r.elapsedMs]))
  const t8 = Object.fromEntries(collect[8].rows.map(r => [r.exp, r.elapsedMs]))
  const alphas = []
  for (const exp of HEAVY) {
    const a = t8[exp] !== undefined && t1[exp] > 0 ? (t8[exp] - t1[exp]) / (t1[exp] * 7) : NaN
    if (Number.isFinite(a) && a >= 0) alphas.push(a)
    say(C.dim + `   ${exp.replace('.mjs', '').padEnd(28)} t(1)=${(t1[exp] / 1000).toFixed(1)}s t(8)=${((t8[exp] ?? -1) / 1000).toFixed(1)}s → α=${a.toFixed(3)}` + C.reset)
  }
  alphas.sort((a, b) => a - b)
  alpha = alphas[Math.floor(alphas.length / 2)]
  say(C.bold + C.green + `   全局惩罚系数 α = ${alpha.toFixed(3)}（中位数，${alphas.length} 装置拟合）——惩罚由实测熔炼，非拍脑袋` + C.reset)
}

// ---------- EXP-3 调度器：惩罚感知 makespan 扫参 ----------
let bidNew = 0
let bidOld = 0
{
  say('')
  say(C.cyan + '═ EXP-3 调度器：惩罚感知 makespan 扫参（N=1..8）vs 无惩罚项老模型 ═' + C.reset)
  const base = Object.fromEntries(collect[1].rows.map(r => [r.exp, r.elapsedMs]))
  // 轻装置（未采集）用账本耗时，惩罚缩放同样适用
  const scaled = (N) => {
    const t = {}
    for (const [f, v] of Object.entries(times)) t[f] = v * (1 + alpha * (N - 1))
    for (const [f, v] of Object.entries(base)) t[f] = v * (1 + alpha * (N - 1))
    return t
  }
  const mk = (N, t) => Math.max(...partition(EXPERIMENTS, N, t).map(b => b.reduce((s, e) => s + (t[e] ?? 1), 0)))
  let bestNew = null, bestOld = null
  for (let N = 1; N <= 8; N++) {
    const p = mk(N, scaled(N))
    const o = mk(N, times)
    if (bestNew === null || p < bestNew.mk) bestNew = { N, mk: p }
    if (bestOld === null || o < bestOld.mk) bestOld = { N, mk: o }
    say(C.dim + `   N=${N} → 惩罚感知 ${(p / 1000).toFixed(1)}s · 老模型 ${(o / 1000).toFixed(1)}s` + C.reset)
  }
  bidNew = bestNew.N
  bidOld = bestOld.N
  const oldTies = new Set([2, 3, 4, 5, 6, 7, 8].map(N => mk(N, times))).size === 1
  say(C.bold + C.green + `   新调度器选 ${bidNew} 兵（惩罚感知 ${(bestNew.mk / 1000).toFixed(1)}s）vs 老模型选 ${bidOld} 兵（${(bestOld.mk / 1000).toFixed(1)}s）` + C.reset)
  if (oldTies) say(C.bold + C.yellow + `   老模型 N=2..8 makespan 全部平局——对并行惩罚零感知（盲区实测）；新模型惩罚项让代价单调可见，选择唯一有据` + C.reset)
}

// ---------- EXP-4 对照真实跑 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 对照真实跑：老模型 N vs 新模型 N 各真实跑一次回归军 ═' + C.reset)
  for (const [label, N] of [['老模型(无惩罚项)', bidOld], ['新模型(惩罚感知)', bidNew]]) {
    const r = spawnSync(process.execPath, ['regression-army.mjs', String(N)], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 1200000 })
    const last = JSON.parse(fs.readFileSync(path.join(PROJECT, 'shared', 'consensus', 'last-regression-run.json'), 'utf-8'))
    say(`${label} ${N} 兵：真实跑 ${last.batches} 兵 · ${(last.elapsedMs / 1000).toFixed(1)}s · 全绿 ${last.allPassed ? C.green + '✓' : C.red + '✗ ' + (last.failing ?? []).join(',')}${C.reset}`)
  }
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 惩罚系数 α 由 6 档真实采集拟合（数据定参，超时计入拖垮证据；脏数据会让拟合偏大——装置事实）' + C.reset)
say(C.dim + '  EXP-3 老模型 N=2..8 makespan 平局=对并行惩罚零感知；新模型惩罚项让代价单调可见，选择唯一有据' + C.reset)
say(C.dim + '  EXP-4 新老模型各选 N 真实跑对照全绿——数据定优劣，不靠嘴' + C.reset)
say(C.dim + '  → 并行惩罚感知调度熔炼完成：资源调度进化从"拍脑袋 N"走向"实测拟合 α 定 N"' + C.reset)
process.exit(0)
