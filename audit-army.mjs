// dsh-megamesh/audit-army.mjs —— 审计军：多 Agent 并行跨仓库体检（接替手写串行审计脚本）
// 侦察兵分片跑"体检关"任务，联邦脑汇总裁决——每个体检项带结果证据（文件级）
// 体检关（4 类，跨仓库）：words（词检）/ ci（CI 状态）/ drift（本地vs远端漂移）/ version（版本对齐）
// 用法: node audit-army.mjs <N> [--repos owner/repo,...]
import { MeshCore } from './mesh-core.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const N = Number(process.argv[2] ?? 4)
const REPOS = (process.argv[3] ?? 'dsh-megamesh,dsh-mesh,dsh-schedule,dsh-witness,dsh-anchor,dsh-story,schedule-core,agent-runner-mcp,dsh-cross-platform,dsh-macos,asmfs-spec,autopsy-spec').split(',')

// 体检任务生成：每仓库 × 每关 = 一个任务（侦察兵并行分片）
export function auditTasks(repos) {
  const checks = ['words', 'ci', 'drift', 'version']
  const tasks = []
  for (const repo of repos) for (const c of checks) tasks.push({ repo, check: c })
  return tasks
}

if (isMain) await main()

async function main() {
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-army-'))
const mesh = new MeshCore(ROOT, { leaseMs: 3000, heartbeatMs: 800 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const tasks = auditTasks(REPOS)

const t0 = Date.now()
const scouts = []
for (let i = 0; i < N; i++) scouts.push(spawn(process.execPath, [path.join(HERE, 'audit-scout.mjs'), ROOT, `audit-scout-${i}`, `${i}/${N}`], { stdio: 'ignore', windowsHide: true }))
spawn(process.execPath, [path.join(HERE, 'federal-brain.mjs'), ROOT, 'brain-audit'], { stdio: 'ignore', windowsHide: true })
for (let i = 0; i < tasks.length; i++) mesh.enqueue(i, tasks[i])

const doneCount = () => fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
for (let i = 0; i < 3000; i++) {
  if (doneCount() >= tasks.length) break
  await sleep(200)
}
const reports = fs.readdirSync(path.join(ROOT, 'shared', 'reports')).filter(f => f.startsWith('audit-batch-')).map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'reports', f), 'utf-8')))
const flat = reports.flatMap(r => r.results)
const fails = flat.filter(x => !x.passed)
const elapsedMs = Date.now() - t0

console.log(JSON.stringify({
  by: 'audit-army', at: Date.now(), N, repos: REPOS.length, tasks: tasks.length,
  scouts: N, elapsedMs, passed: flat.length - fails.length, failed: fails.length,
  fails: fails.map(x => `${x.repo}/${x.check}: ${x.evidence}`),
  root: ROOT,
}, null, 2))
const lastRunPath = path.join(HERE, 'shared', 'consensus', 'last-audit-run.json')
fs.writeFileSync(lastRunPath, JSON.stringify({ by: 'audit-army', at: Date.now(), N, repos: REPOS.length, tasks: tasks.length, elapsedMs, passed: flat.length - fails.length, failed: fails.length, fails: fails.map(x => ({ repo: x.repo, check: x.check, evidence: x.evidence })) }, null, 2))
for (const s of scouts) { try { s.kill() } catch (e) { console.error(`scout kill failed: ${e.message}`) } }
process.exit(fails.length === 0 ? 0 : 1)
}
