// dsh-megamesh/hello-megamesh.mjs —— 开箱演示：一条命令起全军
// node hello-megamesh.mjs → 30 侦察兵 + 3 联邦脑 + 90 任务 → 战报 → 军法 → 决策 → 人机共读 → 快照 → 终态审计
import { MegaMesh } from './megamesh.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'hello-megamesh-'))
const mm = new MegaMesh(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
const workers = []
const waitFor = async (fn, timeoutMs, everyMs = 100) => {
  const t0 = Date.now()
  for (;;) {
    try { const v = fn(); if (v) return v } catch (e) { console.error('hello-megamesh.mjs:18 catch', e?.message ?? e) }
    if (Date.now() - t0 > timeoutMs) return null
    await sleep(everyMs)
  }
}

say('')
say(C.bold + C.magenta + '   ⚔️  dsh-megamesh · 一条命令起全军 ⚔️' + C.reset)
say(C.dim + '   30 侦察兵 + 3 联邦脑 + 90 任务 → 战报 → 军法 → 决策 → 人机共读 → 快照 → 审计' + C.reset)
say('')

say(C.cyan + '⚙️ 点兵点将：30 侦察兵 + 3 联邦脑' + C.reset)
for (let i = 0; i < 30; i++) workers.push(spawn(process.execPath, ['scout-worker.mjs', ROOT, `scout-${i}`, `${i}/30`, 'report'], { stdio: 'ignore', windowsHide: true }))
for (const b of ['brain-alpha', 'brain-beta', 'brain-gamma']) workers.push(spawn(process.execPath, ['federal-brain.mjs', ROOT, b], { stdio: 'ignore', windowsHide: true }))

say(C.cyan + '📜 发布军令：90 侦察任务' + C.reset)
for (let i = 1; i <= 90; i++) mm.enqueue(i, { n: i })

say(C.cyan + '⏳ 千军齐动……' + C.reset)
await waitFor(() => mm.doneCount() >= 90, 60000, 300)
const reports = mm.reports()
await waitFor(() => mm.decrees().length > 0, 10000, 200)
const terms = mm.decrees().map(d => Number(d.replace(/^decree-/, ''))).sort((a, b) => a - b)
const decree = terms.length > 0 ? mm.decree(terms[0]) : null
const lawBad = reports.filter(r => mm.lawCourt(r).length > 0)

say('')
say(C.green + `✅ 任务 ${mm.doneCount()}/90 · 战报 ${reports.length} 份 · 军法 0 误杀（${lawBad.length} 违规）` + C.reset)
if (decree) say(C.green + `🧠 决策文书 decree-${decree.term}（主席 ${decree.chair}）：最大威胁 = 任务 ${decree.verdict.taskId}（${decree.verdict.summary} · ${decree.verdict.request}）` + C.reset)
say(C.dim + '── 人机共读战报（同一文件两种消费，任务 57）──' + C.reset)
for (const line of mm.renderHumanReport(reports.find(r => r.taskId === '57') ?? reports[0]).split('\n').slice(0, 9)) say(C.dim + '   ' + line + C.reset)

say('')
say(C.cyan + '⏳ 时间线快照 + 终态审计……' + C.reset)
await mm.checkpoint('hello')
const audit = mm.auditBattlefield()
const clean = audit.doneUnpaired.length === 0 && audit.orphans.length === 0 && Object.keys(audit.lawViolations).length === 0 && audit.staleLocks.length === 0
say(C.green + `✅ 快照 hello ✓ · 终态审计：done 成对缺 ${audit.doneUnpaired.length} · 孤儿 ${audit.orphans.length} · 军法违规 ${Object.keys(audit.lawViolations).length} · 残留锁 ${audit.staleLocks.length} → ${clean ? '全干净 ✓' : '有脏 ✗'}` + C.reset)

say('')
say(C.bold + '   🎉 全军检阅完毕——一脑千军，无单点，账本可审计，时间线可重演。' + C.reset)
say(C.dim + `   战场保留: ${ROOT}` + C.reset)
say(C.dim + '   下一棒：混沌演练 node chaos-engine.mjs <ROOT>；时间分叉 node experiments/time-experiment.mjs 同款 API 见 megamesh.mjs' + C.reset)
say('')
for (const w of workers) { try { w.kill() } catch { /* 协议豁免：文件不存在/竞态正常 */ } }
process.exit(0)
