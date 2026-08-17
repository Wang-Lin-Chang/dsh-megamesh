// dsh-megamesh/adapters/langgraph-worker.mjs —— LangGraph 真库兵进程：5 函数契约循环
// claimTask（O_EXCL 租约）→ doWork（真实 LangGraph 图 invoke）→ report 落账（过军法由消费者把关）→ heartbeat
// argv: <root> <agentId> <shard i/n>
import { MeshCore } from '../mesh-core.mjs'
import { probeLangGraph, buildScoutGraph } from './langgraph-adapter.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'

const [root, agentId, shardSpec] = process.argv.slice(2)
const shard = Number(shardSpec.split('/')[0])
const totalShards = Number(shardSpec.split('/')[1])
const mesh = new MeshCore(root)
const log = (l) => fs.appendFileSync(path.join(mesh.root, 'agents', `${agentId}.log`), `${Date.now()} ${l}\n`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const held = new Set()
const hb = setInterval(() => { for (const t of held) mesh.heartbeat(t) }, mesh.heartbeatMs)

const probe = await probeLangGraph()
if (!probe.installed) {
  log(`framework missing: ${probe.hint} — refusing to join battlefield (graceful degradation)`)
  console.error(`[${agentId}] LangGraph not installed — refusing to join (${probe.hint})`)
  process.exit(2)   // 拒绝入网但不崩战场
}
const graph = await buildScoutGraph(log)
log(`started pid=${process.pid} langgraph=${probe.version} shard=${shardSpec}`)

async function run() {
  for (;;) {
    const tasks = mesh.pending().filter(t => Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await sleep(120); continue }
    if (!mesh.claim(task, agentId, process.pid, Math.floor((Date.now() - process.uptime() * 1000) / 1000))) { await sleep(80); continue }
    held.add(task)
    await sleep(150 + Math.random() * 200)
    // doWork = 真实 LangGraph 图执行（Pregel 运行时跑三节点）
    const state = await graph.invoke({ taskId: task })
    const report = { agentId, at: Date.now(), ...state.report }
    const fullText = `REGION:${report.stateChanges[0].target}\n` + Array.from({ length: 40 }, (_, i) => `情报详情第${i + 1}段：LangGraph 节点侦察记录（任务 ${task}）`).join('\n')
    fs.writeFileSync(path.join(mesh.root, 'agents', `${agentId}-intel-${task}.txt`), fullText)
    fs.writeFileSync(path.join(mesh.root, 'shared', 'reports', `report-${task}.json`), JSON.stringify(report))
    mesh.finish(task, JSON.stringify(report))
    mesh.release(task)
    held.delete(task)
    log(`node:compose_report done ${task} sev=${report.keyNumbers.severity}`)
  }
}
run().catch(e => log(`error ${e.message}`))
