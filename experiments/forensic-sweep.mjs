// 取证脚本：复刻 real-adapter EXP-3 的现场，在 sweep 时刻打印每个锁的年龄/内容/任务状态
import { MeshCore } from '../mesh-core.mjs'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'forensic-'))
const mesh = new MeshCore(ROOT, { leaseMs: 2500, heartbeatMs: 600 })
fs.mkdirSync(path.join(ROOT, 'shared', 'reports'), { recursive: true })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const workers = []
for (let i = 0; i < 30; i++) {
  workers.push(spawn(process.execPath, [i < 10 ? 'adapters/langgraph-worker.mjs' : 'scout-worker.mjs', ROOT, `${i < 10 ? 'lg' : 'scout'}-${i}`, `${i}/30`, 'report'], { stdio: 'ignore', windowsHide: true }))
}
await sleep(300)
// 复刻完整序列：EXP-1 波（1..90）→ 等完成 → EXP-3 波（101..130）
for (let i = 1; i <= 90; i++) mesh.enqueue(i, { n: i })
for (let k = 0; k < 600; k++) {
  const done = fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length
  if (done >= 90) break
  await sleep(100)
}
console.log('wave1 done:', fs.readdirSync(path.join(ROOT, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length)
for (let i = 101; i <= 130; i++) mesh.enqueue(i, { n: i })
// 抓 lg 锁 → kill
let victim = null
for (let k = 0; k < 2000 && victim === null; k++) {
  for (const f of fs.readdirSync(path.join(ROOT, 'intent-queue'))) {
    if (!f.endsWith('.lock')) continue
    const lock = fs.readFileSync(path.join(ROOT, 'intent-queue', f), 'utf-8').trim()
    if (lock.startsWith('lg-')) { victim = { pid: Number(lock.split(':')[1]) }; break }
  }
  await sleep(10)
}
console.log('victim found:', victim !== null)
if (victim) { try { process.kill(victim.pid, 'SIGKILL') } catch {} }
await sleep(300)
// sweep 时刻取证：锁年龄 + 内容 + 对应任务状态
console.log('--- sweep-time lock forensics ---')
for (const f of fs.readdirSync(path.join(ROOT, 'intent-queue'))) {
  if (!f.endsWith('.lock')) continue
  const taskId = f.replace(/^task-/, '').replace(/\.lock$/, '')
  let lock, age
  try {
    lock = fs.readFileSync(path.join(ROOT, 'intent-queue', f), 'utf-8').trim()
    age = Date.now() - fs.statSync(path.join(ROOT, 'intent-queue', f)).mtimeMs
  } catch { continue }   // 取证自身的 TOCTOU：锁刚被释放，跳过
  const inQueue = fs.existsSync(path.join(ROOT, 'intent-queue', `task-${taskId}.json`))
  const inDone = fs.existsSync(path.join(ROOT, 'done', `task-${taskId}.json`))
  console.log(`lock ${taskId}: age=${age.toFixed(0)}ms holder=${lock} taskInQueue=${inQueue} taskInDone=${inDone}`)
}
const swept = mesh.sweep()
console.log('sweep result:', JSON.stringify(swept.map(s => `${s.taskId}(${s.reason})`)))
for (const w of workers) { try { w.kill() } catch {} }
process.exit(0)
