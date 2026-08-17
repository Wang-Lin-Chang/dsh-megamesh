// dsh-megamesh/adapters/crewai-launcher.mjs —— CrewAI 真库兵启动器（5 函数契约循环，跨语言子进程协议）
// claimTask（O_EXCL 租约）→ doWork = spawn python crewai-worker.py（真库 crew kickoff + mock LLM）→ 战报读回 → finish/release
// 文件即消息：python 子进程不通过 stdout 交结果（stdio ignore），战报写 shared/reports/
// argv: <root> <agentId> <shard i/n> [mockPort]
import { MeshCore } from '../mesh-core.mjs'
import { spawnSync, spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [root, agentId, shardSpec, portArg] = process.argv.slice(2)
const shard = Number(shardSpec.split('/')[0])
const totalShards = Number(shardSpec.split('/')[1])
const mockPort = Number(portArg ?? 15700 + (shard % 100))
const PY = process.env.PYTHON_CMD ?? 'python'
const mesh = new MeshCore(root)
const log = (l) => fs.appendFileSync(path.join(mesh.root, 'agents', `${agentId}.log`), `${Date.now()} ${l}\n`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const held = new Set()
const hb = setInterval(() => { for (const t of held) mesh.heartbeat(t) }, mesh.heartbeatMs)

// 起 mock LLM 服务器（本地确定性大脑，供 crewai 的 LiteLLM 客户端调用）
const mockSrv = spawn(PY, [path.join(HERE, 'mock-llm-server.py'), String(mockPort)], { stdio: 'ignore', windowsHide: true })
log(`started pid=${process.pid} crewai-launcher shard=${shardSpec} mockPort=${mockPort}`)

function doWork(taskId) {
  const r = spawnSync(PY, [path.join(HERE, 'crewai-worker.py'), root, agentId, taskId, String(mockPort)], { stdio: 'ignore', windowsHide: true, timeout: 120000 })
  if (r.error) { log(`crewai spawn error ${r.error.message}`); return null }
  const rp = path.join(root, 'shared', 'reports', `report-${taskId}.json`)
  for (let i = 0; i < 400; i++) {
    if (fs.existsSync(rp)) return JSON.parse(fs.readFileSync(rp, 'utf-8'))
    const end = Date.now() + 100
    while (Date.now() < end) {}   // 忙等 100ms（spawnSync 已返回，等文件落盘）
  }
  return null
}

async function run() {
  for (;;) {
    const tasks = mesh.pending().filter(t => Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await sleep(150); continue }
    if (!mesh.claim(task, agentId, process.pid, Math.floor(Date.now() / 1000))) { await sleep(100); continue }
    held.add(task)
    log(`claimed ${task} -> crewai crew kickoff`)
    const report = doWork(task)
    if (report === null) {
      mesh.release(task)
      held.delete(task)
      log(`error task ${task}: crewai returned no report`)
      continue
    }
    fs.writeFileSync(path.join(mesh.root, 'agents', `${agentId}-intel-${task}.txt`), `CrewAI crew 侦察记录（任务 ${task}）`)
    mesh.finish(task, JSON.stringify(report))
    mesh.release(task)
    held.delete(task)
    log(`reported ${task} sev=${report.keyNumbers.severity}`)
  }
}
run().catch(e => log(`error ${e.message}`))
process.on('exit', () => { try { mockSrv.kill() } catch {} })
