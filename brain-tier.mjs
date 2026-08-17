// dsh-mesh/brain-tier.mjs —— 分层大脑：t2 全局扫描（百字节级）+ 按需字段级展开（expand-on-uncertainty）
// 决策任务：找"威胁度最高且 region 未被增援"的任务——severity 在 t2，region 只在 t0 全文（必须展开）
// 策略：
//   topk：按 severity 降序，批量展开 top-K（batchK），在批内找第一个未增援 region
//   gap ：top1 与 top2 差距 ≥ delta 时只展开 top1（赌第一）；差距小则前两名都展开；未命中顺序回退
// 军法：digestOk=false 的展开回执 = 战报与全文绑定断裂（篡改）→ 拒收该任务
// argv: <root> <strategy=gap|topk> <delta=5> <batchK=5>
import * as fs from 'node:fs'
import * as path from 'node:path'

const [root, strategy = 'gap', deltaArg, batchArg] = process.argv.slice(2)
const DELTA = Number(deltaArg ?? 5)
const BATCH_K = Number(batchArg ?? 5)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const log = (l) => fs.appendFileSync(path.join(root, 'agents', 'brain-tier.log'), `${Date.now()} ${l}\n`)
log(`woken pid=${process.pid} strategy=${strategy} delta=${DELTA} batchK=${BATCH_K}`)

const reportsDir = path.join(root, 'shared', 'reports')
const reqsDir = path.join(root, 'shared', 'expand-reqs')
const respsDir = path.join(root, 'shared', 'expand-resps')
fs.mkdirSync(reqsDir, { recursive: true })
fs.mkdirSync(respsDir, { recursive: true })
const reinforced = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'consensus', 'reinforced.json'), 'utf-8'))

let readBytes = 0
const t2s = []
for (const f of fs.readdirSync(reportsDir)) {
  if (!f.startsWith('t2-')) continue
  const p = path.join(reportsDir, f)
  readBytes += fs.statSync(p).size
  t2s.push(JSON.parse(fs.readFileSync(p, 'utf-8')))
}
t2s.sort((a, b) => b.keyNumbers.severity - a.keyNumbers.severity)
log(`t2 scan: ${t2s.length} reports, ${readBytes}B`)

let reqSeq = 0
let roundtrips = 0
let expands = 0
const rejected = []

async function expand(tasks) {
  reqSeq++
  roundtrips++
  expands += tasks.length
  const digests = {}
  for (const t of tasks) {
    const e = t2s.find(x => x.taskId === t)
    if (e) digests[t] = e.digest
  }
  fs.writeFileSync(path.join(reqsDir, `req-brain-tier-${reqSeq}.json`), JSON.stringify({ from: 'brain-tier', seq: reqSeq, tasks, field: 'region', digests }))
  const resps = {}
  const t0 = Date.now()
  while (Object.keys(resps).length < tasks.length && Date.now() - t0 < 5000) {
    for (const t of tasks) {
      const p = path.join(respsDir, `resp-${t}-region.json`)
      if (!fs.existsSync(p)) continue
      try {
        const r = JSON.parse(fs.readFileSync(p, 'utf-8'))
        resps[t] = r
        readBytes += fs.statSync(p).size
      } catch { /* 协议豁免：文件不存在/竞态正常 */ }
    }
    await sleep(100)
  }
  return resps
}

// 在给定 task 列表中找第一个"未增援 region"（digest 断裂的拒收）
function firstUnreinforced(tasks, resps) {
  for (const t of tasks) {
    const r = resps[t]
    if (!r) continue
    if (r.digestOk === false) { rejected.push(String(t)); log(`digest mismatch task ${t} -> rejected (战报与全文绑定断裂)`); continue }
    if (!reinforced.includes(r.region)) {
      const e = t2s.find(x => x.taskId === t)
      return { taskId: Number(t), severity: e.keyNumbers.severity, region: r.region }
    }
  }
  return null
}

let answer = null
if (strategy === 'topk') {
  for (let i = 0; i < t2s.length && answer === null; i += BATCH_K) {
    const batch = t2s.slice(i, i + BATCH_K).map(t => t.taskId)
    const resps = await expand(batch)
    answer = firstUnreinforced(batch, resps)
  }
} else {
  // gap：top1/top2 差距 ≥ delta → 只查 top1；否则查前两名。未命中 → 顺序回退（逐个展开）
  const top = t2s.slice(0, 2)
  const gap = top.length === 2 ? top[0].keyNumbers.severity - top[1].keyNumbers.severity : 0
  let batch
  if (top.length === 1 || gap >= DELTA) batch = [top[0].taskId]
  else batch = top.map(t => t.taskId)
  let resps = await expand(batch)
  answer = firstUnreinforced(batch, resps)
  for (let i = 1; i < t2s.length && answer === null; i++) {
    if (batch.includes(t2s[i].taskId)) continue
    const one = [t2s[i].taskId]
    resps = await expand(one)
    answer = firstUnreinforced(one, resps)
  }
}

const decision = {
  by: 'brain-tier', at: Date.now(), strategy, delta: DELTA, batchK: BATCH_K,
  gapTop2: t2s.length >= 2 ? t2s[0].keyNumbers.severity - t2s[1].keyNumbers.severity : null,
  answer, expands, roundtrips, rejected, readBytes,
  reinforced,
}
fs.writeFileSync(path.join(root, 'shared', 'consensus', 'decision-tier.json'), JSON.stringify(decision, null, 2))
log(`decision answer=${answer?.taskId ?? 'none'} expands=${expands} roundtrips=${roundtrips} rejected=[${rejected.join(',')}] read=${readBytes}B`)
