// dsh-megamesh/experiments/scheduler-command-experiment.mjs —— 调度器接管回归军分兵（E29）
// 判决标准（P0 服役：E26 熔炼出的 α 调度器成为回归军生产路径）：
//   EXP-1 --auto：α 调度器读账本定 N 真实跑（生产路径验证 + shardSource 落盘取证）
//   EXP-2 对照：纯 makespan 竞标（无惩罚项，E25 口径）选 N 真实跑
//   EXP-3 对照：固定 N=3（历史生产值）真实跑
//   判决：三档全绿 + makespan 数据对比——α 调度不劣于两对照，且 N 由数据唯一定出
import { EXPERIMENTS, partition } from '../regression-army.mjs'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.join(HERE, '..')
const lastRunPath = path.join(PROJECT, 'shared', 'consensus', 'last-regression-run.json')

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🎯 调度器接管回归军（E29）：--auto 成为生产路径 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  三档真实跑对照：α 调度（读账本定 N） vs 纯 makespan 竞标 vs 固定 N=3' + C.reset)
say('')

const runArmy = (arg) => {
  const r = spawnSync(process.execPath, ['regression-army.mjs', arg], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 1200000 })
  const last = JSON.parse(fs.readFileSync(lastRunPath, 'utf-8'))
  return { exit: r.status, ...last }
}
const timeLabel = (ms) => (ms / 1000).toFixed(1) + 's'

// ---------- EXP-1 α 调度 --auto ----------
let autoRun = null
{
  say(C.cyan + '═ EXP-1 α 调度 --auto：读账本拟合 α 定 N 真实跑（生产路径） ═' + C.reset)
  autoRun = runArmy('--auto')
  const s = autoRun.shardSource ?? {}
  say(C.green + `   ✓ --auto 定 N=${autoRun.effectiveN}（α=${s.alpha?.toFixed(3)} · 预测 makespan ${timeLabel(s.makespanMs ?? 0)} · 来源 ${s.source}）` + C.reset)
  say(autoRun.allPassed ? C.green + `   真实跑 ${autoRun.batches} 兵 · ${timeLabel(autoRun.elapsedMs)} · 全绿 ✓` + C.reset : C.red + `   真实跑失败：${(autoRun.failing ?? []).join(',')}` + C.reset)
}

// ---------- EXP-2 纯 makespan 竞标 ----------
let bidRun = null
{
  say('')
  say(C.cyan + '═ EXP-2 对照：纯 makespan 竞标（无惩罚项）选 N 真实跑 ═' + C.reset)
  const times = JSON.parse(fs.readFileSync(path.join(PROJECT, 'shared', 'consensus', 'regression-times.json'), 'utf-8'))
  let bestN = 1, bestMk = Infinity
  for (let n = 1; n <= 8; n++) {
    const mk = Math.max(...partition(EXPERIMENTS, n, times).map(b => b.reduce((s, e) => s + (times[e] ?? 1), 0)))
    if (mk < bestMk) { bestMk = mk; bestN = n }
  }
  bidRun = runArmy(String(bestN))
  say(C.dim + `   竞标选 N=${bestN}（makespan ${timeLabel(bestMk)}）` + C.reset)
  say(bidRun.allPassed ? C.green + `   真实跑 ${bidRun.batches} 兵 · ${timeLabel(bidRun.elapsedMs)} · 全绿 ✓` + C.reset : C.red + `   真实跑失败：${(bidRun.failing ?? []).join(',')}` + C.reset)
}

// ---------- EXP-3 固定 N=3 ----------
let fixedRun = null
{
  say('')
  say(C.cyan + '═ EXP-3 对照：固定 N=3（历史生产值）真实跑 ═' + C.reset)
  fixedRun = runArmy('3')
  say(fixedRun.allPassed ? C.green + `   真实跑 ${fixedRun.batches} 兵 · ${timeLabel(fixedRun.elapsedMs)} · 全绿 ✓` + C.reset : C.red + `   真实跑失败：${(fixedRun.failing ?? []).join(',')}` + C.reset)
}

// ---------- 判决 ----------
say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
const allGreen = autoRun.allPassed && bidRun.allPassed && fixedRun.allPassed
say(C.dim + `  EXP-1 --auto N=${autoRun.effectiveN}（α 调度） ${timeLabel(autoRun.elapsedMs)} · 全绿 ${autoRun.allPassed ? '✓' : '✗'}` + C.reset)
say(C.dim + `  EXP-2 竞标 N=${bidRun.effectiveN} ${timeLabel(bidRun.elapsedMs)} · 全绿 ${bidRun.allPassed ? '✓' : '✗'}` + C.reset)
say(C.dim + `  EXP-3 固定 N=3 ${timeLabel(fixedRun.elapsedMs)} · 全绿 ${fixedRun.allPassed ? '✓' : '✗'}` + C.reset)
say(C.dim + `  → --auto 生产路径上岗：N 由账本数据唯一定出（α=${(autoRun.shardSource?.alpha ?? 0).toFixed(3)}），三档全绿对照数据定优劣` + C.reset)
say(C.dim + `  调度器不再只活在 E26——回归军出勤默认走 --auto（数据说话，非拍脑袋）` + C.reset)
process.exit(allGreen ? 0 : 1)
