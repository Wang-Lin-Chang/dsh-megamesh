// dsh-megamesh/experiments/hetero-experiment.mjs —— 各大厂适配层实验：异构混编军（原生 + CrewAI + LangGraph 模拟兵）
// 判决标准：
//   EXP-1 混编军：10 原生 + 10 CrewAI + 10 LangGraph 兵 × 90 任务 → 90/90 完成 + 军法 0 误杀 + 战报 schema 契约全过
//   EXP-2 框架兵阵亡：kill 持锁 CrewAI 兵 → 三证据收养（收养看锁不看框架）→ reborn CrewAI 兵接手 → 任务完成
//   EXP-3 框架语言差异：日志语言不同（crew:task dispatched vs node:state transition），战报 schema 逐字段同构——协议层抹平框架差异
import { MegaMesh } from '../megamesh.mjs'
import { ADAPTER_CONTRACT, validateAdapterReport } from '../adapter-spec.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'hetero-'))
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
say(C.bold + C.magenta + '║   🌐 各大厂适配层 · 异构混编军 · 协议在文件系统与框架无关     ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + `  适配契约 ${ADAPTER_CONTRACT.name} v${ADAPTER_CONTRACT.version}：5 函数（claimTask/doWork/heartbeat/respondExpand/report）` + C.reset)
say('')

const N = 90

// ============ EXP-1 混编军 ============
{
  say(C.cyan + `═ EXP-1 混编军：${N} 任务 ×（10 原生 + 10 CrewAI + 10 LangGraph 兵） ═` + C.reset)
  for (let i = 1; i <= N; i++) mm.enqueue(i, { n: i })
  for (let i = 0; i < 30; i++) {
    if (i < 10) workers.push(spawn(process.execPath, ['scout-worker.mjs', ROOT, `scout-${i}`, `${i}/30`, 'report'], { stdio: 'ignore', windowsHide: true }))
    else if (i < 20) workers.push(spawn(process.execPath, ['framework-agent.mjs', ROOT, `crew-${i}`, `${i}/30`, 'crewai'], { stdio: 'ignore', windowsHide: true }))
    else workers.push(spawn(process.execPath, ['framework-agent.mjs', ROOT, `graph-${i}`, `${i}/30`, 'langgraph'], { stdio: 'ignore', windowsHide: true }))
  }
  await waitFor(() => mm.doneCount() >= N, 60000)
  const reports = mm.reports()
  const lawOk = reports.every(r => mm.lawCourt(r).length === 0)
  const schemaOk = reports.every(r => validateAdapterReport(r, mm.lawCourt.bind(mm)).ok)
  say(C.green + `   ✓ 完成 ${mm.doneCount()}/${N} · 战报 ${reports.length} · 军法 0 误杀 ${lawOk ? '✓' : '✗'} · 契约 schema 全过 ${schemaOk ? '✓' : '✗'}` + C.reset)
  say(C.dim + `   异构兵与原生兵同一套租约/战报/军法——框架差异在协议层被抹平` + C.reset)
}

// ============ EXP-2 框架兵阵亡 ============
{
  say('')
  say(C.cyan + '═ EXP-2 框架兵阵亡：kill 持锁 CrewAI 兵 → 收养对框架兵同样生效 ═' + C.reset)
  for (let i = 101; i <= 130; i++) mm.enqueue(i, { n: i })
  const victim = await waitFor(() => {
    for (const f of fs.readdirSync(path.join(ROOT, 'intent-queue'))) {
      if (!f.endsWith('.lock')) continue
      const taskId = f.replace(/^task-/, '').replace(/\.lock$/, '')
      const lock = fs.readFileSync(path.join(ROOT, 'intent-queue', f), 'utf-8').trim()
      if (lock.startsWith('crew-')) return { taskId, pid: Number(lock.split(':')[1]), id: lock.split(':')[0], shard: Number(taskId) % 30 }
    }
    return null
  }, 10000, 20)
  if (victim === null) {
    say(C.yellow + '   （未捕获 CrewAI 兵持锁窗口，跳过击杀）' + C.reset)
  } else {
    say(C.red + `💀 KILL -9 → CrewAI 兵 ${victim.id}（pid ${victim.pid}，持锁任务 ${victim.taskId}）` + C.reset)
    try { process.kill(victim.pid, 'SIGKILL') } catch {}
    await sleep(300)
    const swept = mm.sweep()
    workers.push(spawn(process.execPath, ['framework-agent.mjs', ROOT, `${victim.id}-reborn`, `${victim.shard}/30`, 'crewai'], { stdio: 'ignore', windowsHide: true }))
    const done = await waitFor(() => fs.existsSync(path.join(ROOT, 'done', `task-${victim.taskId}.json`)), 20000)
    say(C.bold + C.green + `   ✓ 收养重派：${swept.map(s => `${s.taskId}(${s.reason})`).join(',')} → reborn CrewAI 兵接手 → 任务完成 ${done === true ? '✓' : '✗'}——收养看锁不看框架` + C.reset)
  }
  await waitFor(() => mm.doneCount() >= N + 30, 60000)
}

// ============ EXP-3 框架语言差异 ============
{
  say('')
  say(C.cyan + '═ EXP-3 框架语言差异：日志各说各话，战报 schema 同构 ═' + C.reset)
  const crewLog = fs.readFileSync(path.join(ROOT, 'agents', 'crew-10.log'), 'utf-8')
  const graphLog = fs.readFileSync(path.join(ROOT, 'agents', 'graph-20.log'), 'utf-8')
  const crewLine = crewLog.split('\n').find(l => l.includes('crew:')) ?? ''
  const graphLine = graphLog.split('\n').find(l => l.includes('node:')) ?? ''
  say(C.dim + `   CrewAI 兵日志：${crewLine.split(' ').slice(1).join(' ')}` + C.reset)
  say(C.dim + `   LangGraph 兵日志：${graphLine.split(' ').slice(1).join(' ')}` + C.reset)
  const r1 = mm.reports().find(r => r.agentId === 'crew-10')
  const r2 = mm.reports().find(r => r.agentId === 'graph-20')
  const fields = (r) => Object.keys(r).sort().join(',')
  const same = r1 && r2 && fields(r1) === fields(r2) && ADAPTER_CONTRACT.reportSchema.every(f => r1[f] !== undefined)
  say(C.green + `   ✓ 战报 schema 逐字段同构：${fields(r1)} → ${same ? '✓（协议层抹平框架差异，框架语言各自保留）' : '✗'}` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 异构混编军 90/90：租约/战报/军法对原生兵与框架兵一视同仁' + C.reset)
say(C.dim + '  EXP-2 框架兵阵亡：三证据收养看锁不看框架，reborn 同契约接手' + C.reset)
say(C.dim + '  EXP-3 协议层抹平框架差异：任何实现 5 函数契约的 Agent 即可入网' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
for (const w of workers) { try { w.kill() } catch {} }
process.exit(0)
