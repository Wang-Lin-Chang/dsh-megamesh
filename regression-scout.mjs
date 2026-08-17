// dsh-megamesh/regression-scout.mjs —— 回归侦察兵：真实实验装置回归跑（一批实验 = 一个任务）
// argv: <root> <scoutId> <shard i/n>
import { MeshCore } from './mesh-core.mjs'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const [root, scoutId, shardSpec] = process.argv.slice(2)
const shard = Number(shardSpec.split('/')[0])
const totalShards = Number(shardSpec.split('/')[1])
const mesh = new MeshCore(root)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const log = (l) => fs.appendFileSync(path.join(mesh.root, 'agents', `${scoutId}.log`), `${Date.now()} ${l}\n`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const held = new Set()
const hb = setInterval(() => { for (const t of held) mesh.heartbeat(t) }, mesh.heartbeatMs)
log(`started pid=${process.pid} shard=${shardSpec}`)

async function work() {
  for (;;) {
    const tasks = mesh.pending().filter(t => Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await sleep(150); continue }
    if (!mesh.claim(task, scoutId, process.pid, Math.floor((Date.now() - process.uptime() * 1000) / 1000))) { await sleep(100); continue }
    held.add(task)
    const payload = JSON.parse(fs.readFileSync(path.join(mesh.root, 'intent-queue', `task-${task}.json`), 'utf-8')).payload
    log(`claimed ${task} batch=${payload.experiments.join(',')}`)
    // 跑本批实验装置（真实回归）；失败重试一次（并行资源竞争下的偶发超时防护——装置事实）
    const results = []
    let passed = 0
    for (const exp of payload.experiments) {
      let t0 = Date.now()
      let r = spawnSync(process.execPath, [path.join(HERE, 'experiments', exp)], { cwd: HERE, stdio: 'ignore', windowsHide: true, timeout: 420000 })
      let elapsedMs = Date.now() - t0
      if (r.status !== 0) {
        log(`retry ${exp} (exit ${r.status})`)
        t0 = Date.now()
        r = spawnSync(process.execPath, [path.join(HERE, 'experiments', exp)], { cwd: HERE, stdio: 'ignore', windowsHide: true, timeout: 420000 })
        elapsedMs = Date.now() - t0
      }
      results.push({ exp, exit: r.status, elapsedMs })
      if (r.status === 0) passed++
    }
    const total = payload.experiments.length
    const report = {
      agentId: scoutId, taskId: task, at: Date.now(),
      batch: payload.experiments, passedCount: passed, total, allPassed: passed === total,
      results, evidence: `${passed}/${total} 实验通过`,
    }
    fs.writeFileSync(path.join(mesh.root, 'shared', 'reports', `regression-batch-${task}.json`), JSON.stringify(report))
    mesh.finish(task, JSON.stringify(report))
    mesh.release(task)
    held.delete(task)
    log(`reported ${task} ${passed}/${total}`)
  }
}
work().catch(e => log(`error ${e.message}`))
