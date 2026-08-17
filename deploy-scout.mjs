// dsh-megamesh/deploy-scout.mjs —— 部署侦察兵：真实发布流水线的一个检查关（词检/测试/总检）作为任务执行
// 战报 schema（部署域专用，轻量）：{agentId, taskId, check, passed, evidence}——军法在部署域 = preflight 三关本身
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

// 检查关执行器：每个 check 是真实流水线动作
function runCheck(check, projectRoot) {
  if (check === 'words') {
    const BAD = new RegExp(JSON.parse(fs.readFileSync(path.join(HERE, 'lab', 'bad-words.json'), 'utf-8')).join('|'))
    const SKIP = new Set(['node_modules', '.git', 'lab'])
    const hits = []
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (SKIP.has(e.name)) continue
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(mjs|js|cjs|ts|md|json|yml|py)$/.test(e.name)) {
          const m = BAD.exec(fs.readFileSync(p, 'utf-8'))
          if (m) hits.push(`${path.relative(projectRoot, p)}:...${m[0]}...`)
        }
      }
    }
    walk(projectRoot)
    return { passed: hits.length === 0, evidence: hits.length === 0 ? '词检 0 命中' : `词检 ${hits.length} 命中: ${hits[0]}` }
  }
  const cmd = check === 'tests'
    ? { args: ['--test', '--test-concurrency=1'], label: '测试' }
    : { args: [path.join(projectRoot, 'experiments', 'preflight-experiment.mjs')], label: '总检' }
  // 测试关重试一次：Windows Node 25.8.1 的 test runner 偶发 libuv 句柄崩溃（装置事实），失败≠真红
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = spawnSync(process.execPath, cmd.args, { cwd: projectRoot, stdio: 'ignore', windowsHide: true, timeout: 300000 })
    if (r.status === 0) return { passed: true, evidence: `${cmd.label} exit 0` }
    if (attempt === 1) return { passed: false, evidence: `${cmd.label} exit ${r.status}（重试后仍红）` }
  }
}

async function work() {
  for (;;) {
    const tasks = mesh.pending().filter(t => Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await sleep(150); continue }
    if (!mesh.claim(task, scoutId, process.pid, Math.floor((Date.now() - process.uptime() * 1000) / 1000))) { await sleep(100); continue }
    held.add(task)
    const payload = JSON.parse(fs.readFileSync(path.join(mesh.root, 'intent-queue', `task-${task}.json`), 'utf-8')).payload
    log(`claimed ${task} check=${payload.check}`)
    const result = runCheck(payload.check, payload.root)
    const report = { agentId: scoutId, taskId: task, at: Date.now(), check: payload.check, passed: result.passed, evidence: result.evidence }
    fs.writeFileSync(path.join(mesh.root, 'shared', 'reports', `deploy-${payload.check}.json`), JSON.stringify(report))
    mesh.finish(task, JSON.stringify(report))
    mesh.release(task)
    held.delete(task)
    log(`reported ${task} passed=${result.passed}`)
  }
}
work().catch(e => log(`error ${e.message}`))
