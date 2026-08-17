// dsh-megamesh/framework-agent.mjs —— 模拟各大厂框架 Agent 兵：同一 5 函数契约，不同框架语言
// crewai 兵：Crew 对象风格（agent/task 派发语义）；langgraph 兵：graph 节点风格（state 迁移语义）
// 框架差异只体现在"干活方式"与日志语言；协议层（租约/战报 schema/军法）完全一致——协议在文件系统，与框架无关
// argv: <root> <agentId> <shard i/n> <crewai|langgraph>
import { MeshCore } from './mesh-core.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'

const [root, agentId, shardSpec, framework = 'crewai'] = process.argv.slice(2)
const shard = Number(shardSpec.split('/')[0])
const totalShards = Number(shardSpec.split('/')[1])
const mesh = new MeshCore(root)
const log = (l) => fs.appendFileSync(path.join(mesh.root, 'agents', `${agentId}.log`), `${Date.now()} ${l}\n`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const held = new Set()
const hb = setInterval(() => { for (const t of held) mesh.heartbeat(t) }, mesh.heartbeatMs)
log(`started pid=${process.pid} framework=${framework} shard=${shardSpec}`)

// 契约 1/4：claimTask —— O_EXCL 租约锁（框架兵与原生兵同锁协议）
function claimTask(taskId) { return mesh.claim(taskId, agentId, process.pid, Math.floor((Date.now() - process.uptime() * 1000) / 1000)) }

// 契约 2：doWork —— 框架内部干活（两种框架语言），产出 { fullText, report }
function doWork(taskId) {
  const n = Number(taskId)
  const threats = ['魔教探子', '边关急报', '粮价飞涨', '瘟疫谣言', '盗匪出没', '灵石矿枯竭', '天象异常', '盐路被断', '流民聚集', '妖兽袭村']
  const region = ['北境', '江南', '蜀中', '东海', '西域'][n % 5]
  const threat = threats[n % threats.length]
  const severity = 1 + (n * 7) % 100
  const fullText = `REGION:${region}\n` + Array.from({ length: 40 }, (_, i) => `情报详情第${i + 1}段：${region}地区侦察记录（任务 ${n}）`).join('\n')
  let report
  if (framework === 'crewai') {
    log(`crew:task dispatched ${taskId} -> agent:${agentId}`)   // CrewAI 语言：crew 派发任务给 agent
    report = {
      agentId, taskId: taskId,
      summary: `${region}发现${threat}，威胁度${severity}`,
      keyNumbers: { severity, task: n },
      stateChanges: [{ field: 'threat', target: region, delta: severity, note: threat }],
      request: severity > 80 ? '建议增援' : '常规记录',
    }
  } else {
    log(`node:state transition ${taskId} -> gather_intel complete`)   // LangGraph 语言：图节点状态迁移
    report = {
      agentId, taskId: taskId,
      summary: `${region}发现${threat}，威胁度${severity}`,
      keyNumbers: { severity, task: n },
      stateChanges: [{ field: 'threat', target: region, delta: severity, note: threat }],
      request: severity > 80 ? '建议增援' : '常规记录',
    }
  }
  return { fullText, report }
}

// 契约 3：heartbeat
function heartbeat(taskId) { return mesh.heartbeat(taskId) }

// 契约 4：respondExpand —— 字段级展开响应（空实现：本框架兵不产全文档案时回 null）
function respondExpand() { return null }

// 契约 5：report 落账（战报必须过军法由消费者把关；落账 = 写 reports + finish + release）
async function run() {
  for (;;) {
    const tasks = mesh.pending().filter(t => Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await sleep(120); continue }
    if (!claimTask(task)) { await sleep(80); continue }
    held.add(task)
    await sleep(150 + Math.random() * 200)
    const { fullText, report } = doWork(task)
    fs.writeFileSync(path.join(mesh.root, 'agents', `${agentId}-intel-${task}.txt`), fullText)
    fs.writeFileSync(path.join(mesh.root, 'shared', 'reports', `report-${task}.json`), JSON.stringify(report))
    mesh.finish(task, JSON.stringify(report))
    mesh.release(task)
    held.delete(task)
    log(`reported ${task} sev=${report.keyNumbers.severity}`)
  }
}
run().catch(e => log(`error ${e.message}`))
