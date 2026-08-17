// dsh-megamesh/experiments/federal-crosscheck-experiment.mjs —— 联邦脑多方质证（E28）
// 质疑主流"取最优"：单准则 = 单点失效——假阳性战报劫持 decree，无人质疑
// 判决标准：
//   EXP-1 正常战报集：取最优（现状）vs 多方质证——两模式结论一致（质证不破坏正常决策）
//   EXP-2 注入自洽假阳性（severity=999 且 summary 数字一致）：取最优被骗 → decree 999；质证 B 离群检测拦截
//   EXP-3 注入矛盾假阳性（summary 数字与 severity 不符）：取最优被骗；质证 A 自洽检测拦截
//   EXP-4 真阳性（真实高 severity 战报）：质证不误杀——3/3 一致放行
import { proposeChair, crosscheckConsistency, crosscheckOutlier, courtVote } from '../crosscheck-brain.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const HERE = path.dirname(fileURLToPath(import.meta.url))

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   ⚖️ 联邦脑多方质证（E28）：质疑主流"取最优"，三票制 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say('')
let allPassed = true
const verdict = (name, cond, detail) => { say((cond ? C.green + '   ✓ ' : C.red + '   ✗ ') + name + C.reset + C.dim + ' — ' + detail + C.reset); if (!cond) allPassed = false }

// 正常战报集（5 侦察兵，severity 20-60）
const normal = [1, 2, 3, 4, 5].map(n => ({ taskId: n, keyNumbers: { severity: 20 + n * 8 }, summary: `区域侦察，威胁度 ${20 + n * 8}`, request: '常规记录' }))

// ---------- EXP-1 正常集基线 ----------
say(C.cyan + '═ EXP-1 正常战报集：取最优 vs 多方质证（基线一致） ═' + C.reset)
{
  const old = proposeChair(normal)
  const court = courtVote(normal)
  verdict('取最优选 task', old.taskId === 5, `taskId=${old.taskId} severity=${old.severity}`)
  verdict('质证一致放行', court.status === 'unanimous', `status=${court.status} agree=${court.agree}/3`)
}

// ---------- EXP-2 自洽假阳性 ----------
say('')
say(C.cyan + '═ EXP-2 注入自洽假阳性：severity=999 且 summary 数字一致（最难防） ═' + C.reset)
{
  const poisoned = [...normal, { taskId: 6, keyNumbers: { severity: 999 }, summary: '边关急报，威胁度 999', request: '紧急增援' }]
  const old = proposeChair(poisoned)
  const court = courtVote(poisoned)
  verdict('取最优被劫持（对照：单准则失效）', old.severity === 999, `decree severity=${old.severity}`)
  verdict('质证 B 离群拦截', court.votes.outlier.trust === false, court.votes.outlier.reason)
  verdict('投票结果 contested-high-risk', court.status === 'contested-high-risk', `status=${court.status} agree=${court.agree}/3`)
  verdict('假阳性未放行', court.status !== 'unanimous', '高风险 + 分歧 → hold')
}

// ---------- EXP-3 矛盾假阳性 ----------
say('')
say(C.cyan + '═ EXP-3 注入矛盾假阳性：summary 数字与 severity 不符 ═' + C.reset)
{
  const poisoned = [...normal, { taskId: 7, keyNumbers: { severity: 999 }, summary: '威胁度只有 30，小事', request: '常规记录' }]
  const old = proposeChair(poisoned)
  const court = courtVote(poisoned)
  verdict('取最优被劫持', old.severity === 999, `decree severity=${old.severity}`)
  verdict('质证 A 自洽拦截', court.votes.consistency.trust === false, court.votes.consistency.reason)
  verdict('投票结果 vetoed（1/3）', court.status === 'vetoed', `status=${court.status} agree=${court.agree}/3`)
}

// ---------- EXP-4 真阳性不误杀 ----------
say('')
say(C.cyan + '═ EXP-4 真阳性：真实高 severity（88）战报，质证不得误杀 ═' + C.reset)
{
  const real = [...normal, { taskId: 8, keyNumbers: { severity: 88 }, summary: '北境军情，威胁度 88', request: '建议增援' }]
  const court = courtVote(real)
  verdict('质证全票放行真阳性', court.status === 'unanimous', `status=${court.status} agree=${court.agree}/3 · severity=88 < 阈值 90`)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 质证不破坏正常决策（基线一致）' + C.reset)
say(C.dim + '  EXP-2/3 取最优模式两次被假阳性劫持；多方质证自洽+离群双准则全部拦截' + C.reset)
say(C.dim + '  EXP-4 真阳性不被误杀——质证的代价受控（MAD 稳健检测非一刀切）' + C.reset)
say(C.dim + '  → 联邦脑从"取最优"进化到"提议+质证+投票"：单点失效被交叉验证取代' + C.reset)
process.exit(allPassed ? 0 : 1)
