// dsh-mesh/scout-worker.mjs —— 侦察兵：领任务 → 读情报源 → 产出全文情报（千字级）+ 战报（百字级结构化）
// 战报协议：report = {agentId, taskId, verdict, summary, keyNumbers, stateChanges, request}
// argv: <meshRoot> <scoutId> [shard i/n] [full|report]
import { MeshCore } from './mesh-core.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'

const [root, agentId, shardSpec, mode = 'report'] = process.argv.slice(2)
const shard = shardSpec !== undefined ? Number(shardSpec.split('/')[0]) : null
const totalShards = shardSpec !== undefined ? Number(shardSpec.split('/')[1]) : null
const mesh = new MeshCore(root)
const log = (l) => fs.appendFileSync(path.join(mesh.root, 'agents', `${agentId}.log`), `${Date.now()} ${l}\n`)
log(`started pid=${process.pid} mode=${mode} shard=${shardSpec ?? '-'}`)

const hb = setInterval(() => { for (const t of held) mesh.heartbeat(t) }, mesh.heartbeatMs)
const held = new Set()

// 模拟情报源：每个任务一份"原始情报"（千字级全文——大脑读全文模式的成本来源）
function gatherIntel(taskId) {
  const n = Number(taskId)
  const lines = []
  const threats = ['魔教探子', '边关急报', '粮价飞涨', '瘟疫谣言', '盗匪出没', '灵石矿枯竭', '天象异常', '盐路被断', '流民聚集', '妖兽袭村']
  const region = ['北境', '江南', '蜀中', '东海', '西域'][n % 5]
  const threat = threats[n % threats.length]
  const severity = 1 + (n * 7) % 100
  for (let i = 0; i < 40; i++) {
    lines.push(`情报详情第${i + 1}段：${region}地区侦察记录，涉及${threat}相关的目击、口供、地形、天气、粮草、兵员、兵器、道路、暗哨、联络、暗号、接头、潜伏、撤退、追击、设伏、突围、求援、谈判、交易、结盟、背叛、密谋、藏匿、转运、补给、宿营、警戒、口令、灯火、烽烟、马蹄、车辙、足迹、血迹、遗物、书信、印信、服饰、口音、习俗、市场、庙会、渡口、关卡等细节，与本任务编号 ${n} 相关。`)
  }
  return { fullText: lines.join('\n'), region, threat, severity, n }
}

async function work() {
  for (;;) {
    const tasks = mesh.pending().filter(t => shard === null || Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await new Promise(r => setTimeout(r, 120)); continue }
    if (!mesh.claim(task, agentId, process.pid, Math.floor(Date.now() / 1000))) { await new Promise(r => setTimeout(r, 80)); continue }
    held.add(task)
    log(`claimed ${task}`)
    await new Promise(r => setTimeout(r, 150 + Math.random() * 200))
    const intel = gatherIntel(task)
    // 全文情报落侦察兵目录（千字级——不送大脑）
    fs.writeFileSync(path.join(mesh.root, 'agents', `${agentId}-intel-${task}.txt`), intel.fullText)
    // 战报（百字级结构化——送大脑）
    const report = {
      agentId, taskId: task, at: Date.now(),
      summary: `${intel.region}发现${intel.threat}，威胁度${intel.severity}`,
      keyNumbers: { severity: intel.severity, task: intel.n },
      stateChanges: [{ field: 'threat', target: intel.region, delta: intel.severity, note: intel.threat }],
      request: intel.severity > 80 ? '建议增援' : '常规记录',
    }
    fs.writeFileSync(path.join(mesh.root, 'shared', 'reports', `report-${task}.json`), JSON.stringify(report))
    // 上报内容=战报或全文（对照模式）
    const payload = mode === 'full' ? intel.fullText : JSON.stringify(report)
    mesh.finish(task, payload)
    mesh.release(task)
    held.delete(task)
    log(`reported ${task} sev=${intel.severity}`)
  }
}
work().catch(e => log(`error ${e.message}`))
