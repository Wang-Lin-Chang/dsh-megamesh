// dsh-megamesh/audit-scout.mjs —— 审计侦察兵：执行体检关任务（words/ci/drift/version），战报带证据
// argv: <root> <scoutId> <shard i/n>
// 本地仓库路径映射 = 数据（审计军接替手写串行审计：原来手写脚本里硬编码的路径进映射表）
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

// 本地路径映射（Windows 工作机；CI 场景无本地仓库 → drift 关返回 skip 而非假红）
const LOCAL = {
  'dsh-megamesh': 'C:/Users/王霖昌/Desktop/dsh-megamesh',
  'dsh-mesh': 'C:/Users/王霖昌/Desktop/dsh-mesh',
  'dsh-schedule': 'C:/Users/王霖昌/Desktop/dsh-schedule',
  'dsh-story': 'C:/Users/王霖昌/Desktop/dsh-story',
  'schedule-core': 'C:/Users/王霖昌/Desktop/schedule-core',
  'agent-runner-mcp': 'C:/Users/王霖昌/Desktop/agent-runner-mcp',
  'dsh-witness': 'C:/Users/王霖昌/Documents/DeepSeek/dsh-witness',
  'dsh-anchor': 'C:/Users/王霖昌/Documents/DeepSeek/dsh-anchor',
  'dsh-cross-platform': 'C:/Users/王霖昌/Desktop/dsh-cross-platform',
  'dsh-macos': 'C:/Users/王霖昌/Desktop/dsh-macos',
  'asmfs-spec': 'C:/Users/王霖昌/Desktop/asmfs-spec',
  'autopsy-spec': 'C:/Users/王霖昌/Desktop/autopsy-spec',
}
const BAD_WORDS = JSON.parse(fs.readFileSync(path.join(HERE, 'lab', 'bad-words.json'), 'utf-8'))
const SKIP = new Set(['node_modules', '.git', 'lab', 'dist', 'vendor', 'shared'])   // shared=运行时账本/证据，非发布树

// ---------- 体检关实现（每关返回 {passed, evidence}）----------

// words：本地仓库词检（发布树口径）
function checkWords(repo) {
  const dir = LOCAL[repo]
  if (!dir || !fs.existsSync(dir)) return { passed: true, evidence: 'skip(no local)' }
  const BAD = new RegExp(BAD_WORDS.join('|'))
  const hits = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(mjs|js|cjs|ts|md|json|yml|py)$/.test(e.name)) {
        const m = BAD.exec(fs.readFileSync(p, 'utf-8'))
        if (m) hits.push(`${path.relative(dir, p)}:${m[0]}`)
      }
    }
  }
  walk(dir)
  return hits.length === 0 ? { passed: true, evidence: '0 hits' } : { passed: false, evidence: hits.slice(0, 3).join(';') }
}

// ci：GitHub Actions 最新 run 状态（需要 GH_TOKEN env）
function checkCi(repo) {
  const token = process.env.GH_TOKEN ?? ''
  if (!token) return { passed: true, evidence: 'skip(no token)' }
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const token = process.env.GH_TOKEN
    const repo = process.argv[1]
    const runs = await (await fetch('https://api.github.com/repos/Wang-Lin-Chang/' + repo + '/actions/runs?per_page=1', { headers: { Authorization: 'Bearer ' + token, 'User-Agent': 'audit-scout' } })).json()
    const wf = runs.workflow_runs?.[0]
    console.log(wf ? (wf.status + '/' + (wf.conclusion ?? 'pending')) : 'no-workflow')
  `, repo], { env: { ...process.env, GH_TOKEN: token }, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 30000 })
  const out = r.status === 0 ? (r.stdout ?? '').toString().trim() : 'ci-fetch-fail'
  return { passed: out === 'no-workflow' || out.endsWith('/success'), evidence: out }
}

// drift：本地文件 vs GitHub 树（git blob SHA 本地计算比对；无本地仓库 → skip）
function checkDrift(repo) {
  const dir = LOCAL[repo]
  if (!dir || !fs.existsSync(dir)) return { passed: true, evidence: 'skip(no local)' }
  const token = process.env.GH_TOKEN ?? ''
  if (!token) return { passed: true, evidence: 'skip(no token)' }
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import * as fs from 'node:fs'
    import * as path from 'node:path'
    import { createHash } from 'node:crypto'
    const [repo, dir] = process.argv.slice(1)
    const gitBlobSha = (c) => createHash('sha1').update('blob ' + Buffer.byteLength(c) + '\\0' + c).digest('hex')
    const files = {}
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['node_modules','.git','lib','dist','lab','vendor','shared'].includes(e.name)) continue   // shared=运行时账本/证据，非发布树
      const p = path.join(d, e.name); if (e.isDirectory()) walk(p)
      else files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf-8') } }
    walk(dir)
    const tree = await (await fetch('https://api.github.com/repos/Wang-Lin-Chang/' + repo + '/git/trees/main?recursive=1', { headers: { Authorization: 'Bearer ' + process.env.GH_TOKEN, 'User-Agent': 'audit-scout' } })).json()
    const gh = new Map((tree.tree ?? []).filter(t => t.type === 'blob').map(t => [t.path, t.sha]))
    const drift = []
    for (const [f, c] of Object.entries(files)) { const s = gh.get(f); if (s === undefined) drift.push(f + '(only-local)'); else if (gitBlobSha(c) !== s) drift.push(f) }
    console.log(JSON.stringify(drift))
  `, repo, dir], { env: { ...process.env, GH_TOKEN: token }, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 60000 })
  let drift = []
  try { drift = JSON.parse((r.stdout ?? '[]').toString()) } catch { drift = ['drift-parse-fail'] }
  return drift.length === 0 ? { passed: true, evidence: 'aligned' } : { passed: false, evidence: drift.slice(0, 3).join(';') }
}

// version：本地 package.json vs npm dist-tags（无本地仓库 → 只查 npm 存在性）
// npm 包名映射：scoped 包（仓库名 ≠ npm 包名）；dsh-story 的 unscoped 名被他人占用——查我们的 scoped 包
const NPM_NAME = {
  'dsh-story': '@wang--lin--chang/dsh-story',
  'schedule-core': '@wang--lin--chang/schedule-core',
}
// 平台后端库故意不发 npm（README 已声明"以仓库为准"）——无 npm 包 = 设计事实，不是债
const NO_NPM = new Set(['dsh-cross-platform', 'dsh-macos'])
function checkVersion(repo) {
  const dir = LOCAL[repo]
  const localV = dir && fs.existsSync(path.join(dir, 'package.json'))
    ? JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')).version
    : null
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const name = process.argv[1]
    const j = await (await fetch('https://registry.npmjs.org/' + encodeURIComponent(name))).json()
    console.log(j.error ? 'no-npm' : (j['dist-tags']?.latest ?? 'no-latest'))
  `, NPM_NAME[repo] ?? repo], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, timeout: 30000 })
  const npmV = r.status === 0 ? (r.stdout ?? '').toString().trim() : 'npm-fail'
  if (NO_NPM.has(repo)) return { passed: npmV === 'no-npm', evidence: `npm=${npmV} (platform lib, npm not published by design)` }
  // 无本地 package.json 的协议文档仓库（asmfs-spec/autopsy-spec）：npm 无包 = 设计事实，不是债
  if (localV === null) return { passed: true, evidence: `npm=${npmV} (spec repo, no local pkg)` }
  return localV === npmV ? { passed: true, evidence: `${localV} == npm` } : { passed: false, evidence: `local ${localV} != npm ${npmV}` }
}

const CHECK = { words: checkWords, ci: checkCi, drift: checkDrift, version: checkVersion }

// 一次性陷阱协议（E30 偶发失败注入测试钩子）：AUDIT_ONESHOT_TRAP 指向文件，内容 "repo/check"
// 检查前若匹配则删除该文件并返回失败（一次性）——模拟偶发失败，验证复核轮翻转
function consumeOneshotTrap(repo, check) {
  const trapFile = process.env.AUDIT_ONESHOT_TRAP
  if (!trapFile || !fs.existsSync(trapFile)) return null
  try {
    const content = fs.readFileSync(trapFile, 'utf-8').trim()
    if (content === `${repo}/${check}`) {
      fs.unlinkSync(trapFile)
      return { passed: false, evidence: 'oneshot-trap (simulated transient failure)' }
    }
  } catch { return null }
  return null
}

async function work() {
  for (;;) {
    const tasks = mesh.pending().filter(t => Number(t) % totalShards === shard)
    const task = tasks[0]
    if (task === undefined) { await sleep(150); continue }
    if (!mesh.claim(task, scoutId, process.pid, Math.floor((Date.now() - process.uptime() * 1000) / 1000))) { await sleep(100); continue }
    held.add(task)
    const payload = JSON.parse(fs.readFileSync(path.join(mesh.root, 'intent-queue', `task-${task}.json`), 'utf-8')).payload
    log(`claimed ${task} ${payload.repo}/${payload.check}`)
    const fn = CHECK[payload.check]
    const trap = consumeOneshotTrap(payload.repo, payload.check)
    const result = trap ?? (fn ? fn(payload.repo) : { passed: false, evidence: `unknown check ${payload.check}` })
    // 审计域战报补 severity 语义（E30）：质证需要 keyNumbers 做自洽/离群检测——失败=高严重度
    const severity = result.passed ? 1 : 90
    const report = { agentId: scoutId, taskId: task, at: Date.now(), repo: payload.repo, check: payload.check, verify: payload.verify === true, passed: result.passed, evidence: result.evidence, keyNumbers: { severity }, summary: `${payload.repo}/${payload.check}: ${result.evidence}`, results: [{ repo: payload.repo, check: payload.check, passed: result.passed, evidence: result.evidence }] }
    fs.writeFileSync(path.join(mesh.root, 'shared', 'reports', `audit-batch-${task}.json`), JSON.stringify({ agentId: scoutId, taskId: task, at: Date.now(), repo: payload.repo, check: payload.check, verify: payload.verify === true, batch: [payload], passedCount: result.passed ? 1 : 0, total: 1, allPassed: result.passed, results: report.results, evidence: result.evidence, keyNumbers: { severity }, summary: report.summary }))
    mesh.finish(task, JSON.stringify(report))
    mesh.release(task)
    held.delete(task)
    log(`reported ${task} passed=${result.passed}`)
  }
}
work().catch(e => log(`error ${e.message}`))
