// dsh-mesh/scout-worker-tier.mjs —— 分层侦察兵：全文产本地（t0 存档）+ 指标战报（t2 上报）+ 响应字段级展开军令
// 三层协议：
//   t0 全文：agents/<id>-intel-<task>.txt（千字级，不主动上报，首行 REGION: 标记）
//   t2 指标战报：shared/reports/t2-<task>.json {agentId, taskId, keyNumbers{severity,task}, digest, len}（百字节级，上报）
//   展开军令：shared/expand-reqs/req-<from>-<seq>.json {tasks, field, digests} → 按 shard 认领 → 字段级回执
//   resp-<task>-<field>.json {taskId, region, digestOk}（只回请求的字段 + 全文哈希校验）
// argv: <root> <scoutId> <shard i/n>
import { MeshCore } from './mesh-core.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'

const [root, agentId, shardSpec] = process.argv.slice(2)
const shard = Number(shardSpec.split('/')[0])
const totalShards = Number(shardSpec.split('/')[1])
const mesh = new MeshCore(root)
const log = (l) => fs.appendFileSync(path.join(mesh.root, 'agents', `${agentId}.log`), `${Date.now()} ${l}\n`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
log(`started pid=${process.pid} shard=${shardSpec}`)
const held = new Set()
const hb = setInterval(() => { for (const t of held) mesh.heartbeat(t) }, mesh.heartbeatMs)
const digestOf = (s) => createHash('sha256').update(s, 'utf-8').digest('hex')

function gatherIntel(taskId) {
  const n = Number(taskId)
  const threats = ['魔教探子', '边关急报', '粮价飞涨', '瘟疫谣言', '盗匪出没', '灵石矿枯竭', '天象异常', '盐路被断', '流民聚集', '妖兽袭村']
  const region = ['北境', '江南', '蜀中', '东海', '西域'][n % 5]
  const threat = threats[n % threats.length]
  const severity = 1 + (n * 7) % 100
  const lines = [`REGION:${region}`]
  for (let i = 0; i < 40; i++) {
    lines.push(`情报详情第${i + 1}段：${region}地区侦察记录，涉及${threat}相关的目击、口供、地形、天气、粮草、兵员、兵器、道路、暗哨、联络、暗号、接头、潜伏、撤退、追击、设伏、突围、求援、谈判、交易、结盟、背叛、密谋、藏匿、转运、补给、宿营、警戒、口令、灯火、烽烟、马蹄、车辙、足迹、血迹、遗物、书信、印信、服饰、口音、习俗、市场、庙会、渡口、关卡等细节，与本任务编号 ${n} 相关。`)
  }
  return { fullText: lines.join('\n'), region, severity, n }
}

// 侦察任务循环：领任务 → 产全文(t0 存档) → 交指标战报(t2) → 完成
async function work() {
  for (;;) {
    const tasks = mesh.pending().filter(t => Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await sleep(120); continue }
    if (!mesh.claim(task, agentId, process.pid, Math.floor(Date.now() / 1000))) { await sleep(80); continue }
    held.add(task)
    await sleep(150 + Math.random() * 200)
    const intel = gatherIntel(task)
    fs.writeFileSync(path.join(mesh.root, 'agents', `${agentId}-intel-${task}.txt`), intel.fullText)
    const t2 = {
      agentId, taskId: task,
      keyNumbers: { severity: intel.severity, task: intel.n },
      digest: digestOf(intel.fullText), len: intel.fullText.length,
    }
    fs.writeFileSync(path.join(mesh.root, 'shared', 'reports', `t2-${task}.json`), JSON.stringify(t2))
    mesh.finish(task, JSON.stringify(t2))
    mesh.release(task)
    held.delete(task)
    log(`reported ${task} sev=${intel.severity}`)
  }
}

// 展开响应循环：认领军令中自己 shard 的任务 → 字段级回执 + 哈希校验
async function respondLoop() {
  const reqsDir = path.join(mesh.root, 'shared', 'expand-reqs')
  const respsDir = path.join(mesh.root, 'shared', 'expand-resps')
  fs.mkdirSync(reqsDir, { recursive: true })
  fs.mkdirSync(respsDir, { recursive: true })
  for (;;) {
    try {
      for (const f of fs.readdirSync(reqsDir)) {
        if (!f.endsWith('.json')) continue
        let req
        try { req = JSON.parse(fs.readFileSync(path.join(reqsDir, f), 'utf-8')) } catch { continue }
        for (const task of req.tasks ?? []) {
          if (Number(task) % totalShards !== shard) continue
          const intelPath = path.join(mesh.root, 'agents', `${agentId}-intel-${task}.txt`)
          if (!fs.existsSync(intelPath)) continue
          const full = fs.readFileSync(intelPath, 'utf-8')
          const m = /^REGION:(.+)$/m.exec(full)
          const resp = {
            taskId: task, field: req.field ?? 'region',
            region: m ? m[1] : 'unknown',
            digestOk: digestOf(full) === (req.digests?.[String(task)] ?? null),
          }
          try { fs.writeFileSync(path.join(respsDir, `resp-${task}-${resp.field}.json`), JSON.stringify(resp), { flag: 'wx' }) } catch {}
        }
      }
    } catch {}
    await sleep(150)
  }
}

work().catch(e => log(`error ${e.message}`))
respondLoop().catch(e => log(`error ${e.message}`))
