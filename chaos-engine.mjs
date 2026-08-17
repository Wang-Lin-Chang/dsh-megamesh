// dsh-mesh/chaos-engine.mjs —— 混沌引擎：战场空则原地重建 → 派任务 → 随机 kill -9 自己 → 补位自愈 → 验证恢复
// 单次演练（自包含，适合每日调度）：ensureBattlefield（脑死补脑、兵缺补兵、无场建场）→ enqueue N 任务
//   → 受害者池（现任主席 + 持锁侦察兵）随机选一 kill -9 → 自愈（收养+补位）→ 观察恢复 → 混沌报告 + 历史账本
// 恢复标准：主席案 = 新任期上任；侦察兵案 = 任务被三证据收养重派且完成
// argv: <meshRoot> [extraTasks=20] [watchMs=30000]（不传 root 则每日自建新战场）
import { MeshCore } from './mesh-core.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))   // 子进程脚本绝对路径（调度任务 cwd 无关）

const [rootArg, tasksArg, watchArg] = process.argv.slice(2)
const root = (rootArg && rootArg.trim() !== '') ? rootArg : fs.mkdtempSync(path.join(os.tmpdir(), 'chaos-'))   // 无参 = 自建新战场
const N_TASKS = Number(tasksArg ?? 20)
const WATCH_MS = Number(watchArg ?? 30000)
const mesh = new MeshCore(root)
for (const d of ['shared/reports', 'shared/chaos', 'shared/consensus/decrees']) fs.mkdirSync(path.join(root, d), { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const termPath = path.join(root, 'shared', 'consensus', 'term.lock')
const parseTerm = () => {
  try {
    const m = /^(.+):(\d+):(\d+):(\d+)$/.exec(fs.readFileSync(termPath, 'utf-8').trim())
    return m ? { brainId: m[1], pid: Number(m[2]), startSec: Number(m[3]), term: Number(m[4]) } : null
  } catch { return null }
}
const doneCount = () => fs.readdirSync(path.join(root, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
const isAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const loggedPids = (prefix) => {
  const out = new Map()
  for (const f of fs.readdirSync(path.join(root, 'agents')).filter(f => f.startsWith(prefix) && f.endsWith('.log'))) {
    const m = /started pid=(\d+)/.exec(fs.readFileSync(path.join(root, 'agents', f), 'utf-8'))
    if (m) out.set(f.replace(/\.log$/, ''), Number(m[1]))
  }
  return out
}
const waitFor = async (fn, timeoutMs, everyMs = 200) => {
  const t0 = Date.now()
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() - t0 > timeoutMs) return null
    await sleep(everyMs)
  }
}
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🐒 混沌演练：战场重建 → 随机 kill -9 → 补位自愈 → 验证    ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  不被动等崩——主动杀自己。恢复不了？写进混沌报告，人来看。' + C.reset)
say('')

// ---------- 1. ensureBattlefield：脑死补脑、兵缺补兵、无场建场 ----------
{
  say(C.cyan + '⚙️ 战场体检（脑死补脑 · 兵缺补兵 · 无场建场）' + C.reset)
  const brains = loggedPids('brain-')
  const aliveBrains = [...brains.entries()].filter(([, pid]) => isAlive(pid))
  const chair = parseTerm()
  if (chair !== null && isAlive(chair.pid)) {
    say(C.green + `   ✓ 现任主席 ${chair.brainId}（term ${chair.term}）在世，无需补脑` + C.reset)
  } else {
    for (const id of ['brain-alpha', 'brain-beta', 'brain-gamma']) spawn(process.execPath, [path.join(HERE, 'federal-brain.mjs'), root, id], { stdio: 'ignore', windowsHide: true })
    say(C.yellow + `   🔧 脑池补员 3 名（原地重建/补位，任期从 decree 续号）` + C.reset)
  }
  const scouts = loggedPids('scout-')
  const aliveScouts = [...scouts.entries()].filter(([, pid]) => isAlive(pid))
  if (aliveScouts.length < 30) {
    const missing = new Set()
    for (let i = 0; i < 30; i++) missing.add(`scout-${i}`)
    for (const [id] of aliveScouts) missing.delete(id.split('-reborn')[0])
    for (const id of missing) {
      const i = Number(id.split('-')[1])
      spawn(process.execPath, [path.join(HERE, 'scout-worker.mjs'), root, id, `${i}/30`, 'report'], { stdio: 'ignore', windowsHide: true })
    }
    say(C.yellow + `   🔧 侦察兵补员 ${missing.size} 名（现役 ${aliveScouts.length + missing.size}/30）` + C.reset)
  } else {
    say(C.green + `   ✓ 侦察兵满编 ${aliveScouts.length}/30` + C.reset)
  }
  await sleep(1200)
}

// ---------- 2. 派任务 ----------
const base = Date.now() % 1000000
for (let i = 0; i < N_TASKS; i++) mesh.enqueue(base + i, { n: base + i })
say(C.cyan + `⚡ 新派 ${N_TASKS} 侦察任务（id ${base}..${base + N_TASKS - 1}）` + C.reset)

// ---------- 3. 受害者采样（锁一出现立即锁定目标，验证仍持锁后击杀） ----------
let victim = null
const forceRole = process.env.CHAOS_ROLE   // 测试钩子：CHAOS_ROLE=chair|scout 强制角色（默认随机）
for (let i = 0; i < 60 && victim === null; i++) {
  const chair = parseTerm()
  if (chair && isAlive(chair.pid) && forceRole !== 'scout' && Math.random() < 0.25) victim = { role: 'chair', id: chair.brainId, pid: chair.pid, term: chair.term, task: null }
  if (victim === null && forceRole !== 'chair') {
    const holders = []
    for (const f of fs.readdirSync(path.join(root, 'intent-queue'))) {
      if (!f.endsWith('.lock')) continue
      const taskId = f.replace(/^task-/, '').replace(/\.lock$/, '')
      const m = /^(.+):(\d+):/.exec(mesh.readLock(taskId))
      if (m && isAlive(Number(m[2]))) holders.push({ role: 'scout', id: m[1], pid: Number(m[2]), task: taskId })
    }
    if (holders.length > 0) victim = holders[Math.floor(Math.random() * holders.length)]
  }
  if (victim === null) await sleep(100)
}
if (victim === null) {
  say(C.yellow + '   无活受害者可杀（任务已全部完成）→ 演练终止' + C.reset)
  process.exit(0)
}
// 击杀前复核：侦察兵必须仍持锁，主席必须仍当任
if (victim.role === 'scout') {
  const lock = mesh.readLock(victim.task)
  if (!lock.startsWith(victim.id + ':')) { say(C.yellow + '   （目标已释放锁，跳过击杀）→ 演练终止' + C.reset); process.exit(0) }
} else {
  const t = parseTerm()
  if (t === null || t.pid !== victim.pid) { say(C.yellow + '   （主席已换届，跳过击杀）→ 演练终止' + C.reset); process.exit(0) }
}
const doneBefore = doneCount()
say(C.red + `💀 随机击杀：${victim.role === 'chair' ? '主席 ' : '侦察兵 '}${victim.id}（pid ${victim.pid}${victim.task ? '，持锁任务 ' + victim.task : '，任期 ' + victim.term}）→ KILL -9` + C.reset)
const tKill = Date.now()
try { process.kill(victim.pid, 'SIGKILL') } catch {}

// ---------- 4. 自愈 + 恢复验证 ----------
let report
if (victim.role === 'chair') {
  spawn(process.execPath, [path.join(HERE, 'federal-brain.mjs'), root, 'brain-epsilon'], { stdio: 'ignore', windowsHide: true })
  const newChair = await waitFor(() => {
    const t = parseTerm()
    return t && t.term > victim.term ? t : null
  }, WATCH_MS)
  const recovered = newChair !== null
  report = {
    at: Date.now(), victim: { role: 'chair', id: victim.id, pid: victim.pid, term: victim.term },
    recovery: {
      recovered, switchMs: recovered ? Date.now() - tKill : null,
      evidence: recovered ? `新主席 ${newChair.brainId} 接任 term ${newChair.term}（补位脑 brain-epsilon）` : '无新任期（恢复失败）',
      doneBefore, doneAfter: doneCount(),
    },
  }
} else {
  const shard = Number(victim.task) % 30
  await sleep(300)
  const swept = mesh.sweep()
  spawn(process.execPath, [path.join(HERE, 'scout-worker.mjs'), root, `${victim.id}-reborn`, `${shard}/30`, 'report'], { stdio: 'ignore', windowsHide: true })
  const taskDone = await waitFor(() => fs.existsSync(path.join(root, 'done', `task-${victim.task}.json`)), WATCH_MS)
  const adopted = swept.some(s => s.taskId === victim.task)
  const recovered = taskDone === true && adopted
  report = {
    at: Date.now(), victim: { role: 'scout', id: victim.id, pid: victim.pid, task: victim.task },
    recovery: {
      recovered, switchMs: recovered ? Date.now() - tKill : null,
      evidence: recovered ? `三证据收养任务 ${victim.task}（dead-letter 存档）→ 补位兵接手 → 完成` : `收养=${adopted} 任务完成=${taskDone === true}`,
      doneBefore, doneAfter: doneCount(),
    },
  }
}

// ---------- 5. 混沌报告 + 历史账本 ----------
const reportPath = path.join(root, 'shared', 'chaos', `chaos-${Date.now()}.json`)
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
fs.appendFileSync(path.join(root, 'shared', 'chaos', 'history.jsonl'), JSON.stringify(report) + '\n')
if (process.env.CHAOS_HISTORY) fs.appendFileSync(process.env.CHAOS_HISTORY, JSON.stringify(report) + '\n')   // 跨战场累计账本（30 天认证链）
say('')
say(report.recovery.recovered
  ? C.bold + C.green + `✅ 恢复验证通过（${report.recovery.evidence} · 耗时 ${report.recovery.switchMs} ms · done ${report.recovery.doneBefore}→${report.recovery.doneAfter}）` + C.reset
  : C.bold + C.red + `❌ 恢复失败（${report.recovery.evidence}）→ 混沌报告存证待人工分析` + C.reset)
say(C.dim + `  混沌报告: ${reportPath}` + C.reset)
say(C.dim + `  战场: ${root}` + C.reset)
process.exit(report.recovery.recovered ? 0 : 1)
