// dsh-megamesh/experiments/dual-army-deploy-experiment.mjs —— 发布双军联动（E30）
// 判决标准（审计军进发布流程）：
//   EXP-1 复核轮翻转：一次性陷阱注入偶发失败 → 首圈抓、复核轮翻转（不同侦察兵重查通过）
//   EXP-2 真失败双败定案：注入禁词污染 → 首圈抓、复核确认（复核过滤假阳性不放过真债）
//   EXP-3 双军联动发布：deploy-army（本仓库三关）+ audit-army（12 仓库四关）同跑全绿 → 发布背书
//   EXP-4 对照：单军（deploy-army）发布背书基线——双军不劣于单军（发布门槛抬高、耗时量化）
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.join(HERE, '..')
const lastAuditPath = path.join(PROJECT, 'shared', 'consensus', 'last-audit-run.json')

// ---------- EXP-1 复核轮翻转：偶发失败（CI 未定案） ----------
let flipOk = false
{
  say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
  say(C.bold + C.magenta + '║   🛡️ 发布双军联动（E30）：审计军复核轮 + 双军背书 ║' + C.reset)
  say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
  say('')
  say(C.cyan + '═ EXP-1 复核轮翻转验证：注入偶发失败 → 首圈抓、复核翻转 ═' + C.reset)
  // 一次性陷阱协议：AUDIT_ONESHOT_TRAP 文件内容 "repo/check"——首圈检查匹配则删文件并报失败，
  // 复核轮（不同侦察兵）再查时陷阱已消费 → 通过 = 偶发失败被复核轮翻转
  const trapFile = path.join(PROJECT, 'shared', 'consensus', 'oneshot-trap.txt')
  fs.writeFileSync(trapFile, 'dsh-mesh/version')
  try {
    const r = spawnSync(process.execPath, ['audit-army.mjs', '4'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 600000, env: { ...process.env, AUDIT_ONESHOT_TRAP: trapFile } })
    const last = JSON.parse(fs.readFileSync(lastAuditPath, 'utf-8'))
    const review = last.reviewRound
    flipOk = (last.failed ?? 0) > 0 && (review?.candidates ?? 0) > 0 && (review?.flipped?.length ?? 0) > 0 && (last.failed ?? 0) < (review?.candidates ?? Infinity)
    say(last.failed > 0 && review?.candidates > 0
      ? C.green + `   ✓ 首圈抓 ${review.candidates} 个候选失败 → 复核轮翻转 ${review.flipped.length} 个（不同侦察兵重查通过——偶发过滤生效）` + C.reset
      : C.yellow + `   ⚠ 偶发失败未触发复核轮（failed=${last.failed} candidates=${review?.candidates ?? 0} flipped=${review?.flipped?.length ?? 0}）` + C.reset)
  } finally {
    if (fs.existsSync(trapFile)) fs.unlinkSync(trapFile)   // 恢复
    say(C.dim + '   已清理一次性陷阱' + C.reset)
  }
}

// ---------- EXP-2 真失败双败定案 ----------
let confirmOk = false
{
  say('')
  say(C.cyan + '═ EXP-2 真失败双败定案：注入禁词污染 → 首圈抓、复核确认 ═' + C.reset)
  const meshReadme = path.join(PROJECT, '..', 'dsh-mesh', 'README.md')
  const trapWord = JSON.parse(fs.readFileSync(path.join(PROJECT, 'lab', 'bad-words.json'), 'utf-8'))[0]
  const backup = fs.readFileSync(meshReadme, 'utf-8')
  fs.appendFileSync(meshReadme, `\n<!-- audit-trap: ${trapWord} -->\n`)
  try {
    const r = spawnSync(process.execPath, ['audit-army.mjs', '4'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 600000 })
    const last = JSON.parse(fs.readFileSync(lastAuditPath, 'utf-8'))
    const review = last.reviewRound
    const confirmed = (last.fails ?? []).some(f => f.repo === 'dsh-mesh' && f.check === 'words')
    confirmOk = confirmed && (review?.confirmed ?? 0) >= 1
    say(confirmed ? C.green + `   ✓ 真失败双败定案：首圈抓 + 复核确认（confirmed=${review?.confirmed}）——不放过真债` + C.reset : C.red + '   ✗ 真失败漏抓——复核轮失效' + C.reset)
  } finally {
    fs.writeFileSync(meshReadme, backup)
    say(C.dim + '   已恢复被埋雷文件' + C.reset)
  }
}

// ---------- EXP-3 双军联动发布 ----------
let dualOk = false
let dualMs = 0
{
  say('')
  say(C.cyan + '═ EXP-3 双军联动：deploy-army（本仓库三关）+ audit-army（12 仓库四关） ═' + C.reset)
  const t0 = Date.now()
  const d = spawnSync(process.execPath, ['deploy-army.mjs'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 900000 })
  const a = spawnSync(process.execPath, ['audit-army.mjs', '4'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 900000 })
  dualMs = Date.now() - t0
  const audit = JSON.parse(fs.readFileSync(lastAuditPath, 'utf-8'))
  dualOk = d.status === 0 && a.status === 0 && (audit.failed ?? 0) === 0
  say(dualOk
    ? C.green + `   ✓ 双军全绿：deploy-army exit 0 + audit-army 48/48（${(dualMs / 1000).toFixed(1)}s）——发布双军背书` + C.reset
    : C.red + `   ✗ 双军未全绿：deploy=${d.status} audit=${a.status} failed=${audit.failed}` + C.reset)
}

// ---------- EXP-4 单军基线 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 对照：单军基线（deploy-army） ═' + C.reset)
  const t0 = Date.now()
  const d = spawnSync(process.execPath, ['deploy-army.mjs'], { cwd: PROJECT, stdio: 'ignore', windowsHide: true, timeout: 900000 })
  const ms = Date.now() - t0
  say(C.dim + `   单军 deploy-army：exit ${d.status} · ${(ms / 1000).toFixed(1)}s（对照基线——双军 ${(dualMs / 1000).toFixed(1)}s 多出跨仓库四关背书）` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 复核轮把偶发失败翻转为通过（不同侦察兵独立重查）——偶发 ≠ 债' + C.reset)
say(C.dim + '  EXP-2 真失败双败定案不放过——复核是过滤假阳性，不是放水' + C.reset)
say(C.dim + '  EXP-3/4 双军联动发布背书上线：本仓库三关 + 跨仓库四关，单军对照量化' + C.reset)
say(C.dim + '  → 审计军进发布流程：从 E27 实验装置变成每次发布的第二道军门' + C.reset)
process.exit(flipOk && confirmOk && dualOk ? 0 : 1)
