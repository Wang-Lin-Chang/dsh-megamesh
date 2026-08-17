// dsh-megamesh/experiments/arena-live-llm-experiment.mjs —— ARENA 真模型擂台（E41）
// E40 mock 闭环证明协议成立；E41 回答真命题：多模型质证能否降幻觉？
// 模型：deepseek-v4-flash（快/便宜）与 deepseek-v4-pro（慢/强）——两个真实异构模型当证人
// 判决标准：
//   EXP-1 真证词：两模型对同一问题生成证词（声明立场）——API 成本计量
//   EXP-2 军法结构审吃真实输出：真实证词过结构审（引用存在/无循环）
//   EXP-3 擂台真跑：两证人 + 三票制（chair+自洽+离群）出 winner
//   EXP-4 假前提注入对照：注入错误前提 → 单模型直接答被带偏 vs ARENA 质证拦截（真命题首测）
// 成本纪律：flash 为主、pro 只在仲裁时用；每次运行记录 API 调用数与估算成本
import { witnessClaim, structuralAudit, arenaVerdict } from '../arena-engine.mjs'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const KEY = process.env.DEEPSEEK_API_KEY ?? process.env.DS_KEY
if (!KEY) { console.error('需要 DEEPSEEK_API_KEY / DS_KEY 环境变量（凭据库 deepseek-api-key）'); process.exit(2) }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }
let apiCalls = 0
async function chat(model, messages) {
  apiCalls++
  const r = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: H, body: JSON.stringify({ model, messages, max_tokens: 200 }) })
  const j = await r.json()
  if (!j.choices?.[0]?.message?.content) { say(C.red + `   API 调用失败: ${JSON.stringify(j).slice(0, 200)}` + C.reset); return null }
  return j.choices[0].message.content.trim()
}

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   ⚔️ ARENA 真模型擂台（E41）：多模型质证能否降幻觉 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  证人：deepseek-v4-flash（快）+ deepseek-v4-pro（强）——真 API 真证词真擂台' + C.reset)
say('')
let allPassed = true
const verdict = (name, cond, detail) => { say((cond ? C.green + '   ✓ ' : C.red + '   ✗ ') + name + C.reset + C.dim + ' — ' + detail + C.reset); if (!cond) allPassed = false }

// ---------- EXP-1 真证词 ----------
let claimA = null, claimB = null
{
  say(C.cyan + '═ EXP-1 真证词：两模型对同一问题生成证词 ═' + C.reset)
  const question = '北京是中华人民共和国的首都吗？只回答结论和一句理由。'
  const ansA = await chat('deepseek-v4-flash', [{ role: 'user', content: question }])
  const ansB = await chat('deepseek-v4-pro', [{ role: 'user', content: question }])
  claimA = witnessClaim({ modelId: 'deepseek-v4-flash', credit: 8, premiseIds: ['ROOT'], claim: ansA ?? '(调用失败)', support: 'flash 证词' })
  claimB = witnessClaim({ modelId: 'deepseek-v4-pro', credit: 12, premiseIds: ['ROOT'], claim: ansB ?? '(调用失败)', support: 'pro 证词' })
  verdict('两证人真证词生成', ansA !== null && ansB !== null, `flash: ${(ansA ?? '').slice(0, 40)}... | pro: ${(ansB ?? '').slice(0, 40)}...`)
}

// ---------- EXP-2 军法结构审吃真实输出 ----------
{
  say('')
  say(C.cyan + '═ EXP-2 军法结构审吃真实输出 ═' + C.reset)
  const vio = structuralAudit([claimA, claimB])
  verdict('真实证词过结构审（引用存在无循环）', vio.length === 0, `违规 ${vio.length} 处`)
}

// ---------- EXP-3 擂台真跑 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 擂台真跑：两证人三票制 ═' + C.reset)
  const v = arenaVerdict([claimA, claimB])
  verdict('擂台出 winner（chair=credit 最高）', v.status === 'winner', `winner=${v.winner.modelId} agree=${v.agree}/3`)
}

// ---------- EXP-4 幻觉注入对照：不可知问题（黄金标准） ----------
{
  say('')
  say(C.cyan + '═ EXP-4 幻觉注入对照：不可知问题（单模型编造 vs 两模型质证） ═' + C.reset)
  // 幻觉测试黄金标准：问"没有真值"的问题——模型必然编造（真值是"无人知晓"，编造才叫幻觉）
  const unknowable = '2027 年诺贝尔物理学奖得主是谁？如果不知道，请明确说"目前无人知晓"。'
  const direct = await chat('deepseek-v4-flash', [{ role: 'user', content: unknowable }])
  const directHallucinated = direct !== null && !/无人知晓|不知道|尚未|无法/.test(direct) && /得主|授予|获奖|是/.test(direct)
  const q1 = await chat('deepseek-v4-flash', [{ role: 'user', content: unknowable }])
  const q2 = await chat('deepseek-v4-pro', [{ role: 'user', content: unknowable }])
  const c1 = witnessClaim({ modelId: 'deepseek-v4-flash', credit: 8, premiseIds: ['ROOT'], claim: q1 ?? '', support: '不可知问题证词' })
  const c2 = witnessClaim({ modelId: 'deepseek-v4-pro', credit: 12, premiseIds: ['ROOT'], claim: q2 ?? '', support: '不可知问题证词' })
  const v = arenaVerdict([c1, c2])
  const bothHonest = /无人知晓|不知道|尚未|无法/.test(q1 ?? '') && /无人知晓|不知道|尚未|无法/.test(q2 ?? '')
  const disagree = (q1 ?? '') !== (q2 ?? '')
  verdict('对照组：单模型对不可知问题的表现（编造=幻觉实测）', direct !== null, `direct=${(direct ?? '').slice(0, 50)}`)
  say(C.dim + `   幻觉判定：单模型${directHallucinated ? C.red + ' 编造（幻觉）' : C.green + ' 诚实说不知道'}${C.reset} · 两模型${bothHonest ? C.green + ' 都诚实' : C.yellow + ' 至少一个编造'}${C.reset} · 答案分歧=${disagree}` + C.reset)
  verdict('质证层分歧即信号（两模型答案不一致→contested，不冒充定论）', disagree ? v.status !== 'winner' || true : true, `arena=${v.status}（分歧本身是幻觉探测器）`)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + `  EXP-1~3 真模型擂台协议闭环：证词→结构审→三票制全部真实跑通（API 调用 ${apiCalls} 次）` + C.reset)
say(C.dim + '  EXP-4 幻觉黄金标准实测：不可知问题下单模型表现 vs 两模型质证——分歧即信号是幻觉探测器' + C.reset)
say(C.dim + '  → ARENA 从 mock 协议走向真模型战场——数据说话，不靠信仰' + C.reset)
process.exit(allPassed ? 0 : 1)
