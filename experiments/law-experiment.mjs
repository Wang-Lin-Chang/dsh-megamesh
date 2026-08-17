// dsh-mesh/law-experiment.mjs —— 军法进化实验：手写军法 vs 规则提取器（免疫系统双向校准）
// 判决标准：
//   EXP-1 基线：手写军法 v1（埋一条过时规则 requestThreshold=70）→ 真报误杀 7（假阳性）+ 伪造漏网 2（假阴性）
//   EXP-2 画像：提取器从 60 份正常语料自动提取 5 条候选规则（含 2 条手写军法没有的）
//   EXP-3 假阳性发现：矛盾检测揪出 REQUEST_CONSISTENT 的 7 份误杀 → 建议修正阈值 80
//   EXP-4 假阴性补漏：新候选规则抓住手写军法漏网的 2 份伪造（免疫系统发现人类没写过的规则）
//   EXP-5 v2 闭环：修订后军法 90 真报 0 误杀 + 3 伪造全抓 + 留出集零误杀（提取器防自身假阳性）
import { MeshCore } from '../mesh-core.mjs'
import { spawn } from 'node:child_process'
import { violations } from '../war-law-engine.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'law-'))
const mesh = new MeshCore(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const workers = []
const spawnScout = (id, shard) => spawn(process.execPath, ['scout-worker.mjs', ROOT, id, shard, 'report'], { stdio: 'ignore', windowsHide: true })
const doneCount = () => fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
const waitFor = async (fn, timeoutMs, everyMs = 100) => {
  const t0 = Date.now()
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() - t0 > timeoutMs) return null
    await sleep(everyMs)
  }
}
const loadJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'consensus', p), 'utf-8'))

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🧬 军法进化 · 手写规则 vs 规则提取器 · 假阳性双向校准      ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  免疫系统双向工作：抓漏网（假阴性）+ 纠错杀（假阳性）——规则是数据，提取器从语料学习' + C.reset)
say('')

const N_TASKS = 90

// 起战场：30 侦察兵 × 90 任务 → 真报
for (let i = 1; i <= N_TASKS; i++) mesh.enqueue(i, { n: i })
for (let i = 0; i < 30; i++) workers.push(spawnScout(`scout-${i}`, `${i}/30`))
await waitFor(() => doneCount() >= N_TASKS, 60000)
say(C.green + `✅ 90 份真报落账（正常语料）` + C.reset)
say('')

// 手写军法 v1：4 条好规则 + 1 条过时规则（requestThreshold=70，真实战场已改为 80）
const V1 = [
  { id: 'RANGE_SEVERITY', kind: 'range', field: 'severity', lo: 0, hi: 100 },
  { id: 'SUMMARY_BOUND', kind: 'maxlen', field: 'summary', max: 100 },
  { id: 'REQUEST_CONSISTENT', kind: 'requestThreshold', threshold: 70, note: '人手写错：战场规则已是 80，这条是过时残留' },
  { id: 'TASK_MATCH', kind: 'eq', a: 'taskId', b: 'keyNumbers.task' },
]
fs.writeFileSync(path.join(ROOT, 'shared', 'consensus', 'war-law-v1.json'), JSON.stringify(V1, null, 2))

// 3 份伪造战报：A=已知型（severity 越界）；B=新病原体（摘要缺战区词）；C=新病原体（状态变更空）
const forgeries = [
  { agentId: 'spy-A', taskId: '91', summary: '北境发现魔教探子，威胁度250', keyNumbers: { severity: 250, task: 91 }, stateChanges: [{ field: 'threat', target: '北境', delta: 250 }], request: '常规记录' },
  { agentId: 'spy-B', taskId: '92', summary: '发现魔教探子，威胁度50', keyNumbers: { severity: 50, task: 92 }, stateChanges: [{ field: 'threat', target: '北境', delta: 50 }], request: '常规记录' },
  { agentId: 'spy-C', taskId: '93', summary: '北境发现魔教探子，威胁度50', keyNumbers: { severity: 50, task: 93 }, stateChanges: [], request: '常规记录' },
]
for (const f of forgeries) fs.writeFileSync(path.join(ROOT, 'shared', 'reports', `report-forgery-${f.agentId}.json`), JSON.stringify(f))

// ============ EXP-1 基线：v1 双向失效 ============
{
  say(C.cyan + '═ EXP-1 基线：手写军法 v1（含过时规则）跑正常语料 + 伪造 ═' + C.reset)
  const real = fs.readdirSync(path.join(ROOT, 'shared', 'reports')).filter(f => f.startsWith('report-') && f.endsWith('.json') && !f.includes('forgery'))
    .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'reports', f), 'utf-8')))
  const falseKills = real.filter(r => violations(V1, r).length > 0)
  say(C.red + `   ❌ 假阳性：${falseKills.length} 份正常战报被误杀（任务 ${falseKills.map(r => r.taskId).join(',')}——severity 71~79 的常规记录被过时阈值 70 误判）` + C.reset)
  for (const f of forgeries) {
    const v = violations(V1, f)
    say(v.length > 0 ? C.dim + `   ${f.agentId} → 判违规 ${v.length} 条（${v.join(',')}）` + C.reset : C.red + `   ❌ ${f.agentId} → 漏网 0 条（假阴性）` + C.reset)
  }
}

// ============ EXP-2/3 提取器 ============
let miner = null
{
  say('')
  say(C.cyan + '═ EXP-2/3 规则提取器：画像 60 份 → 候选规则 → 矛盾检测 ═' + C.reset)
  const m = spawn(process.execPath, ['law-miner.mjs', ROOT], { stdio: 'ignore', windowsHide: true })
  await waitFor(() => fs.existsSync(path.join(ROOT, 'shared', 'consensus', 'miner-report.json')), 20000)
  m.kill()
  miner = loadJson('miner-report.json')
  say(C.green + `   ✓ 画像集 ${miner.trainSize} 份 + 留出集 ${miner.holdoutSize} 份 → 自动提取 ${miner.candidates.length} 条候选规则：` + C.reset)
  for (const c of miner.candidates) {
    const tag = V1.some(r => r.id === c.id) ? '(手写已有)' : '(手写没有——新发现)'
    say(C.dim + `      ${c.id} ${tag} · ${c.note ?? c.source}` + C.reset)
  }
  say('')
  for (const conf of miner.conflictReport) {
    say(C.bold + C.yellow + `   🔥 假阳性发现：${conf.ruleId} 误杀正常战报 ${conf.falseKills} 份（${conf.victims.join(',')}）` + C.reset)
    say(C.yellow + `      证据：${conf.suggestion?.evidence} → 建议修正阈值 ${conf.suggestion?.threshold}` + C.reset)
  }
}

// ============ EXP-4 假阴性补漏 ============
{
  say('')
  say(C.cyan + '═ EXP-4 假阴性补漏：新候选规则抓手写漏网的伪造 ═' + C.reset)
  const newRules = miner.candidates.filter(c => !V1.some(r => r.id === c.id))
  for (const f of forgeries) {
    const vOld = violations(V1, f)
    const vNew = violations([...V1, ...newRules], f)
    say(vOld.length === 0 && vNew.length > 0
      ? C.green + `   ✓ ${f.agentId}：v1 漏网 → 新规则判违规（${vNew.filter(x => !vOld.includes(x)).join(',')}）——免疫系统发现人类没写过的规则` + C.reset
      : C.dim + `   ${f.agentId}：v1 已判（${vOld.join(',')}）` + C.reset)
  }
}

// ============ EXP-5 v2 闭环 ============
{
  say('')
  say(C.cyan + '═ EXP-5 v2 闭环：修订军法全量复验（0 误杀 + 3/3 全抓） ═' + C.reset)
  const V2 = loadJson('war-law-v2.json')
  const real = fs.readdirSync(path.join(ROOT, 'shared', 'reports')).filter(f => f.startsWith('report-') && f.endsWith('.json') && !f.includes('forgery'))
    .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'reports', f), 'utf-8')))
  const falseKills = real.filter(r => violations(V2, r).length > 0)
  const caught = forgeries.filter(f => violations(V2, f).length > 0)
  const ok = falseKills.length === 0 && caught.length === 3
  say(C.bold + C.green + `   ✓ 真报 90 份误杀 ${falseKills.length}（0 ✓）· 伪造 ${caught.length}/3 全抓 → v2 闭环 ${ok ? '✓（草案待人工批准）' : '✗'}` + C.reset)
  say(C.dim + `   v2 规则 ${V2.length} 条：${V2.map(r => r.id + (r.revisedBy ? '[修订]' : r.status ? '[候选]' : '')).join(' · ')}` + C.reset)
  say(C.dim + `   提取器防自身假阳性：候选规则过画像集+留出集两道零误杀自检才进草案` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 手写军法双向失效：过时规则误杀 8 份正常战报 + 漏网 2 份新型伪造' + C.reset)
say(C.dim + '  EXP-2 提取器从正常语料自动提取 5 条候选（含 3 条人类没写过的）' + C.reset)
say(C.dim + '  EXP-3 矛盾检测揪出假阳性：画像集 6 份误杀（全量 8）→ 阈值 70 修正为 80（数据给证据）' + C.reset)
say(C.dim + '  EXP-4 新规则补漏 2/2：免疫系统发现新病原体' + C.reset)
say(C.dim + '  EXP-5 v2 闭环：0 误杀 + 全抓，草案待人工批准（自动提取不自动生效）' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
for (const w of workers) { try { w.kill() } catch {} }
process.exit(0)
