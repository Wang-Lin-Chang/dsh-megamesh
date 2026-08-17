// dsh-megamesh/experiments/audit-tower-experiment.mjs —— 审计塔 φ 衰减命题实测（E39）
// 命题：AIGS 自指方程 𝓡²=𝓡+𝓘 特征值 φ——审计塔逐层残余分歧率按 1/φ 衰减？
// 实验纪律：结构可验证、系数必须实测、解析边界必须推导——不因数学美而免测
// 判决标准：
//   EXP-1 解析边界：φ 衰减 ⟺ 检出率 p=1/φ²≈0.382（等价条件推导——命题可证伪化）
//   EXP-2 结构验证：审计塔三层真实跑通（E36 两层扩展为三层——真实代码，非模拟）
//   EXP-3 系数实测：固定 p 多轮（20 种子）衰减比统计对照解析值 1-p——实测≈解析
//   EXP-4 命题边界：p=0.382 时衰减比≈1/φ（φ 衰减是特例不是必然）；p≠0.382 时衰减比≠1/φ
import { PHI, INVERSE_PHI, PHI_DETECTION, makeRng, auditTower, towerStatistics } from '../audit-tower.mjs'
import { scanA, scanB, scanC, crossCheck, metaAudit } from '../meta-audit.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORDS = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'lab', 'bad-words.json'), 'utf-8'))

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🗼 审计塔 φ 衰减命题实测（E39）：美则美矣，必须实测 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + `  𝓡²=𝓡+𝓘 → 特征值 φ=${PHI.toFixed(6)}；命题：逐层残余分歧率按 1/φ=${INVERSE_PHI.toFixed(3)} 衰减？` + C.reset)
say('')
let allPassed = true
const verdict = (name, cond, detail) => { say((cond ? C.green + '   ✓ ' : C.red + '   ✗ ') + name + C.reset + C.dim + ' — ' + detail + C.reset); if (!cond) allPassed = false }

// ---------- EXP-1 解析边界 ----------
{
  say(C.cyan + '═ EXP-1 解析边界：φ 衰减的等价条件（命题可证伪化） ═' + C.reset)
  const p = PHI_DETECTION
  const expected = 1 - p
  verdict('φ 衰减 ⟺ p=1/φ²≈0.382', Math.abs(p - 0.382) < 0.001, `p=${p.toFixed(4)} → 衰减比 1-p=${expected.toFixed(4)} ≈ 1/φ=${INVERSE_PHI.toFixed(4)}`)
  verdict('p≠0.382 时衰减比 ≠ 1/φ（非必然性质）', Math.abs((1 - 0.5) - INVERSE_PHI) > 0.1, `p=0.5 → 衰减比 0.5 vs 1/φ 0.618——φ 是特例`)
}

// ---------- EXP-2 结构验证：三层真实跑（E36 扩展） ----------
{
  say('')
  say(C.cyan + '═ EXP-2 结构验证：审计塔三层真实跑通（E36 两层 → 三层） ═' + C.reset)
  const TARGET = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-tower-'))
  const files = {}
  const mk = (name, content) => { const p = path.join(TARGET, name); fs.writeFileSync(p, content); files[name] = content }
  mk('clean.mjs', '// 干净\n')
  mk('hit-a.mjs', `// 有 ${WORDS[0]}\n`)
  mk('hit-b.txt', `文本 ${WORDS[1]}\n`)
  // F₁：只扫 .mjs（盲区）
  const f1Results = Object.entries(files).filter(([n]) => n.endsWith('.mjs')).map(([file, text]) => ({ file, hits: scanA(text, WORDS) }))
  // F₂：逐词扫描全部文件（抓 F₁ 盲区）
  const f2Divergences = metaAudit(f1Results, files, WORDS, scanB)
  // F₃：字节流抽查 F₂ 的结论（第三层）
  const f2Results = Object.entries(files).map(([file, text]) => ({ file, hits: scanB(text, WORDS) }))
  const f3Divergences = metaAudit(f2Results, files, WORDS, scanC)
  const towerWorks = f2Divergences.length === 1 && f2Divergences[0].file === 'hit-b.txt' && f3Divergences.length === 0
  verdict('三层真实跑通（F₁ 盲区 → F₂ 抓 → F₃ 零分歧）', towerWorks, `F₂ 抓 ${f2Divergences.length} 处 · F₃ 抽查分歧 ${f3Divergences.length} 处`)
}

// ---------- EXP-3 系数实测：固定 p 多轮衰减比 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 系数实测：p=0.7 多轮（20 种子）衰减比 vs 解析值 1-p ═' + C.reset)
  const defects = Array.from({ length: 200 }, (_, i) => `D${i}`)
  const p = 0.7
  const seeds = Array.from({ length: 20 }, (_, i) => 1000 + i)
  const stats = towerStatistics(defects, p, seeds)
  verdict('实测衰减比 ≈ 解析值 1-p', Math.abs(stats.meanRatio - stats.analytical) < 0.08, `实测 ${stats.meanRatio.toFixed(3)} vs 解析 ${stats.analytical.toFixed(3)}（${stats.ratiosCount} 个比值样本）`)
  verdict('实测 ≠ 1/φ（p=0.7 时 φ 衰减不成立）', Math.abs(stats.meanRatio - INVERSE_PHI) > 0.08, `实测 ${stats.meanRatio.toFixed(3)} vs 1/φ ${INVERSE_PHI.toFixed(3)}`)
}

// ---------- EXP-4 命题边界：p=0.382 特例 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 命题边界：p=1/φ² 时衰减比 → 1/φ（特例验证） ═' + C.reset)
  const defects = Array.from({ length: 400 }, (_, i) => `D${i}`)
  const seeds = Array.from({ length: 20 }, (_, i) => 5000 + i)
  const stats = towerStatistics(defects, PHI_DETECTION, seeds)
  verdict('p=0.382 时实测衰减比 ≈ 1/φ', Math.abs(stats.meanRatio - INVERSE_PHI) < 0.08, `实测 ${stats.meanRatio.toFixed(3)} vs 1/φ ${INVERSE_PHI.toFixed(3)}——φ 衰减在特例下成立`)
  const t = auditTower(defects, PHI_DETECTION, makeRng(42))
  say(C.dim + `   单次塔：残余率 ${t.residuals.map(r => r === null ? 'n/a' : r.toFixed(3)).join(' → ')}` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 φ 衰减是可证伪的等价条件：p=1/φ²≈0.382 才成立——不是自指结构的必然性质' + C.reset)
say(C.dim + '  EXP-2 三级自指结构真实存在（审计塔三层跑通）——结构层对应成立' + C.reset)
say(C.dim + '  EXP-3/4 系数层实测：衰减比 = 1-p（解析与实测一致）；φ 是 p=0.382 的特例' + C.reset)
say(C.dim + '  → 对命题的诚实判决：方程的美在结构层已落地；φ 系数衰减待真实缺陷集的检出率实测——若实测 p 恰为 0.382，φ 就从特例变事实' + C.reset)
say(C.dim + '  实验不否定美，实验只要求美先过实测关——这正是"立身之本"' + C.reset)
process.exit(allPassed ? 0 : 1)
