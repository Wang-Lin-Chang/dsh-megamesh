// dsh-megamesh/experiments/tech-debt-audit.mjs —— 技术债审计：9 次迭代的程序化债单（每项债带文件:行号证据）
// 审计项：
//   D1 DRY 债：waitFor/sleep/spawn 辅助函数在实验装置里的重复定义数
//   D2 魔法数债：leaseMs/heartbeatMs 字面量的分散分布
//   D3 静默吞错债：空 catch 出现次数（按文件）
//   D4 忙等债：while(Date.now()) 忙等出现次数
//   D5 平台债：powershell 依赖（procStartSec 三证据在非 Windows 退化的隐患）
//   D6 确定性债：无种子 Math.random 的判决数字不可复现
//   D7 覆盖债：有单测的模块 vs 无单测的模块
//   D8 版本一致性：本地 package.json vs GitHub tag vs npm registry
//   D9 瞬态区累积债：expand-resps 无清理策略
//   D10 流程重复债：发布账本 vs 外部档案库双账本
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const C = { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const findings = []
const add = (id, severity, title, evidence) => findings.push({ id, severity, title, evidence })

const read = (p) => fs.readFileSync(p, 'utf-8')
const walk = (dir, cb) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'lab'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, cb)
    else cb(p)
  }
}
const allMjs = []
walk(ROOT, (p) => { if (p.endsWith('.mjs')) allMjs.push(p) })
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🏥 技术债审计 · 9 次迭代的程序化债单 · 每项债带证据          ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say('')

// ---------- D1 DRY 债 ----------
{
  const dup = {}
  for (const p of allMjs) {
    const t = read(p)
    if (/\bconst waitFor = /.test(t)) dup.waitFor = (dup.waitFor ?? 0) + 1
    if (/\bconst sleep = /.test(t)) dup.sleep = (dup.sleep ?? 0) + 1
    if (/\bconst spawnScout/.test(t) || /\bconst spawnAt = /.test(t)) dup.spawn = (dup.spawn ?? 0) + 1
  }
  const total = Object.values(dup).reduce((a, b) => a + b, 0)
  add('D1', 'MEDIUM', `DRY 债：辅助函数在实验装置里重复定义 ${total} 处`, JSON.stringify(dup))
  say(C.yellow + `   D1 DRY 债：waitFor/sleep/spawn 重复定义 ${total} 处 ${JSON.stringify(dup)}` + C.reset)
}

// ---------- D2 魔法数债 ----------
{
  const leases = new Map()
  for (const p of allMjs) {
    const t = read(p)
    for (const m of t.matchAll(/leaseMs:\s*(\d+)/g)) leases.set(m[1], (leases.get(m[1]) ?? 0) + 1)
  }
  add('D2', 'LOW', `魔法数债：leaseMs 字面量分布 ${JSON.stringify(Object.fromEntries(leases))}`, '租约参数分散在实验与模块两套值')
  say(C.dim + `   D2 魔法数债：leaseMs 取值分布 ${JSON.stringify(Object.fromEntries(leases))}` + C.reset)
}

// ---------- D3 静默吞错债 ----------
{
  // 口径：生产模块（根目录）的空 catch 才是债；实验装置的竞态/存在性空 catch 是装置语义
  const prodMjs = allMjs.filter(p => {
    const r = rel(p)
    return !r.includes('/') && r.endsWith('.mjs')
  })
  const silent = []
  for (const p of prodMjs) {
    const t = read(p)
    const n = (t.match(/catch \{\}/g) ?? []).length
    if (n > 0) silent.push(`${rel(p)}:${n}`)
  }
  const total = silent.reduce((a, s) => a + Number(s.split(':')[1]), 0)
  add('D3', total > 0 ? 'MEDIUM' : 'LOW', `静默吞错债（生产模块，待复核清单）：空 catch ${total} 处（${silent.join(', ')}）——多为 TOCTOU/文件存在性豁免，逐处复核见 lab/TECH-DEBT.md`, silent.join(','))
  say(total > 0 ? C.yellow + `   D3 静默吞错债（生产模块待复核）：${silent.join(', ')}` + C.reset : C.dim + '   D3 静默吞错债（生产模块）：0 处' + C.reset)
}

// ---------- D4 忙等债 ----------
{
  let count = 0
  for (const p of allMjs) {
    const t = read(p)
    count += (t.match(/while \(Date\.now\(\) < end\)/g) ?? []).length
  }
  add('D4', 'LOW', `忙等债：同步忙等 ${count} 处（CPU 空转）`, 'release 重试与 crewai-launcher 轮询')
  say(C.dim + `   D4 忙等债：${count} 处` + C.reset)
}

// ---------- D5 平台债 ----------
{
  const p = path.join(ROOT, 'mesh-core.mjs')
  const t = read(p)
  const crossPlatform = t.includes("process.platform === 'win32'") && t.includes("'-o', 'lstart='") && t.includes("import { execFileSync } from 'node:child_process'")
  if (crossPlatform) {
    add('D5', 'LOW', '平台债已修：procStartSec 跨平台化（win32 powershell / linux-darwin ps），ESM import 修复 require 失效', 'mesh-core.mjs:procStartSec')
    say(C.dim + '   D5 平台债已修：procStartSec 跨平台 + ESM import' + C.reset)
  } else {
    add('D5', 'HIGH', '平台债：procStartSec 依赖 powershell 且/或 require 失效——三证据 startSec 比对降级', 'mesh-core.mjs:procStartSec')
    say(C.yellow + '   D5 平台债未修' + C.reset)
  }
}

// ---------- D6 确定性债 ----------
{
  let count = 0
  const per = {}
  for (const p of allMjs.filter(x => rel(x).startsWith('experiments/'))) {
    const t = read(p)
    const n = (t.match(/Math\.random\(\)/g) ?? []).length
    if (n > 0) { count += n; per[rel(p)] = n }
  }
  add('D6', 'MEDIUM', `确定性债：${count} 处无种子 Math.random——实验判决数字不可复现`, JSON.stringify(per).slice(0, 200))
  say(C.yellow + `   D6 确定性债：${count} 处无种子随机` + C.reset)
}

// ---------- D7 覆盖债 ----------
{
  const modules = allMjs.filter(p => !rel(p).startsWith('experiments/') && !rel(p).startsWith('tests/') && !rel(p).includes('adapters'))
    .map(p => path.basename(p, '.mjs'))
  const tests = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.mjs')).map(f => f.replace('.test.mjs', ''))
  const uncovered = modules.filter(m => !tests.includes(m) && !['hello-megamesh', 'publish-preflight', 'publish-deploy', 'daily-cruise'].includes(m))
  add('D7', 'LOW', `覆盖债：${uncovered.length} 个模块无直接单测（${uncovered.join(', ')}）——依赖实验装置间接覆盖`, uncovered.join(','))
  say(C.dim + `   D7 覆盖债：${uncovered.length} 个模块无直接单测` + C.reset)
}

// ---------- D8 版本一致性（网络查 npm） ----------
{
  try {
    const local = JSON.parse(read(path.join(ROOT, 'package.json'))).version
    const npmVer = (await (await fetch('https://registry.npmjs.org/dsh-megamesh', { headers: { 'User-Agent': 'debt-audit' } })).json())['dist-tags'].latest
    const ok = local === npmVer
    add('D8', ok ? 'LOW' : 'HIGH', `版本一致性：本地 ${local} vs npm latest ${npmVer}`, ok ? '一致' : '不一致！')
    say(ok ? C.dim + `   D8 版本一致：本地 ${local} = npm ${npmVer}` + C.reset : C.yellow + `   D8 版本不一致：本地 ${local} vs npm ${npmVer}` + C.reset)
  } catch { add('D8', 'LOW', '版本一致性：npm 查询失败（离线审计）', '网络不可用'); say(C.dim + '   D8 npm 查询失败（离线）' + C.reset) }
}

// ---------- D9 瞬态区累积债 ----------
{
  let hasCleanup = false
  for (const p of allMjs) {
    const t = read(p)
    if (/transientGC|gcTransient/.test(t)) { hasCleanup = true; break }
  }
  add('D9', hasCleanup ? 'LOW' : 'MEDIUM', `瞬态区累积债：expand-resps ${hasCleanup ? '已有 GC' : '无清理策略——长期运行文件累积'}`, 'expand 回执按任务落盘，任务完成后不删除')
  say(hasCleanup ? C.dim + '   D9 瞬态区已有 GC' + C.reset : C.yellow + '   D9 瞬态区累积债：expand-resps 无清理（长期运行累积）' + C.reset)
}

// ---------- D10 双账本债 ----------
{
  add('D10', 'LOW', '双账本债：publish-ledger.jsonl（发布账本）与外部档案库两套记录，无自动同步', '发布账本在仓库透明公开；外部档案库在本地外部文件')
  say(C.dim + '   D10 双账本债：发布账本与外部档案库无同步机制' + C.reset)
}

say('')
say(C.bold + '════════ 债单判决 ════════' + C.reset)
const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
for (const f of findings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])) {
  say((f.severity === 'HIGH' ? C.red : f.severity === 'MEDIUM' ? C.yellow : C.dim) + `  [${f.severity}] ${f.id} ${f.title}` + C.reset)
}
say(C.bold + `   HIGH ${findings.filter(f => f.severity === 'HIGH').length} · MEDIUM ${findings.filter(f => f.severity === 'MEDIUM').length} · LOW ${findings.filter(f => f.severity === 'LOW').length}` + C.reset)
process.exit(findings.some(f => f.severity === 'HIGH') ? 1 : 0)
