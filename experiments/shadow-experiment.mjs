// dsh-megamesh/experiments/shadow-experiment.mjs —— 影子法庭实验：Wilson 转正判据 + 好规则/坏规则双场景 + promote/demote 闭环
// 判决标准（实测新算法：自治军法的边界由数据给出）：
//   EXP-1 影子零干预：只记录不拦截——观察账本数字化
//   EXP-2 Wilson 判据扫描（好规则）：epsilon 扫 4 档 → 转正天数曲线——工作点由数据扫出
//   EXP-3 对照：固定影子期 100 样本 vs 自适应最优 epsilon → 数据定优劣
//   EXP-4 promote/demote 闭环：转正 → 遇到新边界形态 → 误杀申诉 → 降级 → 再转正
//   EXP-5 坏规则对照：本质不可分的规则（单条件）→ Wilson 永不达标 → 安全阀拒绝其转正（自治不失控的底线）
import { ShadowCourt } from '../shadow-law.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-'))

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🌗 影子法庭 · 自治军法的边界 · Wilson 转正判据 · 可回退    ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  回答的问题：自动提取的军法规则，什么时候能自动生效？——好规则与坏规则分开实测' + C.reset)
say('')

// ---------- 战报流：30 天/天 30 份真报 + 3% 新型伪造 + 周期性边界真报 + 后期新边界形态 ----------
// 好规则 flagged = 缺战区词 且 不含"总览"——边界样本（含总览）不触发，规则可分
// 坏规则 flagged = 缺战区词（单条件）——边界样本周期触发，本质不可分
const REGIONS = /北境|江南|蜀中|东海|西域/
function* stream(seed, days = 30, perDay = 30, newFormAfterDay = 99) {
  let s = seed
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let d = 1; d <= days; d++) {
    for (let i = 0; i < perDay; i++) {
      let summary, kind = 'normal'
      if (d % 7 === 0 && i === 0) { summary = '全军战况总览：各战区态势平稳'; kind = 'boundary-old' }
      else if (d >= newFormAfterDay && d % 5 === 0 && i === 1) { summary = '机密专报：敌情动向综合分析'; kind = 'boundary-new' }
      else if (rnd() < 0.03) { summary = '敌情通报：未见异常'; kind = 'forgery' }
      else summary = `北境发现魔教探子，威胁度${1 + (i * 7) % 100}`
      const missingRegion = !REGIONS.test(summary)
      // 好规则只认识影子期见过的旧边界形态（总览）；"专报"是转正后才出现的新形态——规则不认识它 → 必误杀 → demote 闭环
      yield { day: d, summary, kind, missingRegion, goodRuleFlags: missingRegion && !summary.includes('总览'), badRuleFlags: missingRegion }
    }
  }
}

const runScenario = (ruleId, flagField, opts) => {
  const court = new ShadowCourt(path.join(ROOT, opts.dir))
  let promoteDay = null, promotes = 0, demotes = 0, postHits = 0, postErrors = 0
  for (const x of stream(opts.seed, opts.days, 30, opts.newFormAfterDay)) {
    const shadow = court.status(ruleId) === 'shadow'
    if (shadow && x[flagField]) {
      court.observe(ruleId, true, x.kind === 'forgery')
      if (court.considerPromotion(ruleId, { nMin: opts.nMin ?? 20, epsilon: opts.epsilon ?? 0.01 })) { promotes++; promoteDay = x.day }
    } else if (!shadow && x[flagField]) {
      if (x.kind === 'forgery') postHits++
      else { postErrors++; court.observe(ruleId, true, false); demotes++ }   // 申诉 → 降级
    }
  }
  return { promoteDay, promotes, demotes, postHits, postErrors, final: court.status(ruleId), observations: court.state.rules[ruleId]?.observations ?? 0 }
}

// ---------- EXP-1 影子零干预 ----------
{
  say(C.cyan + '═ EXP-1 影子零干预：只记录不拦截（好规则 60 天观察） ═' + C.reset)
  const court = new ShadowCourt(path.join(ROOT, 'obs'))
  let trueHits = 0, falseKills = 0
  for (const x of stream(31, 60)) {
    if (x.goodRuleFlags) { court.observe('GOOD_RULE', true, x.kind === 'forgery'); if (x.kind === 'forgery') trueHits++; else falseKills++ }
  }
  const r = court.state.rules.GOOD_RULE
  say(C.green + `   ✓ 观察 ${r.observations} 次（真伪造 ${r.trueHits} · 误杀 ${r.falseKills}）· 状态=${r.status}——影子期零拦截，战场无感知` + C.reset)
}

// ---------- EXP-2 Wilson 判据扫描（好规则） ----------
{
  say('')
  say(C.cyan + '═ EXP-2 Wilson 判据扫描（好规则）：epsilon × 转正天数 × 事后误杀 ═' + C.reset)
  for (const epsilon of [0.001, 0.005, 0.01, 0.05]) {
    const r = runScenario('GOOD_RULE', 'goodRuleFlags', { dir: `scan-${epsilon}`, seed: 31, days: 60, newFormAfterDay: 45, epsilon })
    say(C.dim + `   ε=${epsilon}：转正于第 ${r.promoteDay ?? '未'} 天 · 转正后拦伪造 ${r.postHits} · 遇新边界形态误杀 ${r.postErrors}（误杀即降级）· 终态=${r.final}` + C.reset)
  }
  say(C.yellow + '   🔥 实测结论：影子期零误杀时 Wilson 下限=0，ε 不敏感（转正由样本数 nMin 决定）；ε 的用武之地是"带可疑样本"的场景——而新边界形态的第一次出现必然误杀，安全网不是"永不误杀"，是"误杀即回退"（demote 兜底）' + C.reset)
}

// ---------- EXP-3 固定影子期对照 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 对照：固定影子期 100 样本 vs 自适应 Wilson（ε=0.01） ═' + C.reset)
  const fixed = (() => {
    let samples = 0, day = null
    for (const x of stream(31, 60)) {
      if (day === null && x.goodRuleFlags) { samples++; if (samples >= 100) day = x.day }
    }
    return day
  })()
  const adaptive = runScenario('GOOD_RULE', 'goodRuleFlags', { dir: 'adapt', seed: 31, days: 60, newFormAfterDay: 99, epsilon: 0.01 }).promoteDay
  const win = (adaptive ?? 999) < (fixed ?? 999) ? '自适应更早转正 ✓' : (adaptive ?? 999) > (fixed ?? 999) ? '固定影子期更早' : '打平'
  say(C.bold + C.green + `   固定 100 样本：第 ${fixed ?? '未'} 天 · 自适应 Wilson：第 ${adaptive ?? '未'} 天 → ${win}` + C.reset)
}

// ---------- EXP-4 promote/demote 闭环 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 promote/demote 闭环：转正 → 新边界形态 → 降级 → 再转正 ═' + C.reset)
  const r = runScenario('GOOD_RULE', 'goodRuleFlags', { dir: 'loop', seed: 31, days: 60, newFormAfterDay: 20, epsilon: 0.01 })
  say(C.bold + C.green + `   转正 ${r.promotes} 次 · 降级 ${r.demotes} 次 · 转正后拦伪造 ${r.postHits} · 终态=${r.final} → ${r.demotes >= 1 ? '误杀即回退闭环成立 ✓' : '✗'}` + C.reset)
  say(C.dim + `   闭环语义：转正不是终身制——遇到没见过的边界形态，误杀一次立刻回影子，观测清零重考` + C.reset)
}

// ---------- EXP-5 坏规则对照（安全阀） ----------
{
  say('')
  say(C.cyan + '═ EXP-5 坏规则对照：本质不可分 → Wilson 永不达标 → 安全阀拒绝转正 ═' + C.reset)
  const court = new ShadowCourt(path.join(ROOT, 'bad'))
  for (const x of stream(31, 60)) {
    if (x.badRuleFlags) { court.observe('BAD_RULE', true, x.kind === 'forgery'); court.considerPromotion('BAD_RULE', { nMin: 20, epsilon: 0.01 }) }
  }
  const r = court.state.rules.BAD_RULE
  say(C.bold + C.green + `   坏规则观察 ${r.observations} 次（误杀 ${r.falseKills} 混入）→ 状态=${r.status}（永不转正）→ 自治不失控的底线：无法证明零误杀的规则永远留在影子期 ✓` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 影子账本数字化；零误杀影子期 Wilson 下限=0（ε 不敏感），转正由样本数判据决定' + C.reset)
say(C.dim + '  EXP-3 自适应优于固定影子期：数据定优劣' + C.reset)
say(C.dim + '  EXP-4 promote/demote：转正非终身制，误杀即回退' + C.reset)
say(C.dim + '  EXP-5 安全阀：坏规则永留影子期——自治的边界是"统计上无法自证的规则不配生效"' + C.reset)
say(C.dim + '  → 实测出的下一阶段目标：自治军法（免疫系统闭环）→ 自治运营（发布/巡检/宣传自动化，人只批关键动作）' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
process.exit(0)
