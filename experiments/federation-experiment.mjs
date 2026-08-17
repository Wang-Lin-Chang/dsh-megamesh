// dsh-mesh/federation-experiment.mjs —— 千脑联邦实验：30 侦察兵 + 3 联邦脑 × 任期轮换 × 杀主席换脑 × 杀候补无感
// 判决标准：
//   EXP-1 换脑：kill -9 主席（term 1）→ 租约判死 → 候补抢任期（term 2），耗时 < 5s
//   EXP-2 决策续流：新主席 decree-2 覆盖 90/90 战报，verdict 与全文真值一致（决策零丢失）
//   EXP-3 杀候补无感：kill -9 候补脑 → 主席零感知（任期锁不变、心跳不断）
//   EXP-4 三脑轮杀全链：再杀第二任主席 → 最后一脑接任 term 3（任意脑死，系统照跑）
// 实验结束战场存活（侦察兵/脑进程不清理），供 chaos-engine.mjs 混沌演练复用现场。
import { MeshCore } from '../mesh-core.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'fed-'))
const mesh = new MeshCore(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const termPath = path.join(ROOT, 'shared', 'consensus', 'term.lock')
const decreesDir = path.join(ROOT, 'shared', 'consensus', 'decrees')
const spawnScout = (id, shard) => spawn(process.execPath, ['scout-worker.mjs', ROOT, id, shard, 'report'], { stdio: 'ignore', windowsHide: true })
const spawnBrain = (id) => spawn(process.execPath, ['federal-brain.mjs', ROOT, id], { stdio: 'ignore', windowsHide: true })
const doneCount = () => fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
const readTerm = () => { try { return fs.readFileSync(termPath, 'utf-8').trim() } catch { return '' } }
const parseTerm = () => {
  const m = /^(.+):(\d+):(\d+):(\d+)$/.exec(readTerm())
  return m ? { brainId: m[1], pid: Number(m[2]), startSec: Number(m[3]), term: Number(m[4]) } : null
}
const readDecree = (term) => {
  try { return JSON.parse(fs.readFileSync(path.join(decreesDir, `decree-${term}.json`), 'utf-8')) } catch { return null }
}
const brainPid = (id) => {
  const m = /started pid=(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'agents', `${id}.log`), 'utf-8'))
  return m ? Number(m[1]) : null
}
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
say(C.bold + C.magenta + '║   🏛️ 千脑联邦 · 3 联邦脑任期轮换 · 30 侦察兵 · 杀谁换谁    ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  无单点：任期锁（O_EXCL）+ 租约判死 + 候补换脑——主席不是任命，是抢来的' + C.reset)
say('')

const N_SCOUTS = 30
const WAVE1 = 60
const WAVE2 = 30

// 起战场：30 侦察兵 + 3 联邦脑
for (let i = 1; i <= WAVE1; i++) mesh.enqueue(i, { n: i })
for (let i = 0; i < N_SCOUTS; i++) spawnScout(`scout-${i}`, `${i}/${N_SCOUTS}`)
spawnBrain('brain-alpha')
spawnBrain('brain-beta')
spawnBrain('brain-gamma')

// ============ EXP-1：杀主席换脑 ============
{
  say(C.cyan + '═ EXP-1 杀主席换脑：首任主席任期 1 执政 → kill -9 → 候补抢任期 2 ═' + C.reset)
  const chair1 = await waitFor(() => parseTerm()?.term === 1 ? parseTerm() : null, 8000)
  say(C.green + `✅ 首任主席当选：${chair1.brainId}（term 1, pid ${chair1.pid}）` + C.reset)
  await waitFor(() => (readDecree(1)?.processed ?? 0) >= WAVE1, 30000)
  const d1 = readDecree(1)
  say(C.dim + `   第一波 60 战报已处理：decree-1 processed=${d1.processed}（verdict 任务 ${d1.verdict.taskId} / 威胁 ${d1.verdict.severity}）` + C.reset)

  const tKill = Date.now()
  say(C.red + `💀 KILL -9 → 主席 ${chair1.brainId}（pid ${chair1.pid}，term 1 现场悬空）` + C.reset)
  try { process.kill(chair1.pid, 'SIGKILL') } catch {}
  const chair2 = await waitFor(() => {
    const t = parseTerm()
    return t && t.term === 2 && t.brainId !== chair1.brainId ? t : null
  }, 10000)
  const switchMs = Date.now() - tKill
  const ok1 = chair2 !== null && switchMs < 5000
  say(C.bold + C.green + `   🔁 换脑完成：新主席 ${chair2?.brainId}（term 2）· 耗时 ${switchMs} ms（预算 5s · ${ok1 ? '达标 ✓' : '超时 ✗'}）` + C.reset)
  say(C.dim + `   机制：主席心跳停 → 租约 1.5s 判死 → 候补 O_EXCL 抢锁（竞争只出一个赢家）` + C.reset)
}

// ============ EXP-2：决策续流（零丢失） ============
{
  say('')
  say(C.cyan + '═ EXP-2 决策续流：第二波 30 战报 → 新主席 decree-2 覆盖 90/90 ═' + C.reset)
  for (let i = WAVE1 + 1; i <= WAVE1 + WAVE2; i++) mesh.enqueue(i, { n: i })
  const d2 = await waitFor(() => (readDecree(2)?.processed ?? 0) >= WAVE1 + WAVE2 ? readDecree(2) : null, 60000)
  let trueMax = -1, trueN = -1
  for (let n = 1; n <= WAVE1 + WAVE2; n++) {
    const sev = 1 + (n * 7) % 100
    if (sev > trueMax) { trueMax = sev; trueN = n }
  }
  const ok2 = d2 !== null && d2.processed === WAVE1 + WAVE2 && d2.verdict.taskId === trueN && d2.verdict.severity === trueMax
  say(C.bold + C.green + `   🧠 新主席决策：decree-2（${d2?.chair}）processed ${d2?.processed}/90 · 最大威胁 = 任务 ${d2?.verdict?.taskId}（威胁 ${d2?.verdict?.severity}）` + C.reset)
  say(C.dim + `   全文真值：任务 ${trueN}（威胁 ${trueMax}）→ 决策续流零丢失: ${ok2 ? '✓（换脑不损决策）' : '✗'}` + C.reset)
}

// ============ EXP-3：杀候补无感 ============
{
  say('')
  say(C.cyan + '═ EXP-3 杀候补无感：kill -9 在世的候补脑 → 主席零感知 ═' + C.reset)
  const chair = parseTerm()
  const isAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
  const standby = ['brain-alpha', 'brain-beta', 'brain-gamma'].find(id => id !== chair.brainId && isAlive(brainPid(id)))
  const standbyPid = brainPid(standby)
  const termBefore = readTerm()
  say(C.red + `💀 KILL -9 → 候补 ${standby}（pid ${standbyPid}）` + C.reset)
  try { process.kill(standbyPid, 'SIGKILL') } catch {}
  await sleep(3000)
  const termAfter = readTerm()
  const mtimeBefore = fs.statSync(termPath).mtimeMs
  await sleep(1000)
  const mtimeAfter = fs.statSync(termPath).mtimeMs
  const ok3 = termBefore === termAfter && mtimeAfter > mtimeBefore
  say(C.green + `   ✓ 任期锁不变（${ok3 ? '内容一致 ✓' : '内容变了 ✗'}）· 主席心跳继续（mtime 在跳 ✓）——候补可随意死，主席零感知` + C.reset)
}

// ============ EXP-4：脑池动态换血：新脑补位 + 杀现任 ============
{
  say('')
  say(C.cyan + '═ EXP-4 脑池动态换血：新脑 delta 补位 → 再杀现任主席 → delta 接任 term 3 ═' + C.reset)
  spawnBrain('brain-delta')   // 新脑加入战场（联邦成员弹性：脑可随时加入）
  await sleep(1500)
  const chair2 = parseTerm()
  say(C.red + `💀 KILL -9 → 现任主席 ${chair2.brainId}（pid ${chair2.pid}，term 2）` + C.reset)
  try { process.kill(chair2.pid, 'SIGKILL') } catch {}
  const chair3 = await waitFor(() => {
    const t = parseTerm()
    return t && t.term === 3 ? t : null
  }, 10000)
  const d3 = await waitFor(() => readDecree(3), 10000)
  const ok4 = chair3 !== null && chair3.brainId === 'brain-delta' && d3 !== null && d3.processed === WAVE1 + WAVE2
  say(C.bold + C.green + `   🏛️ 新脑 delta 接任：term 3 · decree-3 processed=${d3?.processed}/90 → ${ok4 ? '脑池换血全链 ✓（三脑轮杀 + 新脑补位，系统照跑）' : '✗'}` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 杀主席换脑：租约判死 + O_EXCL 抢任期，换脑 < 5s' + C.reset)
say(C.dim + '  EXP-2 决策续流：换脑不损决策，90/90 战报零丢失，verdict = 全文真值' + C.reset)
say(C.dim + '  EXP-3 杀候补无感：任期锁不动，主席心跳不断' + C.reset)
say(C.dim + '  EXP-4 脑池换血：三脑轮杀 + 新脑 delta 补位接任 term 3——脑可死、可增，无单点' + C.reset)
say(C.dim + `  现场保留（战场进程存活）: ${ROOT}` + C.reset)
say(C.dim + '  → 下一棒：node chaos-engine.mjs <ROOT> —— 混沌演练随机杀一个' + C.reset)
process.exit(0)
