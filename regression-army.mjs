// dsh-megamesh/regression-army.mjs —— 回归军：全部实验装置回归跑由侦察兵分片执行 + 联邦脑决策
// 分片策略参数（兵数 N）由平行宇宙竞标/进化用真实耗时数据定出（见 regression-army-experiment E25）
// 用法: node regression-army.mjs <N> [--no-brain]
// 注意：EXPERIMENTS/partition 被 E25 导入——顶层只有 isMain 时才拉起全军（import 零副作用）
import { MeshCore } from './mesh-core.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
const N = Number(process.argv[2] ?? 22)

// 实验装置清单（排除 ref 夹具、preflight 自身、E25 驱动器——驱动器会再调回归军，入列即无限递归）
export const EXPERIMENTS = fs.readdirSync(path.join(HERE, 'experiments')).filter(f => f.endsWith('.mjs') && !f.startsWith('ref-') && f !== 'regression-army-experiment.mjs').sort()

// 分片贪心：按耗时降序逐个分给当前总耗时最小的兵（确定性）
export function partition(experiments, n, times) {
  const buckets = Array.from({ length: n }, () => ({ exps: [], total: 0 }))
  const sorted = [...experiments].sort((a, b) => (times[b] ?? 1) - (times[a] ?? 1))
  for (const exp of sorted) {
    let best = 0
    for (let i = 1; i < n; i++) if (buckets[i].total < buckets[best].total) best = i
    buckets[best].exps.push(exp)
    buckets[best].total += (times[exp] ?? 1)
  }
  return buckets.filter(b => b.exps.length > 0).map(b => b.exps)
}

if (isMain) await main()

async function main() {
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-army-'))
const mesh = new MeshCore(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// 历史耗时（若已有账本）→ 分片
const timesPath = path.join(HERE, 'shared', 'consensus', 'regression-times.json')
const times = fs.existsSync(timesPath) ? JSON.parse(fs.readFileSync(timesPath, 'utf-8')) : {}
const batches = partition(EXPERIMENTS, Math.min(N, EXPERIMENTS.length), times)

const t0 = Date.now()
const scouts = []
for (let i = 0; i < batches.length; i++) scouts.push(spawn(process.execPath, [path.join(HERE, 'regression-scout.mjs'), ROOT, `reg-scout-${i}`, `${i}/${batches.length}`], { stdio: 'ignore', windowsHide: true }))
spawn(process.execPath, [path.join(HERE, 'federal-brain.mjs'), ROOT, 'brain-regression'], { stdio: 'ignore', windowsHide: true })
for (let i = 0; i < batches.length; i++) mesh.enqueue(i, { experiments: batches[i] })

const doneCount = () => fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
for (let i = 0; i < 3000; i++) {
  if (doneCount() >= batches.length) break
  await sleep(200)
}
const reports = fs.readdirSync(path.join(ROOT, 'shared', 'reports')).filter(f => f.startsWith('regression-batch-')).map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'reports', f), 'utf-8')))
const allPassed = reports.length === batches.length && reports.every(r => r.allPassed)
const elapsedMs = Date.now() - t0
const failing = reports.flatMap(r => r.results.filter(x => x.exit !== 0).map(x => `${x.exp}:exit${x.exit}`))

// 耗时账本更新（真实数据 → 供竞标/进化）
const newTimes = { ...times }
for (const r of reports) for (const x of r.results) newTimes[x.exp] = x.elapsedMs
fs.writeFileSync(timesPath, JSON.stringify(newTimes, null, 2))

console.log(JSON.stringify({
  by: 'regression-army', at: Date.now(), N, batches: batches.length, elapsedMs,
  allPassed, failing, reports: reports.map(r => ({ batch: r.batch.length, passed: r.passedCount, total: r.total })),
  root: ROOT,
}, null, 2))
// 结果同时落盘（供 E25 等无 pipe 环境取证）
const lastRunPath = path.join(HERE, 'shared', 'consensus', 'last-regression-run.json')
fs.writeFileSync(lastRunPath, JSON.stringify({ by: 'regression-army', at: Date.now(), N, batches: batches.length, elapsedMs, allPassed, failing }, null, 2))
for (const s of scouts) { try { s.kill() } catch (e) { console.error(`scout kill failed: ${e.message}`) } }
process.exit(allPassed ? 0 : 1)
}
