// dsh-mesh/mesh-test.mjs —— CI 测试（核心 API 断言 + 快速隔离验证；真进程 kill 实验见 mesh-experiment）
import { MeshCore } from '../mesh-core.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

let passed = 0, failed = 0
const check = (name, cond, detail = '') => { if (cond) passed++; else { failed++; console.log(`  ❌ ${name} ${detail}`) } }
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-test-'))
const mesh = new MeshCore(ROOT, { leaseMs: 400, heartbeatMs: 100 })

// 队列与 claim
mesh.enqueue(1, { n: 1 })
mesh.enqueue(2, { n: 2 })
check('任务入队', mesh.pending().length === 2, String(mesh.pending().length))
check('O_EXCL claim', mesh.claim(1, 'a', process.pid, Math.floor((Date.now() - process.uptime() * 1000) / 1000)) === true)
check('锁互斥（二次 claim 失败）', mesh.claim(1, 'b', process.pid, 0) === false)
check('锁内容协议', /^a:\d+:\d+$/.test(mesh.readLock(1)), mesh.readLock(1))
check('心跳有效（锁 mtime 更新）', mesh.heartbeat(1) === true)

// 租约超时判死（锁 mtime 老化）
const lock = path.join(ROOT, 'intent-queue', 'task-1.lock')
const past = new Date(Date.now() - 3000)
fs.utimesSync(lock, past, past)
const swept = mesh.sweep()
check('租约超时重派', swept.length === 1 && swept[0].reason.includes('lease-timeout'), JSON.stringify(swept))
check('dead-letter 保存现场', fs.existsSync(path.join(ROOT, 'shared/dead-letter', 'task-1.json')))

// 完成协议
mesh.finish(2, 'done-2')
check('完成入 done', fs.existsSync(path.join(ROOT, 'done', 'task-2.json')) && fs.existsSync(path.join(ROOT, 'done', 'task-2.result.json')))

// 收养（三证据：pid 死）
mesh.enqueue(3, { n: 3 })
mesh.claim(3, 'dead-agent', 999999, Math.floor((Date.now() - process.uptime() * 1000) / 1000))   // 不存在的 pid
const swept2 = mesh.sweep()
check('三证据收养（pid 死）', swept2.length === 1 && swept2[0].reason.includes('agent-dead'), JSON.stringify(swept2))

console.log('='.repeat(66))
console.log(`  dsh-mesh 核心测试: ${passed} 通过 / ${failed} 失败`)
console.log('='.repeat(66))
process.exit(failed > 0 ? 1 : 0)
