// dsh-mesh/federal-brain.mjs —— 联邦脑：无单点大脑（任期锁 + 租约判死 + O_EXCL 换脑）
// 三脑平等竞争任期锁 shared/consensus/term.lock（内容 = brainId:pid:startSec:term）
// 主席每轮心跳 touch 锁；候补发现租约过期 → 判死 → O_EXCL 抢锁 → 新任期
// 决策文书 shared/consensus/decrees/decree-<term>.json（覆盖写，最新即有效）
// argv: <meshRoot> <brainId>
import * as fs from 'node:fs'
import * as path from 'node:path'

const [root, brainId] = process.argv.slice(2)
const LEASE_MS = 1500
const POLL_MS = 150
const DECREE_MIN_GAP_MS = 250
const termPath = path.join(root, 'shared', 'consensus', 'term.lock')
const decreesDir = path.join(root, 'shared', 'consensus', 'decrees')
fs.mkdirSync(decreesDir, { recursive: true })
const log = (l) => fs.appendFileSync(path.join(root, 'agents', `${brainId}.log`), `${Date.now()} ${l}\n`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
log(`started pid=${process.pid}`)

const readTerm = () => { try { return fs.readFileSync(termPath, 'utf-8').trim() } catch { return '' } }
const parseTerm = () => {
  const m = /^(.+):(\d+):(\d+):(\d+)$/.exec(readTerm())
  return m ? { brainId: m[1], pid: Number(m[2]), startSec: Number(m[3]), term: Number(m[4]) } : null
}
const termAge = () => { try { return Date.now() - fs.statSync(termPath).mtimeMs } catch { return Infinity } }
const heartbeat = () => { try { const now = new Date(); fs.utimesSync(termPath, now, now); return true } catch { return false } }
const maxDecreeTerm = () => {
  let t = 0
  for (const f of fs.readdirSync(decreesDir)) {
    const m = /^decree-(\d+)\.json$/.exec(f)
    if (m) t = Math.max(t, Number(m[1]))
  }
  return t
}
const tryClaim = () => {
  const term = Math.max(maxDecreeTerm(), parseTerm()?.term ?? 0) + 1
  try {
    fs.writeFileSync(termPath, `${brainId}:${process.pid}:${Math.floor(Date.now() / 1000)}:${term}`, { flag: 'wx' })
    return term
  } catch { return null }
}
function processReports() {
  const dir = path.join(root, 'shared', 'reports')
  let files = []
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')) } catch { return null }
  if (files.length === 0) return null
  let best = null
  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
      if (best === null || r.keyNumbers.severity > best.keyNumbers.severity) best = r
    } catch {}
  }
  if (best === null) return null
  return {
    processed: files.length,
    verdict: { taskId: Number(best.taskId), severity: best.keyNumbers.severity, summary: best.summary, request: best.request },
  }
}

async function run() {
  let myTerm = null
  let lastDecreeAt = 0
  for (;;) {
    const owner = parseTerm()
    if (owner === null) {
      const t = tryClaim()
      if (t !== null) { myTerm = t; log(`elected chair term=${t}`) }
      await sleep(POLL_MS)
      continue
    }
    if (owner.brainId === brainId && owner.pid === process.pid) {
      heartbeat()
      const r = processReports()
      if (r !== null && Date.now() - lastDecreeAt >= DECREE_MIN_GAP_MS) {
        fs.writeFileSync(path.join(decreesDir, `decree-${myTerm}.json`), JSON.stringify({ term: myTerm, chair: brainId, at: Date.now(), ...r }))
        lastDecreeAt = Date.now()
      }
      await sleep(POLL_MS)
      continue
    }
    if (termAge() > LEASE_MS) {
      log(`chair ${owner.brainId} term=${owner.term} lease expired -> contend`)
      try { fs.unlinkSync(termPath) } catch {}
      continue
    }
    await sleep(POLL_MS)
  }
}
run().catch(e => log(`error ${e.message}`))
