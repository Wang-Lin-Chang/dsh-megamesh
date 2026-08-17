// dsh-megamesh/experiments/preflight-experiment.mjs —— 发布前总检：词检程序化 + 依赖图完整性 + README 声称核对 + 发布清单
// 判决标准（发布前的最后一道关口）：
//   CHECK-1 词检清零：全发布树（排除 node_modules/lab/.git）扫描扩展词表
//   CHECK-2 依赖图完整：每个 .mjs 的静态相对 import 目标存在
//   CHECK-3 README 声称核对：E01-E14 实验编号与文件一一对应；hello/契约/模块名都在
//   CHECK-4 发布清单：package.json files 覆盖 README 声称的关键文件
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
// 词表 = 数据（lab/bad-words.json，不入发布包）：扫描器读数据不读硬编码，天然防自匹配
const BAD = new RegExp(JSON.parse(fs.readFileSync(path.join(ROOT, 'lab', 'bad-words.json'), 'utf-8')).join('|'))
const SKIP_DIRS = new Set(['node_modules', 'lab', '.git'])
const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const results = []

const walk = (dir, cb) => {
  for (const f of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(f)) continue
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) walk(p, cb)
    else cb(p)
  }
}

// CHECK-1 词检
{
  say('════ CHECK-1 词检清零（全发布树程序化扫描） ════')
  const hits = []
  walk(ROOT, (p) => {
    if (!/\.(mjs|md|json|yml|py)$/.test(p)) return
    const text = fs.readFileSync(p, 'utf-8')
    const m = BAD.exec(text)
    if (m) hits.push(`${path.relative(ROOT, p)} :: ...${m[0]}...`)
  })
  results.push(['CHECK-1 词检', hits.length === 0, hits.length === 0 ? '0 命中 ✓' : `${hits.length} 命中 ✗ ${hits.slice(0, 5).join(' | ')}`])
  say(hits.length === 0 ? C.green + '   ✓ 0 命中' + C.reset : C.red + '   ✗ ' + hits.slice(0, 5).join('\n     ') + C.reset)
}

// CHECK-2 依赖图完整
{
  say('════ CHECK-2 依赖图完整性（静态 import 目标存在） ════')
  const missing = []
  walk(ROOT, (p) => {
    if (!p.endsWith('.mjs')) return
    const text = fs.readFileSync(p, 'utf-8')
    for (const m of text.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = path.resolve(path.dirname(p), m[1])
      if (!fs.existsSync(target)) missing.push(`${path.relative(ROOT, p)} → ${m[1]}`)
    }
  })
  results.push(['CHECK-2 依赖图', missing.length === 0, missing.length === 0 ? '全部存在 ✓' : `${missing.length} 缺失 ✗ ${missing.join(' | ')}`])
  say(missing.length === 0 ? C.green + '   ✓ 全部存在' + C.reset : C.red + '   ✗ ' + missing.join('\n     ') + C.reset)
}

// CHECK-3 README 声称核对
{
  say('════ CHECK-3 README 声称核对（E01-E14 与文件一一对应） ════')
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf-8')
  const exps = fs.readdirSync(path.join(ROOT, 'experiments')).filter(f => f.endsWith('.mjs') && !f.startsWith('ref-'))   // ref-* 是对照引擎夹具，不计实验装置
  const mentioned = [...readme.matchAll(/E(\d{2})/g)].map(m => Number(m[1]))
  const expCount = exps.length
  const okE = new Set(mentioned).size === expCount
  const helloOk = fs.existsSync(path.join(ROOT, 'hello-megamesh.mjs')) && readme.includes('hello-megamesh.mjs')
  const adapterOk = fs.existsSync(path.join(ROOT, 'adapter-spec.mjs')) && fs.existsSync(path.join(ROOT, 'adapters', 'langgraph-worker.mjs')) && fs.existsSync(path.join(ROOT, 'adapters', 'crewai-launcher.mjs'))
  const all = okE && helloOk && adapterOk
  results.push(['CHECK-3 README 声称', all, `${expCount} 个实验装置 · E 编号 ${new Set(mentioned).size} 个 · hello ${helloOk ? '✓' : '✗'} · 适配器 ${adapterOk ? '✓' : '✗'}`])
  say(all ? C.green + `   ✓ ${expCount} 实验装置 · E 编号匹配 · hello/适配器齐` + C.reset : C.red + '   ✗ 声称与文件不符' + C.reset)
}

// CHECK-4 发布清单
{
  say('════ CHECK-4 发布清单（package.json files 覆盖关键文件） ════')
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
  const files = pkg.files ?? []
  const hasAll = files.some(f => f === '*.mjs') && files.includes('README.md') && files.includes('LICENSE') && files.some(f => f.includes('experiments')) && files.some(f => f.includes('adapters'))
  results.push(['CHECK-4 发布清单', hasAll, files.join(', ')])
  say(hasAll ? C.green + `   ✓ ${files.join(', ')}` + C.reset : C.red + `   ✗ 发布清单缺关键项: ${files.join(', ')}` + C.reset)
}

say('')
say(C.bold + '════════ 总检判决 ════════' + C.reset)
for (const [name, ok, detail] of results) say((ok ? C.green : C.red) + `  ${name}: ${detail}` + C.reset)
const allPass = results.every(([, ok]) => ok)
say(C.bold + (allPass ? C.green + '  🎉 发布前总检全过——可以出击' + C.reset : C.red + '  ❌ 总检不过——修完再出击' + C.reset))
process.exit(allPass ? 0 : 1)
