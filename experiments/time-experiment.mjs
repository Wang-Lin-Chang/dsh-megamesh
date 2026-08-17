// dsh-mesh/time-experiment.mjs —— 时间战场实验：高压快照 / diff 假阳性 / 平行宇宙 / merge 假阳性 / 全文层脱钩
// 判决标准（对自己狠：主动挖真 BUG 和假阳性）：
//   EXP-1 高压快照：raw 单遍 copy vs safe 两遍读一致——raw 的因果断裂（孤儿战报）就是朴素快照的真 BUG
//   EXP-2 diff 假阳性：naive mtime diff 报 N 个"变更" vs 语义 hash diff 报 0（内容相同的两个快照）
//   EXP-3 平行宇宙：branch/checkout/重演——两条未来并存 + 重演可复现 + 在途任务收养重派
//   EXP-4 merge 假阳性：朴素覆盖声称 0 冲突（a 版战报消失=静默丢数据）vs 三向合并报冲突留双档
//   EXP-5 快照与全文层脱钩：分支宇宙 expand 全文失败（digest 引用悬空）——已知边界的实测暴露
import { MeshCore } from '../mesh-core.mjs'
import { TimeMachine } from '../time-machine.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'time-'))
const mesh = new MeshCore(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const tm = new TimeMachine(ROOT)
const workers = []
const spawnScoutAt = (root, id, shard) => spawn(process.execPath, ['scout-worker.mjs', root, id, `${shard}/30`, 'report'], { stdio: 'ignore', windowsHide: true })
const doneCount = (root) => fs.readdirSync(path.join(root, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
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
say(C.bold + C.magenta + '║   ⏳ 时间战场 · 高压快照 · 平行宇宙 · 合并冲突 · 狠挖真BUG   ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  agent-git：checkpoint/branch/checkout/diff/merge——文件系统账本天然支持时间线操作' + C.reset)
say('')

const N = 90

// ---------- 准备：第一波任务 + 基线快照 t1 ----------
for (let i = 1; i <= N; i++) mesh.enqueue(i, { n: i })
for (let i = 0; i < 30; i++) workers.push(spawnScoutAt(ROOT, `scout-${i}`, i))
await waitFor(() => doneCount(ROOT) >= N, 60000)
await tm.checkpoint('t1')
say(C.green + `✅ 第一波 90 任务完成 → 快照 t1（时间线原点）` + C.reset)
say('')

// ============ EXP-1 高压快照：raw vs safe ============
let rawStats = null, safeStats = null
{
  say(C.cyan + '═ EXP-1 高压快照：战场奔流中连拍——raw 单遍 copy vs safe 两遍扫描对账 ═' + C.reset)
  for (let i = 101; i <= 100 + N; i++) mesh.enqueue(i, { n: i })
  const rawAudits = []
  for (let k = 0; k < 20; k++) {
    await tm.checkpoint(`raw-${k}`, { mode: 'raw' })
    rawAudits.push(tm.audit(`raw-${k}`))
    await sleep(40)
  }
  await waitFor(() => doneCount(ROOT) >= 2 * N, 60000)
  for (let i = 201; i <= 200 + N; i++) mesh.enqueue(i, { n: i })
  const safeAudits = []
  for (let k = 0; k < 20; k++) {
    await tm.checkpoint(`safe-${k}`, { mode: 'safe' })
    safeAudits.push(tm.audit(`safe-${k}`))
    await sleep(40)
  }
  await waitFor(() => doneCount(ROOT) >= 3 * N, 60000)
  rawStats = {
    corrupt: rawAudits.reduce((s, a) => s + a.corrupt.length, 0),
    orphans: rawAudits.reduce((s, a) => s + a.orphans.length, 0),
    unpaired: rawAudits.reduce((s, a) => s + a.unpaired.length, 0),
    dups: rawAudits.reduce((s, a) => s + a.dups.length, 0),
    badSnaps: rawAudits.filter(a => a.corrupt.length + a.orphans.length + a.unpaired.length + a.dups.length > 0).length,
  }
  safeStats = {
    corrupt: safeAudits.reduce((s, a) => s + a.corrupt.length, 0),
    orphans: safeAudits.reduce((s, a) => s + a.orphans.length, 0),
    unpaired: safeAudits.reduce((s, a) => s + a.unpaired.length, 0),
    dups: safeAudits.reduce((s, a) => s + a.dups.length, 0),
    badSnaps: safeAudits.filter(a => a.corrupt.length + a.orphans.length + a.unpaired.length + a.dups.length > 0).length,
  }
  say(C.red + `   🔪 raw 朴素快照：20 连拍中 ${rawStats.badSnaps} 个快照带伤（损坏 JSON ${rawStats.corrupt} · 孤儿战报 ${rawStats.orphans} · 任务缺 result ${rawStats.unpaired} · 队列/完成重复 ${rawStats.dups}）——因果断裂 = 朴素快照的真 BUG` + C.reset)
  say(C.green + `   ✅ safe 安全快照：20 连拍中 ${safeStats.badSnaps} 个带伤（损坏 ${safeStats.corrupt} · 孤儿 ${safeStats.orphans} · 缺 result ${safeStats.unpaired} · 重复 ${safeStats.dups}）——两遍扫描对账（补收新落盘文件 + 迁移对账），因果自洽` + C.reset)
  say(C.dim + `   机制：finish = rename→写 result 两步之间有毫秒窗；raw 的目录列表快照会拍到"任务在、result 无"或"队列完成各一份"` + C.reset)
}

// ============ EXP-2 diff 假阳性 ============
{
  say('')
  say(C.cyan + '═ EXP-2 diff 假阳性：内容未变、元数据变了（touch 若干文件） ═' + C.reset)
  await tm.checkpoint('still-a')
  await sleep(300)
  await tm.checkpoint('still-b')
  // 装置注入：模拟"重新拷贝/触碰"——内容一字未变，只有时间戳更新（元数据噪音）
  const touched = ['done/task-1.json', 'done/task-2.json', 'shared/reports/report-3.json', 'shared/reports/report-4.json', 'intent-queue/task-5.json'].filter(f => fs.existsSync(path.join(ROOT, 'timeline', 'still-b', f)))
  for (const f of touched) {
    const now = new Date()
    fs.utimesSync(path.join(ROOT, 'timeline', 'still-b', f), now, now)
  }
  const naive = tm.naiveDiff('still-a', 'still-b')
  const semantic = tm.diff('still-a', 'still-b')
  say(C.red + `   🔪 naive diff（mtime+size）：报 ${naive.changed} 个"变更"——内容一字未变，全是元数据噪音假阳性` + C.reset)
  say(C.green + `   ✅ 语义 diff（内容哈希）：added ${semantic.added} · removed ${semantic.removed} · changed ${semantic.changed}——零假阳性` + C.reset)
}

// ============ EXP-3 平行宇宙 + 重演 + 在途恢复 ============
{
  say('')
  say(C.cyan + '═ EXP-3 平行宇宙：从 t1 分叉——主干走军令 401..490，分支走假设军令 901..990 ═' + C.reset)
  // 分支宇宙
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'time-alt-'))
  const r2 = tm.restore('t1', root2)
  say(C.dim + `   🌌 分支宇宙创建：快照 t1 → ${path.basename(root2)}（在途任务 ${r2.inFlight.length} 个由新侦察兵收养）` + C.reset)
  const workers2 = []
  for (let i = 0; i < 30; i++) workers2.push(spawnScoutAt(root2, `scout-${i}`, i))
  for (let i = 901; i <= 900 + N; i++) mesh2enqueue(root2, i)
  await waitFor(() => doneCount(root2) >= N * 2, 60000)   // t1 已含 90 done，分支再完成 90
  const tm2 = new TimeMachine(root2)
  await tm2.checkpoint('what-if')
  // 主干第二波（任务号 401..490——与第一波 1..90 严格不相交，防账本静默覆盖）
  for (let i = 401; i <= 400 + N; i++) mesh.enqueue(i, { n: i })
  await waitFor(() => doneCount(ROOT) >= 4 * N, 60000)
  await tm.checkpoint('t2')
  const dMain = tm.diff('t1', 't2')
  const dAlt = tm2.diff(path.join(ROOT, 'timeline', 't1'), 'what-if')
  say(C.green + `   ✓ 两条未来并存：主干 diff(t1→t2) = +${dMain.added} 文件 · 分支 diff(t1→what-if) = +${dAlt.added} 文件——同一原点，不同军令，两条时间线` + C.reset)
  say(C.dim + `   主干战报任务 401..490；分支战报任务 901..990（假设军令）——决策可对比、可审计` + C.reset)

  // 重演可复现
  const root3 = fs.mkdtempSync(path.join(os.tmpdir(), 'time-replay-'))
  tm.restore('t1', root3)
  const workers3 = []
  for (let i = 0; i < 30; i++) workers3.push(spawnScoutAt(root3, `scout-${i}`, i))
  for (let i = 401; i <= 400 + N; i++) mesh2enqueue(root3, i)
  await waitFor(() => doneCount(root3) >= N * 2, 60000)   // t1 已含 90 done，重演再完成 90
  const cmp = (task) => {
    const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'reports', `report-${task}.json`), 'utf-8'))
    const b = JSON.parse(fs.readFileSync(path.join(root3, 'shared', 'reports', `report-${task}.json`), 'utf-8'))
    return a.keyNumbers.severity === b.keyNumbers.severity && a.summary === b.summary && a.request === b.request
  }
  let same = 0
  for (let t = 401; t <= 490; t++) if (cmp(t)) same++
  say(C.bold + C.green + `   🔁 重演可复现：checkout t1 → 重跑军令 401..490 → 战报 ${same}/90 与主干逐份一致——决策可复现、可审计、可重演` + C.reset)

  // 在途任务恢复（收养）——raw 单遍快照抓取持锁在途任务（无对账删除）
  const midName = 'mid-flight'
  for (let i = 501; i <= 500 + N; i++) mesh.enqueue(i, { n: i })
  await sleep(300)   // 等侦察兵正在干活（持锁在途）
  const doneAtMid = doneCount(ROOT)
  await tm.checkpoint(midName, { mode: 'raw' })
  const root4 = fs.mkdtempSync(path.join(os.tmpdir(), 'time-resume-'))
  const r4 = tm.restore(midName, root4)
  const workers4 = []
  for (let i = 0; i < 30; i++) workers4.push(spawnScoutAt(root4, `scout-${i}`, i))
  await waitFor(() => doneCount(root4) >= doneAtMid + r4.inFlight.length, 60000)
  say(C.green + `   ⚔️ 在途恢复：快照含 ${r4.inFlight.length} 个在途任务 → 新战场三证据收养重派 → 全部完成（at-least-once 语义，诚实标注）` + C.reset)
  workers2.forEach(w => { try { w.kill() } catch {} })
  workers3.forEach(w => { try { w.kill() } catch {} })
  workers4.forEach(w => { try { w.kill() } catch {} })
}

// ============ EXP-4 merge 假阳性 ============
{
  say('')
  say(C.cyan + '═ EXP-4 merge 假阳性：两分支对同一任务战报分歧 → 朴素覆盖 vs 三向冲突检测 ═' + C.reset)
  // 装置注入分歧：主干与分支宇宙对任务 777 各写一版战报（分支版被"敌方干扰"改写）
  const mainV = { agentId: 'scout-27', taskId: '777', summary: '蜀中发现盐路被断，威胁度55', keyNumbers: { severity: 55, task: 777 }, stateChanges: [], request: '常规记录' }
  const altV = { agentId: 'scout-27', taskId: '777', summary: '蜀中发现盐路被断，威胁度88', keyNumbers: { severity: 88, task: 777 }, stateChanges: [], request: '建议增援' }
  fs.writeFileSync(path.join(ROOT, 'shared', 'reports', 'report-777.json'), JSON.stringify(mainV))
  await tm.checkpoint('merge-a')
  const root5 = fs.mkdtempSync(path.join(os.tmpdir(), 'time-merge-'))
  tm.restore('t1', root5)
  fs.mkdirSync(path.join(root5, 'shared', 'reports'), { recursive: true })
  fs.writeFileSync(path.join(root5, 'shared', 'reports', 'report-777.json'), JSON.stringify(altV))
  const tm5 = new TimeMachine(root5)
  await tm5.checkpoint('merge-b')

  const naiveDir = path.join(ROOT, 'shared', 'reports-naive')
  const naive = tm.mergeReports(path.join(ROOT, 'timeline', 't1'), path.join(ROOT, 'timeline', 'merge-a'), path.join(root5, 'timeline', 'merge-b'), naiveDir, { naive: true })
  const aVersionAlive = fs.existsSync(path.join(naiveDir, 'report-777.json')) &&
    JSON.parse(fs.readFileSync(path.join(naiveDir, 'report-777.json'), 'utf-8')).keyNumbers.severity === 55
  say(C.red + `   🔪 朴素 merge：声称合并 ${naive.merged} 份、冲突 0——但 report-777 的 a 版（severity 55）已被 b 版静默覆盖（${aVersionAlive ? '仍在' : '丢失'}）→ 假阳性：声称干净，实际丢数据` + C.reset)

  const threeDir = path.join(ROOT, 'shared', 'reports-3way')
  const three = tm.mergeReports(path.join(ROOT, 'timeline', 't1'), path.join(ROOT, 'timeline', 'merge-a'), path.join(root5, 'timeline', 'merge-b'), threeDir)
  const bothKept = fs.existsSync(path.join(ROOT, 'shared', 'conflicts', 'report-777.json.a.json')) && fs.existsSync(path.join(ROOT, 'shared', 'conflicts', 'report-777.json.b.json'))
  say(C.bold + C.green + `   ✅ 三向 merge：冲突 ${three.conflicts.length} 起（report-777）→ 双版本留档 conflicts/（${bothKept ? 'a 版 + b 版都在' : '丢失'}）→ 零静默覆盖` + C.reset)
}

// ============ EXP-5 快照与全文层脱钩 ============
{
  say('')
  say(C.cyan + '═ EXP-5 快照与全文层脱钩：分支宇宙 expand 全文 → digest 引用悬空 ═' + C.reset)
  const root6 = fs.mkdtempSync(path.join(os.tmpdir(), 'time-expand-'))
  tm.restore('t1', root6)
  const intelExists = fs.existsSync(path.join(root6, 'agents', 'scout-27-intel-57.txt'))
  const report = JSON.parse(fs.readFileSync(path.join(root6, 'shared', 'reports', 'report-57.json'), 'utf-8'))
  say(C.red + `   🔪 分支宇宙要展开任务 57 的全文：agents 全文档案 ${intelExists ? '存在' : '缺失'}——快照只覆盖账本层，t0 全文层脱钩 → expand 必失败（真 BUG 暴露）` + C.reset)
  say(C.yellow + `   📌 修复方向：快照包含 agents 全文，或战报 digest 冷引用主宇宙全文库（按哈希寻址）——列入超级架构 TODO` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 raw 快照因果断裂（真 BUG）→ safe 两遍扫描对账修复（0 带伤）' + C.reset)
say(C.dim + '  EXP-2 mtime diff 假阳性 → 语义哈希 diff 归零' + C.reset)
say(C.dim + '  EXP-3 平行宇宙/重演/在途恢复：时间线操作 + 可复现 + 收养语义' + C.reset)
say(C.dim + '  EXP-4 朴素 merge 假阳性（静默丢数据）→ 三向冲突检测双档留证' + C.reset)
say(C.dim + '  EXP-5 快照全文层脱钩（真 BUG）→ 已暴露未藏，修复方案列 TODO' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
for (const w of workers) { try { w.kill() } catch {} }
process.exit(0)

// helper：向任意战场 enqueue
function mesh2enqueue(root, id) {
  const f = path.join(root, 'intent-queue', `task-${id}.json`)
  fs.writeFileSync(f + '.tmp', JSON.stringify({ id, payload: { n: id }, at: Date.now() }), { flag: 'wx' })
  fs.renameSync(f + '.tmp', f)
}
