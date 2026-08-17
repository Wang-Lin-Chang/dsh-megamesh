// dsh-mesh/agent-worker.mjs —— mesh worker 进程（被 demo 以真进程 spawn）
// 协议：poll 队列 → O_EXCL claim → 心跳 → 处理 → finish。可选 hang 模式（死循环实验）/ lazy 模式（处理慢）
// argv: <meshRoot> <agentId> [hang|lazy]
import { MeshCore } from './mesh-core.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'

const [root, agentId, mode = 'normal', shardSpec] = process.argv.slice(2)
const shard = shardSpec !== undefined ? Number(shardSpec.split('/')[0]) : null
const totalShards = shardSpec !== undefined ? Number(shardSpec.split('/')[1]) : null
const mesh = new MeshCore(root)
const outFile = path.join(mesh.root, 'agents', `${agentId}.log`)
const log = (line) => fs.appendFileSync(outFile, `${Date.now()} ${line}\n`)
log(`started pid=${process.pid} mode=${mode} shard=${shardSpec ?? '-'}`)

// 心跳循环
const hb = setInterval(() => {
  for (const t of held) mesh.heartbeat(t)
}, mesh.heartbeatMs)
const held = new Set()

async function work() {
  for (;;) {
    const tasks = mesh.pending().filter(t => shard === null || Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await new Promise(r => setTimeout(r, 150)); continue }
    if (!mesh.claim(task, agentId, process.pid, Math.floor(Date.now() / 1000))) { await new Promise(r => setTimeout(r, 100)); continue }
    held.add(task)
    log(`claimed ${task}`)
    if (mode === 'hang') { const t0 = Date.now(); while (Date.now() - t0 < 3600000) { /* 忙循环：事件循环真阻塞——心跳也停（真实死循环语义） */ } }
    const delay = mode === 'lazy' ? 1200 : 300
    await new Promise(r => setTimeout(r, delay))
    mesh.finish(task, `${agentId} processed ${task}`)
    mesh.release(task)   // 完工释放锁（残留锁会被 sweep 误判超时——mesh 实验抓出）
    held.delete(task)
    log(`finished ${task}`)
  }
}
work().catch(e => log(`error ${e.message}`))
process.on('SIGTERM', () => { clearInterval(hb); process.exit(0) })
