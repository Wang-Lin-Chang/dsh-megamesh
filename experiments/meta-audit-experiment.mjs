// dsh-megamesh/experiments/meta-audit-experiment.mjs —— 元审计军（E36）
// 质疑主流现状："审计器本身无人审计"——F_1 审计人的代码，F_1 的盲区无人抓
// 本轮熔炼：三独立实现交叉（正则聚合/逐词扫描/字节流），盲区注入实测，分歧账本 + 人类复核
// 判决标准：
//   EXP-1 基线一致：三实现对同一批文件命中集一致（交叉验证 = 假交叉的对照）
//   EXP-2 盲区注入：F_1 跳过 .txt 文件（模拟审计器盲区）→ F_2 抓到漏报 → 分歧进账本
//   EXP-3 对照组：单 F_1 审计对自身盲区零感知（主流现状量化）
//   EXP-4 递归两层：F_3（字节流）抽查 F_2 的审计结果——两层一致才定案
import { scanA, scanB, scanC, crossCheck, metaAudit } from '../meta-audit.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORDS = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'lab', 'bad-words.json'), 'utf-8'))
const DIVERGENCE_PATH = path.join(HERE, '..', 'shared', 'consensus', 'audit-divergence.jsonl')

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🔍 元审计军（E36）：质疑"审计器本身无人审计" ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  三独立实现（正则/逐词/字节流）交叉审计——盲区注入实测 + 分歧账本 + 递归两层' + C.reset)
say('')
let allPassed = true
const verdict = (name, cond, detail) => { say((cond ? C.green + '   ✓ ' : C.red + '   ✗ ') + name + C.reset + C.dim + ' — ' + detail + C.reset); if (!cond) allPassed = false }

// 测试目标文件集（在 tmp 里造，不污染仓库）
const TARGET = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-audit-target-'))
const files = {}
const mk = (name, content) => { const p = path.join(TARGET, name); fs.writeFileSync(p, content); files[name] = content }
mk('clean.mjs', '// 干净的代码\nconst x = 1\n')
mk('hit.mjs', `// 这一段有 ${WORDS[0]}\nconst y = 2\n`)
mk('hit.txt', `这是纯文本，但包含 ${WORDS[1]}\n`)

// ---------- EXP-1 基线一致：三实现交叉 ----------
{
  say(C.cyan + '═ EXP-1 基线一致：三实现对同一批文件命中集交叉验证 ═' + C.reset)
  let consistent = true
  for (const [name, text] of Object.entries(files)) {
    const a = scanA(text, WORDS), b = scanB(text, WORDS), c = scanC(text, WORDS)
    const ab = crossCheck(a, b), ac = crossCheck(a, c)
    const ok = ab.consistent && ac.consistent
    if (!ok) consistent = false
    say(C.dim + `   ${name}: A=${a.length} B=${b.length} C=${c.length} → ${ok ? '一致' : '分歧 ✗'}` + C.reset)
  }
  verdict('三实现命中集一致（假交叉的对照）', consistent, '三路径同结论 = 交叉验证基线')
}

// ---------- EXP-2 盲区注入：F_1 有盲区 → F_2 抓到 ----------
let divergenceRecorded = false
{
  say('')
  say(C.cyan + '═ EXP-2 盲区注入：F_1 跳过 .txt（模拟审计器盲区）→ F_2 抓到 ═' + C.reset)
  // F_1 模拟：只扫 .mjs 文件（审计器实现时漏配了扩展名——真实的盲区形态）
  const f1Results = Object.entries(files)
    .filter(([name]) => name.endsWith('.mjs'))
    .map(([file, text]) => ({ file, hits: scanA(text, WORDS) }))
  // F_2 用独立实现重扫全部文件（无扩展名盲区）
  const divergences = metaAudit(f1Results, files, WORDS, scanB)
  divergenceRecorded = divergences.length > 0
  verdict('F_2 抓到 F_1 漏报（.txt 命中）', divergences.some(d => d.file === 'hit.txt'), JSON.stringify(divergences.map(d => `${d.file}: f1=${d.f1} f2=${d.f2}`)))
  // 分歧账本落盘 + 人类复核标记
  if (divergences.length > 0) {
    fs.appendFileSync(DIVERGENCE_PATH, JSON.stringify({ at: Date.now(), round: 'E36', divergences: divergences.map(d => ({ file: d.file, f1Hits: d.f1, f2Hits: d.f2 })), humanReview: 'pending' }) + '\n')
    verdict('分歧进账本（append-only）', fs.existsSync(DIVERGENCE_PATH), 'audit-divergence.jsonl + humanReview=pending')
  }
}

// ---------- EXP-3 对照组：单 F_1 审计零感知 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 对照组：单 F_1 审计对自身盲区零感知 ═' + C.reset)
  const f1Only = Object.entries(files)
    .filter(([name]) => name.endsWith('.mjs'))
    .map(([file, text]) => ({ file, hits: scanA(text, WORDS) }))
  const f1Total = f1Only.reduce((s, r) => s + r.hits.length, 0)
  const trueTotal = Object.values(files).reduce((s, t) => s + scanC(t, WORDS).length, 0)
  verdict('对照组量化：单审计器漏报', f1Total < trueTotal, `F_1 报 ${f1Total} 命中 vs 真值 ${trueTotal}——主流"审计器无人审计"的代价`)
}

// ---------- EXP-4 递归两层：F_3 抽查 F_2 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 递归两层：F_3（字节流）抽查 F_2 的审计结果 ═' + C.reset)
  // F_2 全量审计（逐词扫描）
  const f2Results = Object.entries(files).map(([file, text]) => ({ file, hits: scanB(text, WORDS) }))
  // F_3 用字节流独立重扫核对 F_2 的结论
  const f3Divergences = metaAudit(f2Results, files, WORDS, scanC)
  verdict('F_3 核对 F_2 零分歧（两层一致定案）', f3Divergences.length === 0, `F_3 抽查分歧 ${f3Divergences.length} 处`)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 三独立实现基线一致——交叉验证是真的交叉，不是同一代码跑两遍' + C.reset)
say(C.dim + '  EXP-2 盲区注入实测：F_1 漏配扩展名 → F_2 独立实现抓到 → 分歧账本 + 人类复核标记' + C.reset)
say(C.dim + '  EXP-3 对照组量化主流现状：单审计器对自身盲区零感知（漏报数 = 盲区大小）' + C.reset)
say(C.dim + '  EXP-4 递归两层：F_3 抽查 F_2 一致才定案——审计的审计，两层起步' + C.reset)
say(C.dim + '  → 预言五落地：meta-audit 交叉审计机制就位；哥德尔残余 = 账本里的 humanReview 标记（不写公式，写分歧）' + C.reset)
process.exit(allPassed ? 0 : 1)
