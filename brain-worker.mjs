// dsh-mesh/brain-worker.mjs —— 大脑进程：战略决策者
// 军纪：不领任务、不产情报、不读全文——只读战报流（shared/reports/），军法先行，决策落 shared/consensus/decision.json
// argv: <meshRoot>
import { courtMartial } from './war-law.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'

const [root] = process.argv.slice(2)
const reportsDir = path.join(root, 'shared', 'reports')
const log = (l) => fs.appendFileSync(path.join(root, 'agents', 'brain.log'), `${Date.now()} ${l}\n`)
log(`brain woken pid=${process.pid}`)

let best = null, readBytes = 0, seen = 0, rejected = 0
for (const f of fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'))) {
  const p = path.join(reportsDir, f)
  const r = JSON.parse(fs.readFileSync(p, 'utf-8'))
  readBytes += fs.statSync(p).size
  const verdicts = courtMartial(r)
  if (verdicts.length > 0) {
    rejected++
    log(`court-martial ${f}: ${verdicts.map(v => v.id).join(',')}`)
    continue   // 违报不进大脑
  }
  seen++
  if (best === null || r.keyNumbers.severity > best.keyNumbers.severity) best = r
}

const decision = {
  by: 'brain', at: Date.now(), seen, rejected, readBytes,
  verdict: best ? { taskId: Number(best.taskId), severity: best.keyNumbers.severity, summary: best.summary, request: best.request } : null,
}
fs.writeFileSync(path.join(root, 'shared', 'consensus', 'decision.json'), JSON.stringify(decision, null, 2))
log(`decision task=${decision.verdict?.taskId ?? 'none'} seen=${seen} rejected=${rejected} read=${readBytes}B`)
