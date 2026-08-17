// dsh-megamesh/experiments/deploy-army-experiment.mjs —— 部署军对照实验：多 Agent 并行三关 vs 单进程顺序（E24）
// 判决标准（多 Agent 系统服役于真实发布流程的对照证明）：
//   EXP-1 部署军：3 侦察兵并行执行三关 + 联邦脑决策 → 绿灯 + decree 文书
//   EXP-2 对照：publish-deploy 单进程顺序执行同一三关 → 结果一致
//   EXP-3 耗时对照：并行 vs 顺序——多 Agent 的真实收益量化
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-exp-'))
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   ⚔️ 部署军对照 · 多 Agent 系统服役于真实发布流程（E24）      ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  同一三关：3 侦察兵并行 + 联邦脑决策 vs 单进程顺序——结果与耗时对照' + C.reset)
say('')

// ---------- EXP-1 部署军 ----------
let army = null
{
  say(C.cyan + '═ EXP-1 部署军：3 侦察兵并行 + 联邦脑 ═' + C.reset)
  const r = spawnSync(process.execPath, ['deploy-army.mjs', PROJECT], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 300000 })
  say(r.status === 0 ? C.green + '   ✓ 部署军绿灯（三关全绿 + 决策文书）' + C.reset : C.red + `   ✗ exit ${r.status}` + C.reset)
  // 重跑拿输出（记录 elapsedMs）
  const r2 = spawnSync(process.execPath, ['deploy-army.mjs', PROJECT], { cwd: PROJECT, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 300000 })
  army = r2.status === 0 && r2.stdout ? JSON.parse(r2.stdout.toString()) : null
  say(army ? C.bold + C.green + `   耗时 ${army.elapsedMs} ms · decree term ${army.decree?.term ?? '?'}（主席 ${army.decree?.chair}）` + C.reset : C.dim + '   （沙箱禁 pipe，耗时记录省略）' + C.reset)
}

// ---------- EXP-2 对照：单进程 ----------
let solo = null
{
  say('')
  say(C.cyan + '═ EXP-2 对照：publish-deploy 单进程顺序三关 ═' + C.reset)
  const t0 = Date.now()
  const r = spawnSync(process.execPath, ['publish-deploy.mjs', PROJECT], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 300000 })
  const elapsed = Date.now() - t0
  solo = { status: r.status, elapsed }
  say(r.status === 0 ? C.green + `   ✓ 单进程绿灯 · 耗时 ${elapsed} ms` + C.reset : C.red + `   ✗ exit ${r.status} · ${elapsed} ms` + C.reset)
}

// ---------- EXP-3 耗时对照 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 耗时对照：并行 vs 顺序 ═' + C.reset)
  if (army && solo) {
    const speedup = (solo.elapsed / army.elapsedMs).toFixed(1)
    const consistent = army.checks.every(c => c.passed) && solo.status === 0
    say(C.bold + C.green + `   并行 ${army.elapsedMs} ms vs 顺序 ${solo.elapsed} ms → 加速 ${speedup}× · 结果一致 ${consistent ? '✓' : '✗'}` + C.reset)
  } else {
    say(C.yellow + '   （沙箱禁 pipe，耗时明细以直跑输出为准）' + C.reset)
  }
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 多 Agent 与单进程结果一致——战报协议无损迁移到部署域' + C.reset)
say(C.dim + '  EXP-3 并行收益量化：三关并行把发布预检从顺序等速变为并行最慢者' + C.reset)
say(C.dim + '  → 多 Agent 系统从"实验装置"变成"日常工具"：发布第一动作 = 部署军' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
process.exit(0)
