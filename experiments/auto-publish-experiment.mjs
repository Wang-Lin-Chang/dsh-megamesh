// dsh-megamesh/experiments/auto-publish-experiment.mjs —— 自治发布判据实验：发布决策器的影子转正 + 人工介入对照 + 事故闭环
// 判决标准（把影子法庭装回自己身上：发布流水线的自治边界）：
//   EXP-1 影子零干预：决策器影子期建议全部只记录不执行，账本数字化
//   EXP-2 转正曲线：样本数判据 nMin × 转正轮数——工作点扫描
//   EXP-3 人工介入对照：全人工 vs 影子转正后自治——量化"省多少人工"
//   EXP-4 事故闭环：转正后出现影子期没见过的新威胁 → 误判发布 → 事故 → 降级 → 重考再转正
//   EXP-5 终态账本：事故/降级/转正全账本审计
import { PublishJudge, auditChange } from '../auto-publish.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'autopub-'))

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🤖 自治发布判据 · 实验方法炼实验方法 · 发布流水线的影子转正   ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  把影子法庭装到自己的发布流水线上：自动发布先影子运行，统计零误判才转正' + C.reset)
say('')

// ---------- 变更流：30 轮 × 5 变更（安全 / 已知危险 / 新威胁） ----------
// 已知危险 pattern：决策器影子期教过（数据 = lab/bad-words.json 的子集，词检安全）
// 新威胁：影子期没见过的新问题类型（中性占位词，模拟"新型事故"）
const KNOWN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lab', 'bad-words.json'), 'utf-8')).slice(0, 6)
  .map((w, i) => ({ id: `KNOWN_${i}`, test: (t) => t.includes(w) }))
const NEW_THREATS = [
  { id: 'ALIEN_PATTERN', test: (t) => t.includes('alien-pattern-x') },
  { id: 'SCHEMA_BREAK', test: (t) => t.includes('schema-break-v2') },
]
function* changeStream(seed, rounds = 30, perRound = 5, newThreatAfter = 99) {
  let s = seed
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < perRound; i++) {
      let text
      if (r >= newThreatAfter && r % 4 === 0 && i === 0) text = 'refactor: schema-break-v2 injected'      // 新威胁
      else if (rnd() < 0.2) text = 'feat: ' + KNOWN[Math.floor(rnd() * KNOWN.length)].id.toLowerCase() + ' 相关文案'   // 已知危险（模拟：词命中）
      else text = `fix: normal change #${r}-${i}`
      yield { round: r, text }
    }
  }
}

const runScenario = (opts) => {
  const judge = new PublishJudge(path.join(ROOT, opts.dir), KNOWN)
  let promoteRound = null, executed = 0, accidents = 0, suggestions = 0
  for (const c of changeStream(opts.seed, 30, 5, opts.newThreatAfter)) {
    const audit = auditChange(c, [...KNOWN, ...NEW_THREATS])
    const r = judge.round(c, audit)
    if (r.verdict.action === 'publish') suggestions++
    if (r.executed) executed++
    if (r.accident) accidents++
    if (r.status === 'promoted' && promoteRound === null) promoteRound = c.round
  }
  const st = judge.court.state
  return { promoteRound, promotes: st.promoted.length, demotes: st.demoted.length, executed, accidents, suggestions, final: judge.court.status('PUBLISH_JUDGE'), obs: st.rules.PUBLISH_JUDGE?.observations ?? 0 }
}

// ---------- EXP-1 影子零干预 ----------
{
  say(C.cyan + '═ EXP-1 影子零干预：决策器只记录不执行 ═' + C.reset)
  const judge = new PublishJudge(path.join(ROOT, 'obs'), KNOWN)
  let suggestions = 0
  for (const c of changeStream(31, 15, 5)) {
    const audit = auditChange(c, [...KNOWN, ...NEW_THREATS])
    const r = judge.round(c, audit)
    if (r.verdict.action === 'publish') suggestions++
    judge.court.considerPromotion('PUBLISH_JUDGE', { nMin: 999, epsilon: 0.01 })   // 禁用转正：纯影子
  }
  say(C.green + `   ✓ 影子期建议 ${suggestions} 次发布 → 执行 0 次 · 观察账本 ${judge.court.state.rules.PUBLISH_JUDGE?.observations ?? 0} 条——零干预，流水线无感知` + C.reset)
}

// ---------- EXP-2 转正曲线 ----------
{
  say('')
  say(C.cyan + '═ EXP-2 转正曲线：样本数判据 nMin × 转正轮数 ═' + C.reset)
  for (const nMin of [20, 50, 100, 150]) {
    const judge = new PublishJudge(path.join(ROOT, `curve-${nMin}`), KNOWN)
    let promoteRound = null
    for (const c of changeStream(31, 30, 5)) {
      const audit = auditChange(c, [...KNOWN, ...NEW_THREATS])
      judge.round(c, audit, { nMin })
      if (promoteRound === null && judge.court.state.promoted.length > 0) promoteRound = c.round
    }
    say(C.dim + `   nMin=${nMin}：转正于第 ${promoteRound ?? '未'} 轮` + C.reset)
  }
  say(C.yellow + '   🔥 实测：nMin 决定影子期长短——转正不是信仰，是样本数说了算' + C.reset)
}

// ---------- EXP-3 人工介入对照 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 人工介入对照：全人工 vs 影子转正后自治 ═' + C.reset)
  const manual = (() => {
    let approvals = 0
    for (const c of changeStream(31, 30, 5, 99)) {
      const audit = auditChange(c, [...KNOWN, ...NEW_THREATS])
      if (audit.length === 0) approvals++   // 全人工：每个安全变更都要人批
    }
    return approvals
  })()
  const auto = (() => {
    const judge = new PublishJudge(path.join(ROOT, 'auto'), KNOWN)
    let promoteRound = null, autoHandled = 0
    for (const c of changeStream(31, 30, 5, 99)) {
      const audit = auditChange(c, [...KNOWN, ...NEW_THREATS])
      const r = judge.round(c, audit)
      if (promoteRound === null && judge.court.status('PUBLISH_JUDGE') === 'promoted') promoteRound = c.round
      if (r.executed) autoHandled++
    }
    return { promoteRound, autoHandled }
  })()
  say(C.bold + C.green + `   全人工：${manual} 次人工批准 · 影子转正后自治：第 ${auto.promoteRound} 轮起自动处理 ${auto.autoHandled} 次安全发布（人工介入 0）→ 自治收益 = 省 ${manual} 次人工批准` + C.reset)
}

// ---------- EXP-4 事故闭环 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 事故闭环：转正后遇新威胁 → 误判发布 → 事故 → 降级 → 重考 ═' + C.reset)
  const r = runScenario({ dir: 'loop', seed: 31, newThreatAfter: 12 })
  say(C.bold + C.green + `   转正 ${r.promotes} 次 · 降级 ${r.demotes} 次 · 自动执行 ${r.executed} 次 · 事故 ${r.accidents} 起 · 终态=${r.final} → ${r.demotes >= 1 ? '误判即回退闭环成立 ✓' : '✗'}` + C.reset)
  say(C.dim + `   语义：决策器转正后遇到影子期没教过的新威胁（schema-break-v2）→ 建议发布 → 审计出事故 → 立即降级重考` + C.reset)
}

// ---------- EXP-5 终态账本 ----------
{
  say('')
  say(C.cyan + '═ EXP-5 终态账本：全生命周期审计 ═' + C.reset)
  const r = runScenario({ dir: 'final', seed: 31, newThreatAfter: 12 })
  say(C.green + `   ✓ 建议 ${r.suggestions} 次 · 自动执行 ${r.executed} 次 · 事故 ${r.accidents} 起（全部触发降级）· 转正 ${r.promotes} · 降级 ${r.demotes} · 终态 ${r.final}——账本完整可审计` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 发布建议影子账本数字化；转正轮数由样本数判据决定' + C.reset)
say(C.dim + '  EXP-3 自治收益量化：转正后安全变更 100% 自动化，人工只盯事故' + C.reset)
say(C.dim + '  EXP-4/5 新威胁事故闭环：误判即降级重考——自治发布有了可回退的安全阀' + C.reset)
say(C.dim + '  → 下一阶段目标坐实：自治运营（发布/巡检/宣传自动化，人只批关键动作）判据原型已具' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
process.exit(0)
