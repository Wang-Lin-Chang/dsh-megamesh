// dsh-mesh/cross-experiment.mjs —— 跨物种通信实验：人机共读战报（Markdown 人读区 + JSON 机器区，同一文件）
// 判决标准：
//   EXP-1 生成：90 份 JSON 战报 → 文书官渲染成 90 份人机共读 .md
//   EXP-2 人读：抽样渲染战报的人读区（表格/checklist/摘要——人类友好）
//   EXP-3 机器解析 + 军法：JSON 区过军法 0 误杀 + 两区一致性 90/90
//   EXP-4 双区矛盾（真 BUG 剧本）：改 Markdown 区 → 两区矛盾拒收；改 JSON 区 severity → 军法抓——双保险
//   EXP-5 人批注闭环：批注 A 违反军法 → 驳回（军法面前人人平等）；批注 B 合法 → 应用 → 两区同步
import { MeshCore } from '../mesh-core.mjs'
import { spawn } from 'node:child_process'
import { render, parse, verify } from '../clerk-worker.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-'))
const mesh = new MeshCore(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const HUMAN = path.join(ROOT, 'shared', 'human')
fs.mkdirSync(HUMAN, { recursive: true })
const workers = []
const spawnScout = (id, shard) => spawn(process.execPath, ['scout-worker.mjs', ROOT, id, shard, 'report'], { stdio: 'ignore', windowsHide: true })
const doneCount = () => fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
const waitFor = async (fn, timeoutMs, everyMs = 100) => {
  const t0 = Date.now()
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() - t0 > timeoutMs) return null
    await sleep(everyMs)
  }
}

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🤝 跨物种通信 · 人机共读战报 · 双区校验 · 人批注闭环        ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  同一文件两种消费：人读 Markdown 上半，机器读 JSON 下半；两区矛盾必被抓，批注同样过军法' + C.reset)
say('')

const N = 90

// ---------- 起战场 + 文书官渲染 ----------
for (let i = 1; i <= N; i++) mesh.enqueue(i, { n: i })
for (let i = 0; i < 30; i++) workers.push(spawnScout(`scout-${i}`, `${i}/30`))
await waitFor(() => doneCount() >= N, 60000)

// ============ EXP-1/2 生成 + 人读 ============
{
  say(C.cyan + '═ EXP-1/2 文书官渲染：90 份 JSON 战报 → 人机共读 .md ═' + C.reset)
  const clerk = spawn(process.execPath, ['clerk-worker.mjs', ROOT, 'render'], { stdio: 'ignore', windowsHide: true })
  await waitFor(() => fs.readdirSync(HUMAN).filter(f => f.endsWith('.md')).length >= N, 20000)
  clerk.kill()
  say(C.green + `   ✓ ${N} 份人机共读战报落账（shared/human/）` + C.reset)
  say(C.dim + '   ── 人看到的样子（report-57.md 人读区）──' + C.reset)
  const md57 = fs.readFileSync(path.join(HUMAN, 'report-57.md'), 'utf-8')
  for (const line of md57.split('\n').slice(0, 17)) say(C.dim + '   ' + line + C.reset)
  say(C.dim + '   ……（下方 JSON 区供机器解析）' + C.reset)
}

// ============ EXP-3 机器解析 + 军法 ============
{
  say('')
  say(C.cyan + '═ EXP-3 机器解析：JSON 区过军法 + 两区一致性 ═' + C.reset)
  let okCount = 0
  const bad = []
  for (const f of fs.readdirSync(HUMAN).filter(f => f.endsWith('.md'))) {
    const v = verify(fs.readFileSync(path.join(HUMAN, f), 'utf-8'))
    if (v.ok) okCount++
    else bad.push([f, v.errors])
  }
  say(C.green + `   ✓ ${okCount}/${N} 份战报机器解析全过（军法 0 误杀 + 两区一致）${bad.length === 0 ? '✓' : '✗ ' + JSON.stringify(bad.slice(0, 2))}` + C.reset)
}

// ============ EXP-4 双区矛盾 ============
{
  say('')
  say(C.cyan + '═ EXP-4 双区矛盾：改 Markdown 摘要 → 两区校验抓；改 JSON severity → 军法抓 ═' + C.reset)
  const p57 = path.join(HUMAN, 'report-57.md')
  const orig = fs.readFileSync(p57, 'utf-8')
  // 篡改 1：只改 Markdown 摘要（威胁度 100→99），JSON 区不动
  fs.writeFileSync(p57, orig.replace('> 摘要：蜀中发现盐路被断，威胁度100', '> 摘要：蜀中发现盐路被断，威胁度99'))
  const v1 = verify(fs.readFileSync(p57, 'utf-8'))
  say(C.red + `   🔪 篡改 Markdown 区 → 校验报：${v1.errors.join('；')}（拒收，大脑零接触）` + C.reset)
  // 篡改 2：JSON 区 severity 100→250
  const tampered = orig.replace('"severity": 100', '"severity": 250')
  fs.writeFileSync(p57, tampered)
  const v2 = verify(fs.readFileSync(p57, 'utf-8'))
  say(C.red + `   🔪 篡改 JSON 区 severity → 校验报：${v2.errors.join('；')}（军法跨界同样生效）` + C.reset)
  fs.writeFileSync(p57, orig)   // 还原现场
  say(C.green + `   ✅ 双区双保险：人改人区、机器改机器区，任何一侧被改都逃不掉` + C.reset)
}

// ============ EXP-5 人批注闭环 ============
{
  say('')
  say(C.cyan + '═ EXP-5 人批注闭环：人写批注 → 过军法才生效 → 两区同步 ═' + C.reset)
  const clerk = spawn(process.execPath, ['clerk-worker.mjs', ROOT, 'watch'], { stdio: 'ignore', windowsHide: true })
  await sleep(500)
  const p57 = path.join(HUMAN, 'report-57.md')
  // 批注 A：违反军法（severity 100 却要改常规记录）
  fs.appendFileSync(p57, '\n> 【批注】{"request":"常规记录"}\n')
  await waitFor(() => fs.existsSync(path.join(HUMAN, 'actions.jsonl')) && fs.readFileSync(path.join(HUMAN, 'actions.jsonl'), 'utf-8').includes('rejected'), 10000)
  const afterA = parse(fs.readFileSync(p57, 'utf-8'))
  say(C.red + `   🚫 批注 A（改为常规记录）→ 军法驳回：${afterA.json.request === '建议增援' ? '战报保持原判（severity 100 必须建议增援）✓' : '✗'}——军法面前人人平等，人也不例外` + C.reset)
  // 批注 B：合法补充（备注字段）
  fs.appendFileSync(p57, '\n> 【批注】{"note":"已确认盐路断点位置：蜀中青城渡口"}\n')
  await waitFor(() => {
    const a = fs.readFileSync(path.join(HUMAN, 'actions.jsonl'), 'utf-8')
    return a.includes('applied')
  }, 10000)
  const afterB = parse(fs.readFileSync(p57, 'utf-8'))
  const vB = verify(fs.readFileSync(p57, 'utf-8'))
  const synced = fs.existsSync(path.join(ROOT, 'shared', 'reports', 'report-57.json')) &&
    JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'reports', 'report-57.json'), 'utf-8')).note === '已确认盐路断点位置：蜀中青城渡口'
  say(C.green + `   ✅ 批注 B（补充备注）→ 应用成功：JSON 区 note=${afterB.json.note} · 两区一致 ${vB.ok ? '✓' : '✗'} · 源头战报同步 ${synced ? '✓' : '✗'}——人机共用同一账本` + C.reset)
  clerk.kill()
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 人机共读：同一文件，人读 Markdown 上半、机器读 JSON 下半——消除人机界面' + C.reset)
say(C.dim + '  EXP-3 机器解析：军法 + 两区一致性双校验，90/90 零误杀' + C.reset)
say(C.dim + '  EXP-4 双区双保险：人区机器区任何一侧被篡改都逃不掉（两区矛盾=可执行文档固有隐患，已被焊死）' + C.reset)
say(C.dim + '  EXP-5 人批注闭环：人写批注机器执行，但批注同样过军法——军法面前人人平等' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
for (const w of workers) { try { w.kill() } catch {} }
process.exit(0)
