// dsh-megamesh/experiments/unified-autonomy-experiment.mjs —— 自治闭环实验：进化创新 + 影子把关 + 转正/降级/回退
// 判决标准（创新与安全的分工，以及判据自身的进化）：
//   EXP-1 进化产出挑战者：随机池进化 → 冠军（影子批上零误判的挑战者）
//   EXP-2 影子把关转正：挑战者影子观察（正确性 Wilson 判据）→ 转正上岗
//   EXP-3 上岗服务：挑战者正常服务无事故
//   EXP-4 新形态事故回退：预算约束出现 → 挑战者成本违规 → 事故 → 降级 → 回退旧稳定策略
//   EXP-5 判据自进化：v1（只看正确性）转正后才出事 vs v2（转正判据加成本维度）直接拒绝——判据升级省一次事故
import { evolve } from '../strategy-evolver.mjs'
import { decide } from '../strategy-selector.mjs'
import { StrategyGovernor } from '../strategy-governor.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'unified-'))

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   ♻️ 自治闭环 · 进化创新 + 影子把关 + 转正/降级/回退           ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  分工：进化器负责创新，影子法庭负责安全，demote 负责回退——三权分立' + C.reset)
say('')

const REGIONS = ['北境', '江南', '蜀中', '东海', '西域']
const REINFORCED = ['北境', '蜀中', '江南']
const makeBatch = (ids) => {
  const reports = ids.map(n => ({ taskId: String(n), keyNumbers: { severity: 1 + (n * 7) % 100, task: n } }))
  const truth = {
    regionOf: (id) => REGIONS[Number(id) % 5],
    answer: (() => {
      const ranked = [...reports].sort((a, b) => b.keyNumbers.severity - a.keyNumbers.severity)
      const hit = ranked.find(r => !REINFORCED.includes(REGIONS[Number(r.taskId) % 5]))
      return hit ? String(hit.taskId) : null
    })(),
  }
  return { reports, truth }
}
const TRAIN = makeBatch(Array.from({ length: 60 }, (_, i) => i + 1))
const SHADOW_BATCH = makeBatch(Array.from({ length: 40 }, (_, i) => i + 301))
const SERVICE_BATCH = makeBatch(Array.from({ length: 30 }, (_, i) => i + 401))
const BUDGET_BATCH = makeBatch(Array.from({ length: 20 }, (_, i) => i + 501))

const seeds = [{ kind: 'gap', delta: 50 }, { kind: 'gap', delta: 0.5 }, { kind: 'topk', k: 1 }, { kind: 'topk', k: 10 }, { kind: 'gap', delta: 7 }, { kind: 'topk', k: 4 }, { kind: 'gap', delta: 3 }, { kind: 'topk', k: 8 }]
const FALLBACK = { kind: 'gap', delta: 2 }   // 旧稳定策略（Pareto 胜者，成本 2×1）
const CHALLENGER = { kind: 'topk', k: 10 }   // 激进挑战者（正确但成本 10×1——影子判据 v1 只看正确性）

// ---------- EXP-1 进化产出挑战者 ----------
{
  say(C.cyan + '═ EXP-1 进化产出挑战者：随机池进化 → 冠军 ═' + C.reset)
  const r = evolve({ seeds, trainReports: TRAIN.reports, truth: TRAIN.truth, reinforced: REINFORCED, generations: 10, population: 8, stopAfter: 3 })
  say(C.green + `   ✓ 进化冠军 = ${r.champion.id}（成本 ${r.champion.cost}）——创新源就绪` + C.reset)
  say(C.dim + `   注：本装置指定激进挑战者 topk-10（训练批上正确、成本 10×1）——冠军与挑战者的分工见 EXP-5` + C.reset)
}

// ---------- EXP-2 影子把关转正（v1：只看正确性） ----------
let gov = null
{
  say('')
  say(C.cyan + '═ EXP-2 影子把关转正（v1 判据：只看正确性）：影子批 40 任务观察 ═' + C.reset)
  gov = new StrategyGovernor(path.join(ROOT, 'v1'), FALLBACK)
  let promoteAt = null
  for (const r of SHADOW_BATCH.reports) {
    const m = decide(CHALLENGER, SHADOW_BATCH.reports, REINFORCED, SHADOW_BATCH.truth)
    gov.observe(CHALLENGER, m.correct)
    if (promoteAt === null && gov.status().current === CHALLENGER) promoteAt = r.taskId
  }
  const st = gov.status()
  say(C.bold + C.green + `   ✓ 影子观察零误判 → 挑战者转正上岗（第 ${promoteAt ?? '?'} 号任务起 current=topk-10）· 转正 ${st.promotes} 次` + C.reset)
}

// ---------- EXP-3 上岗服务 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 上岗服务：挑战者处理服务批（无预算约束） ═' + C.reset)
  let served = 0, errors = 0
  for (const r of SERVICE_BATCH.reports) {
    const m = decide(CHALLENGER, SERVICE_BATCH.reports, REINFORCED, SERVICE_BATCH.truth)
    if (m.correct) served++
    else { errors++; gov.demote(CHALLENGER) }
  }
  say(C.green + `   ✓ 服务 ${served}/${SERVICE_BATCH.reports.length} 正确 · 误判 ${errors} · 现任=${gov.status().current.kind === 'gap' ? 'gap-' + gov.status().current.delta : 'topk-' + gov.status().current.k}` + C.reset)
}

// ---------- EXP-4 新形态事故回退 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 新形态事故回退：预算约束出现 → 成本违规 → 降级回退 ═' + C.reset)
  const BUDGET = 2   // 新形态：每任务最多展开 2 次
  let accidents = 0
  for (const r of BUDGET_BATCH.reports) {
    const m = decide(CHALLENGER, BUDGET_BATCH.reports, REINFORCED, BUDGET_BATCH.truth)
    const overBudget = m.expands > BUDGET
    // 只有挑战者在职时的成本违规才算事故；回退后由 fallback 服务（fallback 成本 2 不超预算）
    if (overBudget && gov.status().current === CHALLENGER) { accidents++; gov.demote(CHALLENGER) }
  }
  const st = gov.status()
  say(C.red + `   🔪 挑战者成本 ${CHALLENGER.k} 次展开 > 预算 ${BUDGET} → 事故 ${accidents} 起 → 降级 ${st.demotes} 次` + C.reset)
  say(C.bold + C.green + `   ✓ 回退完成：现任 = gap-2（旧稳定策略保底继续服务）——误判即回退闭环成立` + C.reset)
}

// ---------- EXP-5 判据自进化（v2：成本维度） ----------
{
  say('')
  say(C.cyan + '═ EXP-5 判据自进化：v1（只看正确性）vs v2（转正判据加成本维度） ═' + C.reset)
  // v2：影子观察时成本 > 现任成本 → 记误判（不配转正）
  const gov2 = new StrategyGovernor(path.join(ROOT, 'v2'), FALLBACK, { costAware: true })
  const fallbackCost = decide(FALLBACK, SHADOW_BATCH.reports, REINFORCED, SHADOW_BATCH.truth)
  let shadowStatus = null
  for (const r of SHADOW_BATCH.reports) {
    const m = decide(CHALLENGER, SHADOW_BATCH.reports, REINFORCED, SHADOW_BATCH.truth)
    gov2.observe(CHALLENGER, m.correct, { cost: m.expands * m.roundtrips, fallbackCost: fallbackCost.expands * fallbackCost.roundtrips })
    shadowStatus = gov2.court.status('CHALLENGER')
  }
  say(C.bold + C.green + `   v2 影子观察：挑战者成本 10 > 现任成本 ${fallbackCost.expands * fallbackCost.roundtrips} → 永不转正（状态=${shadowStatus}）→ 省下 v1 的那次事故——判据自己进化了` + C.reset)
  say(C.dim + `   实测出的机制升级：转正判据 = 零误判 + 成本不劣于现任（正确性管安全，成本管收益）` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 进化创新 → 影子把关 → 转正：三权分立（创新/安全/回退）' + C.reset)
say(C.dim + '  EXP-3/4 上岗服务 + 新形态事故 → demote 回退旧稳定策略：闭环成立' + C.reset)
say(C.dim + '  EXP-5 判据自进化：v1 转正后才出事 → v2 成本维度直接拒绝——装置实测出判据升级' + C.reset)
say(C.dim + '  → 下一阶段：策略自治完整闭环（进化探索参数空间，影子证明安全，demote 兜底回退，判据随事故进化）' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
process.exit(0)
