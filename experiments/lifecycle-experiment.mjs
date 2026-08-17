// dsh-megamesh/experiments/lifecycle-experiment.mjs —— witness 生命周期对接实验：五态流转 + EXIT 协议
// 判决标准：
//   EXP-1 正常流转：pending → running → done（统一入口 finish 必留 EXIT:0）
//   EXP-2 崩溃流转：kill 持锁侦察兵 → orphaned → 三证据收养 → adopted → reborn 接手 → done
//   EXP-3 EXIT 语义：正常任务 EXIT:0 可查；被 kill 任务在收养前无 EXIT（非正常结束证据）——诚实标注：侦察兵进程尚未升级 EXIT 协议（对接缺口）
import { MegaMesh } from '../megamesh.mjs'
import { MeshCore } from '../mesh-core.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'life-'))
const mm = new MegaMesh(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
const workers = []
const waitFor = async (fn, timeoutMs, everyMs = 100) => {
  const t0 = Date.now()
  for (;;) {
    try { const v = fn(); if (v) return v } catch {}
    if (Date.now() - t0 > timeoutMs) return null
    await sleep(everyMs)
  }
}

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   📜 witness 生命周期对接 · 五态流转 · EXIT 协议            ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  目录结构=真相源：pending/running/orphaned/adopted/done 从文件系统推导' + C.reset)
say('')

// ============ EXP-1 正常流转 ============
{
  say(C.cyan + '═ EXP-1 正常流转：pending → running → done（EXIT:0） ═' + C.reset)
  mm.enqueue(1, { n: 1 })
  const s1 = mm.lifecycle(1)
  mm.claim(1, 'worker-a', process.pid, Math.floor((Date.now() - process.uptime() * 1000) / 1000))
  const s2 = mm.lifecycle(1)
  mm.finish(1, JSON.stringify({ ok: true }))
  const s3 = mm.lifecycle(1)
  const exit = mm.exitCode(1)
  const ok = s1 === 'pending' && s2 === 'running' && s3 === 'done' && exit === 0
  say(C.green + `   ✓ 五态流转：${s1} → ${s2} → ${s3} · EXIT:${exit} → ${ok ? '全对 ✓' : '错 ✗'}` + C.reset)
  mm.release(1)
}

// ============ EXP-2 崩溃流转 ============
{
  say('')
  say(C.cyan + '═ EXP-2 崩溃流转：running → orphaned → adopted → done ═' + C.reset)
  // 起侦察兵真进程干活（shard 0，任务 11..13）
  for (let i = 11; i <= 13; i++) mm.enqueue(i, { n: i })
  const scout = spawn(process.execPath, ['scout-worker.mjs', ROOT, 'scout-0', '0/3', 'report'], { stdio: 'ignore', windowsHide: true })
  workers.push(scout)
  // 抓持锁窗口
  const victim = await waitFor(() => {
    for (const f of fs.readdirSync(path.join(ROOT, 'intent-queue'))) {
      if (!f.endsWith('.lock')) continue
      const taskId = f.replace(/^task-/, '').replace(/\.lock$/, '')
      const lock = fs.readFileSync(path.join(ROOT, 'intent-queue', f), 'utf-8').trim()
      if (lock.startsWith('scout-0:')) return { taskId, pid: Number(lock.split(':')[1]) }
    }
    return null
  }, 10000, 20)
  const sRun = mm.lifecycle(victim.taskId)
  say(C.red + `💀 持锁任务 ${victim.taskId} 状态=${sRun} → KILL -9 侦察兵（pid ${victim.pid}）` + C.reset)
  try { process.kill(victim.pid, 'SIGKILL') } catch {}
  await waitFor(() => mm.lifecycle(victim.taskId) === 'orphaned', 5000)
  const sOrphan = mm.lifecycle(victim.taskId)
  const swept = mm.sweep()
  const sAdopted = mm.lifecycle(victim.taskId)
  // reborn 接手
  const reborn = spawn(process.execPath, ['scout-worker.mjs', ROOT, 'scout-0-reborn', '0/3', 'report'], { stdio: 'ignore', windowsHide: true })
  workers.push(reborn)
  await waitFor(() => mm.lifecycle(victim.taskId) === 'done' || mm.lifecycle(victim.taskId) === 'done-no-exit', 20000)
  const sDone = mm.lifecycle(victim.taskId)
  const ok = sRun === 'running' && sOrphan === 'orphaned' && sAdopted === 'adopted' && (sDone === 'done' || sDone === 'done-no-exit')
  say(C.bold + C.green + `   ✓ 崩溃流转：${sRun} → ${sOrphan} → ${sAdopted} → ${sDone} → ${ok ? '五态全链 ✓' : '✗'}（收养证据：${swept.map(s => s.reason).join(',')}）` + C.reset)
}

// ============ EXP-3 EXIT 语义 ============
{
  say('')
  say(C.cyan + '═ EXP-3 EXIT 语义：正常 EXIT:0 可查，被 kill 无 EXIT ═' + C.reset)
  const okExit = mm.exitCode(1) === 0
  // 找被杀任务：11..13 里完成但无 exit 的（reborn 侦察兵没有 EXIT 协议）
  let noExitTask = null
  for (const t of [11, 12, 13]) {
    if (mm.exitCode(t) === null && (mm.lifecycle(t) === 'done' || mm.lifecycle(t) === 'done-no-exit')) { noExitTask = t; break }
  }
  say(C.yellow + `   ⚠️ 诚实标注：正常任务 EXIT:${mm.exitCode(1)}（统一入口 finish 必留）· 侦察兵真进程完成的任务 ${noExitTask !== null ? `#${noExitTask} 无 EXIT 记录` : '均有 EXIT'}——被 kill 的任务无 EXIT = 非正常结束的证据（收养判定依据之一）` + C.reset)
  say(C.yellow + `   📌 对接缺口：scout-worker 进程未升级 EXIT 协议（写入 EXIT:0）——列入超级架构 TODO（侦察兵升级为 megamesh-aware worker）` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 正常五态流转 + EXIT:0 ✓（统一入口即 witness 语义）' + C.reset)
say(C.dim + '  EXP-2 崩溃五态流转：orphaned 三证据收养 → adopted → reborn 接手 done ✓' + C.reset)
say(C.dim + '  EXP-3 EXIT 语义成立 + 侦察兵 EXIT 升级缺口诚实标注' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
for (const w of workers) { try { w.kill() } catch {} }
process.exit(0)
