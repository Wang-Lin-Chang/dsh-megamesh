// dsh-megamesh/deploy-army.mjs —— 部署军：发布三关由 3 侦察兵并行执行 + 联邦脑决策（多 Agent 系统服役于真实发布流程）
// 用法: node deploy-army.mjs <projectRoot>
// 与 publish-deploy（单进程顺序）对照：同一三关，一个是千军并行，一个是单进程——结果一致、耗时对照（E24）
import { MeshCore } from './mesh-core.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(process.argv[2] ?? HERE)
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-army-'))
const mesh = new MeshCore(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const t0 = Date.now()
// 点兵：3 侦察兵（shard 0/1/2）+ 1 联邦脑
const scouts = []
for (let i = 0; i < 3; i++) scouts.push(spawn(process.execPath, [path.join(HERE, 'deploy-scout.mjs'), ROOT, `deploy-scout-${i}`, `${i}/3`], { stdio: 'ignore', windowsHide: true }))
spawn(process.execPath, [path.join(HERE, 'federal-brain.mjs'), ROOT, 'brain-deploy'], { stdio: 'ignore', windowsHide: true })

// 派任务：三关 = 三个任务（0=词检 1=测试 2=总检）
const checks = ['words', 'tests', 'preflight']
for (let i = 0; i < 3; i++) mesh.enqueue(i, { check: checks[i], root: projectRoot })

// 等三关完成
const doneCount = () => fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
for (let i = 0; i < 300; i++) {
  if (doneCount() >= 3) break
  await sleep(200)
}
// 等脑的决策文书
const waitDecree = async () => {
  for (let i = 0; i < 100; i++) {
    const dir = path.join(ROOT, 'shared', 'consensus', 'decrees')
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : []
    if (files.length > 0) return JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8'))
    await sleep(100)
  }
  return null
}
const decree = await waitDecree()

// 汇总部署单
const reports = fs.readdirSync(path.join(ROOT, 'shared', 'reports')).map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'reports', f), 'utf-8')))
const allPassed = reports.every(r => r.passed)
const elapsedMs = Date.now() - t0
const out = {
  by: 'deploy-army', at: Date.now(), elapsedMs, root: ROOT,
  checks: reports.map(r => ({ check: r.check, passed: r.passed, evidence: r.evidence })),
  decree: decree ? { term: decree.term, chair: decree.chair, verdict: decree.verdict } : null,
  advice: allPassed ? { level: 'green', action: 'publish', note: '三关由 3 侦察兵并行执行全绿（联邦脑已出决策文书）' } : { level: 'red', action: 'hold', note: reports.filter(r => !r.passed).map(r => r.evidence).join('；') },
}
console.log(JSON.stringify(out, null, 2))
for (const s of scouts) { try { s.kill() } catch {} }
process.exit(allPassed ? 0 : 1)
