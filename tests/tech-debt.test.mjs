// tests/tech-debt.test.mjs —— 技术债修复验证单测（D5 三证据跨平台 / D9 瞬态 GC / D3 事件日志）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MeshCore } from '../mesh-core.mjs'
import { MegaMesh } from '../megamesh.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

test('D5：procStartSec 已跨平台化（静态验证：ESM import + win32 powershell 分支 + ps 分支）', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'mesh-core.mjs'), 'utf-8')
  assert.ok(src.includes("import { execFileSync } from 'node:child_process'"))   // ESM import（修复 require 失效）
  assert.ok(src.includes("process.platform === 'win32'"))                          // win32 分支
  assert.ok(src.includes("'-o', 'lstart='"))                                       // linux/darwin ps 分支
  assert.ok(!src.includes("require('node:child_process')"))                        // ESM 内不再有 require
})

test('D5：isAgentAlive 对当前进程为 true', () => {
  const mesh = new MeshCore(fs.mkdtempSync(path.join(os.tmpdir(), 'dtest-')))
  assert.equal(mesh.isAgentAlive(process.pid), true)
})

test('D3：release 重试失败记入事件日志（不再静默）', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dtest-'))
  const mesh = new MeshCore(root)
  // 制造失败：锁不存在 → unlink 抛 ENOENT → 5 次重试全记日志
  mesh.release('nonexistent')
  const events = fs.readFileSync(path.join(root, 'agents', 'mesh-events.jsonl'), 'utf-8').trim().split('\n')
  assert.equal(events.length, 5)
  for (const e of events) assert.ok(JSON.parse(e).type === 'release-retry')
})

test('D9：transientGC 清理超龄瞬态文件、保留新鲜文件', () => {
  const mm = new MegaMesh(fs.mkdtempSync(path.join(os.tmpdir(), 'dtest-')), { leaseMs: 2500, heartbeatMs: 600 })
  const respDir = path.join(mm.root, 'shared', 'expand-resps')
  fs.writeFileSync(path.join(respDir, 'old.json'), '{}')
  const oldT = new Date(Date.now() - 2 * 3600_000)
  fs.utimesSync(path.join(respDir, 'old.json'), oldT, oldT)
  fs.writeFileSync(path.join(respDir, 'fresh.json'), '{}')
  const cleaned = mm.transientGC(3600_000)
  assert.equal(cleaned, 1)
  assert.equal(fs.existsSync(path.join(respDir, 'old.json')), false)
  assert.equal(fs.existsSync(path.join(respDir, 'fresh.json')), true)
})
