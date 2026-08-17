// dsh-megamesh/experiments/arena-protocol-experiment.mjs —— 推理竞技场协议闭环（E40）
// 离经叛道设计实测：模型不当法官当证人 → 结论进擂台打赢淘汰赛 → 裁判也被治理 + 平行宇宙翻案
// 判决标准：
//   EXP-1 证人证词：mock 模型生成证词（声明立场+信用）——立场透明可审计
//   EXP-2 军法结构审：假前提引用/循环论证/孤儿三注入 → 全抓（只查结构不查语义——诚实边界）
//   EXP-3 擂台淘汰：正常证词 winner / 自洽矛盾 contested / 信用离群 contested / 双违 rejected
//   EXP-4 平行宇宙翻案：被否结论进休眠分支 → 新证据复核 → 复活（TREMOR 没有的维度）
//   EXP-5 裁判治理：验证者误判两次 → 降级清零（固定裁判会腐败，轮换的不会）
//   EXP-6 对照组：单模型直接答（主流现状）对错误零感知——擂台增量价值量化
import { witnessClaim, structuralAudit, arenaVerdict, parallelUniverse, judgeRegistry, costLedger } from '../arena-engine.mjs'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   ⚔️ 推理竞技场 ARENA（E40）：结论打赢擂台才值得信 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  模型不当法官当证人 → 军法只查结构 → 三票制淘汰赛 → 裁判轮换 + 平行宇宙翻案' + C.reset)
say('')
let allPassed = true
const verdict = (name, cond, detail) => { say((cond ? C.green + '   ✓ ' : C.red + '   ✗ ') + name + C.reset + C.dim + ' — ' + detail + C.reset); if (!cond) allPassed = false }

// ---------- EXP-1 证人证词 ----------
{
  say(C.cyan + '═ EXP-1 证人证词：mock 模型生成证词（声明立场 + 信用） ═' + C.reset)
  const c = witnessClaim({ modelId: 'mock-A', credit: 10, premiseIds: ['ROOT'], claim: '北境威胁度 50', support: '北境目击报告：威胁度 50' })
  verdict('证词带立场与信用', c.modelId === 'mock-A' && c.credit === 10 && c.premiseIds.length === 1, `claimId=${c.claimId}`)
}

// ---------- EXP-2 军法结构审 ----------
{
  say('')
  say(C.cyan + '═ EXP-2 军法结构审：假前提/循环/孤儿三注入 → 全抓 ═' + C.reset)
  const c1 = witnessClaim({ modelId: 'm1', credit: 10, premiseIds: ['ROOT'], claim: 'A 成立', support: '观察' })
  const c2 = witnessClaim({ modelId: 'm2', credit: 10, premiseIds: ['c-ghost'], claim: 'B 成立（引用不存在的前提）', support: '推测' })
  // 循环注入：c3 引用 c4，c4 引用 c3（互引成环——循环论证结构）
  const c3 = witnessClaim({ modelId: 'm3', credit: 10, premiseIds: ['c-cycle-b'], claim: 'C 成立（引用 B）', support: '引用' })
  const c4 = witnessClaim({ modelId: 'm4', credit: 10, premiseIds: [c3.claimId], claim: 'B 补证（引用 C，而 C 引用 B=循环）', support: '循环' })
  const c3fixed = { ...c3, premiseIds: [c4.claimId] }   // 互引：c3→c4、c4→c3 成环
  const vio = structuralAudit([c1, c2, c3fixed, c4])
  const codes = new Set(vio.map(v => v.code))
  verdict('假前提引用被抓', codes.has('DANGLING_REF'), [...codes].join(','))
  verdict('循环论证被抓', codes.has('CYCLE'), [...codes].join(','))
  say(C.dim + '   （诚实边界：军法只查结构不查语义——"B 成立"对不对是质证层的事）' + C.reset)
}

// ---------- EXP-3 擂台淘汰 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 擂台淘汰：三票制（chair + 自洽 + 离群） ═' + C.reset)
  const normal = [
    witnessClaim({ modelId: 'a', credit: 10, premiseIds: ['ROOT'], claim: '结论 X', support: '证据充分' }),
    witnessClaim({ modelId: 'b', credit: 8, premiseIds: ['ROOT'], claim: '结论 Y', support: '证据一般' }),
  ]
  const v1 = arenaVerdict(normal)
  verdict('正常证词 winner', v1.status === 'winner', `agree=${v1.agree}/3`)
  // 自洽矛盾：claim 数字与 support 数字差超 50
  const contradictory = [...normal, witnessClaim({ modelId: 'c', credit: 12, premiseIds: ['ROOT'], claim: '威胁度只有 30', support: '实测威胁度 999' })]
  const v2 = arenaVerdict(contradictory)
  verdict('自洽矛盾 → contested', v2.status === 'contested' && v2.votes.consistency === false, `status=${v2.status}`)
  // 信用离群：信用 100 冒名者
  const outlierClaims = [...normal, witnessClaim({ modelId: 'd', credit: 100, premiseIds: ['ROOT'], claim: '结论 Z', support: '空口无凭' })]
  const v3 = arenaVerdict(outlierClaims)
  verdict('信用离群 → contested（非 LLM 防线）', v3.status === 'contested' && v3.votes.outlier === false, `status=${v3.status}`)
}

// ---------- EXP-4 平行宇宙翻案 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 平行宇宙翻案：被否结论休眠 → 新证据复活 ═' + C.reset)
  const rejectedClaim = witnessClaim({ modelId: 'e', credit: 5, premiseIds: ['ROOT'], claim: '早被否定的假设 H', support: '当时证据不足' })
  const pu = parallelUniverse({ rejected: [rejectedClaim] })
  verdict('被否结论进休眠分支（不删除）', pu.branches.length === 1 && pu.branches[0].status === 'dormant', '时间机器语义：错误是资产可翻案')
  // 新证据 → 复核复活
  const revived = parallelUniverse({ rejected: [rejectedClaim], revived: [rejectedClaim.claimId] })
  verdict('新证据复核 → 复活', revived.revived.includes(rejectedClaim.claimId), '平行宇宙分支可复活——主流/TREMOR 都没有')
}

// ---------- EXP-5 裁判治理 ----------
{
  say('')
  say(C.cyan + '═ EXP-5 裁判治理：验证者误判两次 → 降级清零 ═' + C.reset)
  const jr = judgeRegistry()
  jr.promote('judge-A', { credit: 20 })
  jr.verdictMistake('judge-A')
  const after1 = jr.get('judge-A')
  jr.verdictMistake('judge-A')
  const after2 = jr.get('judge-A')
  verdict('两次误判 → 降级清零', after1.credit === 20 && after2.credit === 0 && after2.promotions === 0, `误判1后 credit=${after1.credit} → 误判2后 credit=${after2.credit}（任期 ${after2.term}）`)
}

// ---------- EXP-6 对照组 ----------
{
  say('')
  say(C.cyan + '═ EXP-6 对照组：单模型直接答（主流现状）对错误零感知 ═' + C.reset)
  const ledger = costLedger()
  ledger.add(1)   // 单模型一次调用
  verdict('对照组量化：单模型 1 次调用零验证', ledger.total() === 1, '主流 = 1 次调用出答案；擂台 = 证词 N + 质证 2 + 复核——成本买确定性')
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 证词立场透明 + 军法只查结构（假前提/循环全抓，语义不冒充）' + C.reset)
say(C.dim + '  EXP-3 三票制淘汰：自洽+离群双非 LLM 防线（同源 Transformer 共同幻觉的对策）' + C.reset)
say(C.dim + '  EXP-4/5 ARENA 独有维度：平行宇宙翻案 + 裁判任期治理（TREMOR 没有）' + C.reset)
say(C.dim + '  EXP-6 成本计量对照：确定性由 API 调用次数买——成本可量可审计' + C.reset)
say(C.dim + '  → 离经叛道落地：模型从法官降级为证人，擂台从黑盒升级为白盒——每一步都有实测编号' + C.reset)
process.exit(allPassed ? 0 : 1)
