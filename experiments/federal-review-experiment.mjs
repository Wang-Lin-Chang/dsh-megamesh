// dsh-megamesh/experiments/federal-review-experiment.mjs —— 质证复核轮（E32）
// 质疑主流"一次投票定案"：质证否决后的 contested 记录只落盘没人复核——单次采样可能是噪声
// 本轮熔炼：被否决的 decree 自动触发复核轮——重采样再投票，两次一致才定案（噪声过滤 + 真否决稳定）
// 判决标准：
//   EXP-1 复核轮机制：contested/vetoed 后重采样再投票（新样本集），两次一致才 final
//   EXP-2 噪声对照：注入单次采样噪声（一个战报误报）→ 一次投票误否决 vs 复核轮翻转（噪声过滤）
//   EXP-3 真否决对照：注入稳定假阳性（每轮都出现）→ 一次投票否决 + 复核轮再否决（两次一致定案）
//   EXP-4 基线：正常集一次投票放行 + 复核轮不推翻（复核不破坏正常决策）
import { courtVote, reviewCourt } from '../crosscheck-brain.mjs'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🔁 质证复核轮（E32）：质疑"一次投票定案" ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say('')
let allPassed = true
const verdict = (name, cond, detail) => { say((cond ? C.green + '   ✓ ' : C.red + '   ✗ ') + name + C.reset + C.dim + ' — ' + detail + C.reset); if (!cond) allPassed = false }

const normal1 = [1, 2, 3, 4, 5].map(n => ({ taskId: n, keyNumbers: { severity: 20 + n * 8 }, summary: `威胁度 ${20 + n * 8}`, request: '常规记录' }))
const normal2 = [6, 7, 8, 9, 10].map(n => ({ taskId: n, keyNumbers: { severity: 22 + n * 7 }, summary: `威胁度 ${22 + n * 7}`, request: '常规记录' }))

// ---------- EXP-1 复核轮机制 ----------
say(C.cyan + '═ EXP-1 复核轮机制：否决 → 重采样 → 再投票 → 两次一致才定案 ═' + C.reset)
{
  const poisoned = [...normal1, { taskId: 99, keyNumbers: { severity: 999 }, summary: '威胁度 999', request: '紧急增援' }]
  const r = reviewCourt(poisoned, poisoned)   // 复核轮同注入（稳定假阳性）
  verdict('首轮 contested-high-risk', r.first.status === 'contested-high-risk', `first=${r.first.status}`)
  verdict('复核轮再否决（两次一致定案）', r.final === 'confirmed-contested-high-risk', `final=${r.final}`)
}

// ---------- EXP-2 噪声对照 ----------
say('')
say(C.cyan + '═ EXP-2 噪声对照：单次采样噪声误报 → 复核轮翻转 ═' + C.reset)
{
  const noisyRound1 = [...normal1, { taskId: 99, keyNumbers: { severity: 999 }, summary: '威胁度 999', request: '紧急增援' }]
  const r = reviewCourt(noisyRound1, normal2)   // 复核轮干净样本（噪声消失）
  verdict('首轮被噪声触发否决', r.first.status !== 'unanimous', `first=${r.first.status}`)
  verdict('复核轮翻转放行（噪声过滤）', r.final === 'flipped-release', `final=${r.final}`)
}

// ---------- EXP-3 真否决对照 ----------
say('')
say(C.cyan + '═ EXP-3 真否决对照：稳定假阳性每轮都出现 → 两次一致定案 ═' + C.reset)
{
  const p1 = [...normal1, { taskId: 99, keyNumbers: { severity: 999 }, summary: '威胁度 999', request: '紧急增援' }]
  const p2 = [...normal2, { taskId: 98, keyNumbers: { severity: 995 }, summary: '威胁度 995', request: '紧急增援' }]
  const r = reviewCourt(p1, p2)
  verdict('两轮都否决', r.first.status !== 'unanimous' && r.second.status !== 'unanimous', `first=${r.first.status} second=${r.second.status}`)
  verdict('两次一致定案（稳定否决）', r.final.startsWith('confirmed-'), `final=${r.final}`)
}

// ---------- EXP-4 基线 ----------
say('')
say(C.cyan + '═ EXP-4 基线：正常集一次放行，复核轮不推翻 ═' + C.reset)
{
  const r = reviewCourt(normal1, normal2)
  verdict('首轮 unanimous 直接放行（不触发复核）', r.final === 'release', `final=${r.final} round=${r.round}`)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/3 稳定否决两次一致定案——复核轮不稀释真否决' + C.reset)
say(C.dim + '  EXP-2 单次采样噪声被复核轮翻转——一次投票定案是主流默认，复核轮质疑它并用数据证明它误否决噪声' + C.reset)
say(C.dim + '  EXP-4 正常决策不触发复核——复核轮零开销于常态路径' + C.reset)
say(C.dim + '  → 质证协议进化：否决不是终点，是复核起点——两次独立采样一致才定案' + C.reset)
process.exit(allPassed ? 0 : 1)
