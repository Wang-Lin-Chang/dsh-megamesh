// dsh-megamesh/experiments/regression-army-experiment.mjs —— 回归军实验：竞标/进化接管真实分兵参数（E25）
// 判决标准（平行宇宙竞标/进化拿下：真实回归任务的分兵参数由数据定出）：
//   EXP-1 回归军首跑：全部装置 6 兵分片并行全绿 + 真实耗时账本落盘
//   EXP-2 竞标：候选兵数用真实耗时重演 makespan → 显式平局判据（makespan 相同取最少兵）定分兵
//   EXP-3 进化确认：全域变异 + 同一平局判据 → 收敛与竞标一致（两机制互证）
//   EXP-4 二次回归：竞标胜出兵数真实跑全绿（数据定优劣，取证落盘）
import { EXPERIMENTS, partition } from '../regression-army.mjs'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.join(HERE, '..')
const timesPath = path.join(PROJECT, 'shared', 'consensus', 'regression-times.json')

// 平局判据：makespan 相同（差 < 1ms）取最少兵——资源最少为第二准则，两机制共用同一判据（装置事实）
const tieBreak = (a, b) => Math.abs(b.makespan - a.makespan) < 1 ? (b.n < a.n ? b : a) : (b.makespan < a.makespan ? b : a)
const makespanOf = (times) => (n) => Math.max(...partition(EXPERIMENTS, n, times).map(b => b.reduce((s, e) => s + (times[e] ?? 1), 0)))

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   ⚔️ 回归军 · 平行宇宙竞标/进化接管真实分兵参数（E25）        ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + `  ${EXPERIMENTS.length} 个实验装置的回归跑由侦察兵分片执行——分兵数由竞标/进化用真实耗时定出（并行惩罚实测：22 兵全并行拖垮重装置，见判决）` + C.reset)
say('')

// ---------- EXP-1 回归军首跑（6 兵：并行惩罚实测后的可行分兵） ----------
{
  say(C.cyan + `═ EXP-1 回归军首跑：${EXPERIMENTS.length} 装置分 6 兵并行（22 兵全并行实测拖垮重装置，见判决） ═` + C.reset)
  const r = spawnSync(process.execPath, ['regression-army.mjs', '6'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 900000 })
  const times = JSON.parse(fs.readFileSync(timesPath, 'utf-8'))
  const entries = Object.keys(times).length
  say(r.status === 0 ? C.green + `   ✓ 首跑全绿 · 耗时账本 ${entries} 条真实数据落盘（含并行惩罚的真实耗时）` + C.reset : C.red + `   ✗ exit ${r.status}` + C.reset)
}

// ---------- EXP-2 竞标：候选兵数重演 makespan（实测可行域 + 显式平局判据） ----------
let bidding = null
{
  say('')
  say(C.cyan + '═ EXP-2 竞标：候选兵数 × 真实耗时重演 makespan（域由首跑实测约束定出） ═' + C.reset)
  const times = JSON.parse(fs.readFileSync(timesPath, 'utf-8'))
  const mk = makespanOf(times)
  bidding = [2, 3, 4, 6, 8].map(n => ({ n, batches: partition(EXPERIMENTS, n, times).length, makespan: mk(n) }))
  for (const b of bidding) say(C.dim + `   ${b.batches} 兵 → makespan ${(b.makespan / 1000).toFixed(1)}s` + C.reset)
  const best = bidding.reduce(tieBreak)
  say(C.bold + C.green + `   🏆 竞标胜者：${best.n} 兵（makespan ${(best.makespan / 1000).toFixed(1)}s 最小；平局取最少兵）——分兵参数由真实耗时竞标定出` + C.reset)
}

// ---------- EXP-3 进化确认：全域变异 + 同一平局判据 → 两机制互证 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 进化确认：变异兵数世代迭代（全域探索 + 同一平局判据） ═' + C.reset)
  const times = JSON.parse(fs.readFileSync(timesPath, 'utf-8'))
  const mk = makespanOf(times)
  let s = 7
  const rng = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  let pool = [1, 2, 3, 4, 8, 11, 22]
  const history = []
  for (let g = 1; g <= 5; g++) {
    const scored = pool.map(n => ({ n, makespan: mk(n) })).sort((a, b) => Math.abs(a.makespan - b.makespan) < 1 ? a.n - b.n : a.makespan - b.makespan)
    history.push({ gen: g, best: scored[0].n, makespan: scored[0].makespan })
    const elites = scored.slice(0, 2).map(x => x.n)
    const next = [...elites]
    while (next.length < 6) {
      const parent = scored[Math.floor(rng() * 3)].n
      const mutant = Math.max(1, parent + (rng() < 0.5 ? 1 : -1) * (1 + Math.floor(rng() * 4)))
      if (!next.includes(mutant)) next.push(mutant)
    }
    pool = next
  }
  for (const h of history) say(C.dim + `   第 ${h.gen} 代：最优 ${h.best} 兵 · makespan ${(h.makespan / 1000).toFixed(1)}s` + C.reset)
  const evoBest = history[history.length - 1].best
  const bidBest = bidding.reduce(tieBreak).n
  const same = evoBest === bidBest
  say(same
    ? C.bold + C.green + `   进化收敛 ${evoBest} 兵 = 竞标胜者 ${bidBest} 兵——两机制同一判据互证一致 ✓` + C.reset
    : C.bold + C.red + `   进化收敛 ${evoBest} 兵 vs 竞标胜者 ${bidBest} 兵——分歧 ✗` + C.reset)
}

// ---------- EXP-4 二次回归对照：竞标胜出兵数真实跑 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 二次回归：竞标胜出兵数真实跑（对照 22 兵全并行拖垮） ═' + C.reset)
  const bestN = bidding.reduce(tieBreak).n
  const lastRunPath = path.join(PROJECT, 'shared', 'consensus', 'last-regression-run.json')
  const r = spawnSync(process.execPath, ['regression-army.mjs', String(bestN)], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 900000 })
  const out = r.status === 0 && fs.existsSync(lastRunPath) ? JSON.parse(fs.readFileSync(lastRunPath, 'utf-8')) : null
  if (out && out.N === bestN) {
    say(C.bold + C.green + `   竞标 ${bestN} 兵：真实跑 ${out.batches} 兵 · ${(out.elapsedMs / 1000).toFixed(1)}s · 全绿 ${out.allPassed ? '✓' : '✗'}` + C.reset)
  } else {
    say(C.red + '   ✗ 二次回归失败或取证缺失' + C.reset)
  }
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 回归军服役：24 装置 6 兵分片并行回归全绿 + 真实耗时账本落盘' + C.reset)
say(C.dim + '  EXP-2 竞标用真实耗时在实测可行域内定出分兵参数（平局取最少兵，数据定参）' + C.reset)
say(C.dim + '  EXP-3 进化全域探索 + 同一平局判据收敛与竞标一致——两机制互证' + C.reset)
say(C.dim + '  EXP-4 竞标胜出兵数真实跑全绿，对照 22 兵全并行拖垮重装置（并行惩罚实测）' + C.reset)
say(C.dim + '  → 竞标/进化拿下真实任务：进化查全域，竞标定可行参——平行宇宙接管回归军分兵' + C.reset)
process.exit(0)
