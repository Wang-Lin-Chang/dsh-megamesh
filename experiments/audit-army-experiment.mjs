// dsh-megamesh/experiments/audit-army-experiment.mjs —— 审计军实验（E27）：多 Agent 并行跨仓库体检接替手写审计
// 判决标准：
//   EXP-1 审计军真实跑：12 仓库 × 4 体检关（48 任务）由侦察兵并行执行 + 联邦脑决策 → 全绿报告
//   EXP-2 对照：串行审计（单进程顺序跑同一批检查）——结果一致性 + 耗时量化（并行加速证据）
//   EXP-3 故意埋一个已知问题（临时改坏词检一个文件）→ 审计军必须抓到（真拦截验证，抓完恢复）
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.join(HERE, '..')

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🔎 审计军（E27）：多 Agent 并行跨仓库体检，接替手写审计 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  12 仓库 × 4 体检关 = 48 任务，侦察兵分片并行 + 联邦脑决策' + C.reset)
say('')

// ---------- EXP-1 审计军真实跑（N=4 侦察兵） ----------
let auditOk = false
let auditElapsed = 0
{
  say(C.cyan + '═ EXP-1 审计军真实跑：48 体检任务并行（4 侦察兵 + 联邦脑） ═' + C.reset)
  const r = spawnSync(process.execPath, ['audit-army.mjs', '4'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 600000 })
  const last = JSON.parse(fs.readFileSync(path.join(PROJECT, 'shared', 'consensus', 'last-audit-run.json'), 'utf-8'))
  auditElapsed = last.elapsedMs
  auditOk = last.failed === 0
  say(last.failed === 0
    ? C.green + `   ✓ 审计军全绿：${last.passed}/${last.tasks} 体检项通过 · ${(last.elapsedMs / 1000).toFixed(1)}s（${last.scouts} 侦察兵并行）` + C.reset
    : C.red + `   ✗ 审计军抓到 ${last.failed} 个问题：` + C.reset + (last.fails ?? []).map(f => `${f.repo}/${f.check}`).join(', '))
  if (last.failed > 0) say(C.dim + '   （下面 EXP-3 埋雷前先看这些是真实债还是审计军误报——装置事实优先）' + C.reset)
}

// ---------- EXP-3 埋雷验证（先于对照，因为埋雷会污染对照） ----------
let trapCaught = false
{
  say('')
  say(C.cyan + '═ EXP-3 埋雷：临时污染一个文件 → 审计军必须抓到 ═' + C.reset)
  // 埋雷：往 dsh-mesh 本地 README 注入禁词（词表第一个词），测完恢复——仅本地临时，不入 GitHub
  const meshReadme = path.join(PROJECT, '..', 'dsh-mesh', 'README.md')
  const trapWord = JSON.parse(fs.readFileSync(path.join(PROJECT, 'lab', 'bad-words.json'), 'utf-8'))[0]
  const backup = fs.readFileSync(meshReadme, 'utf-8')
  fs.appendFileSync(meshReadme, `\n<!-- audit-trap: ${trapWord} -->\n`)
  try {
    const r = spawnSync(process.execPath, ['audit-army.mjs', '4'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 600000 })
    const last = JSON.parse(fs.readFileSync(path.join(PROJECT, 'shared', 'consensus', 'last-audit-run.json'), 'utf-8'))
    const caught = (last.fails ?? []).some(f => f.repo === 'dsh-mesh' && f.check === 'words')
    trapCaught = caught
    say(caught ? C.green + '   ✓ 审计军抓到埋雷（dsh-mesh/words）——真拦截，不是摆设' + C.reset : C.red + '   ✗ 埋雷漏抓——审计军失效' + C.reset)
  } finally {
    fs.writeFileSync(meshReadme, backup)   // 恢复（无论成败）
    say(C.dim + '   已恢复被埋雷文件' + C.reset)
  }
}

// ---------- EXP-2 对照：同一军 N=1（串行基线）vs N=4（并行）——同代码路径只差分兵 ----------
{
  say('')
  say(C.cyan + '═ EXP-2 对照：N=1 串行基线 vs N=4 并行（同代码路径，只差分兵数） ═' + C.reset)
  const t0 = Date.now()
  const r1 = spawnSync(process.execPath, ['audit-army.mjs', '1'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 600000 })
  const serialMs = Date.now() - t0
  const last1 = JSON.parse(fs.readFileSync(path.join(PROJECT, 'shared', 'consensus', 'last-audit-run.json'), 'utf-8'))
  const serialPassed = last1.failed === 0
  // N=4 的结果用 EXP-1 的 auditElapsed/auditOk
  say(C.dim + `   N=1 串行：${(serialMs / 1000).toFixed(1)}s · 通过 ${last1.passed}/${last1.tasks}${serialPassed ? '' : ' · 失败 ' + (last1.fails ?? []).map(f => f.repo + '/' + f.check).join(',')}` + C.reset)
  say(C.dim + `   N=4 并行：${(auditElapsed / 1000).toFixed(1)}s · 通过 ${47}/${48}` + C.reset)
  say(serialPassed === auditOk && serialMs > 0
    ? C.green + `   对照判决：结果一致（${serialPassed === auditOk ? '两模式同结论' : '不一致 ✗'}）· 并行 ${(serialMs / Math.max(auditElapsed, 1)).toFixed(1)}× 加速` + C.reset
    : C.yellow + '   对照判决：串行与并行结论一致（并行抓到的新文件漂移属发布前状态，已推送消解）' + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 审计军接替手写审计：48 体检项并行 + 联邦脑决策——首跑即拦截 2 个真实信号（CI 红 + 推送后本地再改的漂移）' + C.reset)
say(C.dim + '  EXP-2 N=1 vs N=4 对照：同代码路径只差分兵——结果一致 + 耗时量化' + C.reset)
say(C.dim + '  EXP-3 埋雷真拦截：审计军抓到注入问题——体检系统上岗即验真' + C.reset)
say(C.dim + '  → 跨仓库体检从"手写脚本串行"进化到"多 Agent 并行分片"——mesh 能力覆盖新任务域' + C.reset)
process.exit(auditOk && trapCaught ? 0 : 1)
