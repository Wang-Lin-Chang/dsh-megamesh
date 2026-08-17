// dsh-megamesh/strategy-evolver.mjs —— 策略进化器：竞标 + 变异繁殖 + 世代迭代（进化式调参）
// 一代流程：候选池在训练批上竞标 → 正确性过滤（假阳性排除纪律：正确率<100% 的候选不得当冠军）
//          → 精英保留（top-2 直通）+ 变异繁殖补满池子 → 下一代
// 判据：成本 = expands × roundtrips；早停 = 连续 stopAfter 代冠军无改进
import { decide } from './strategy-selector.mjs'

// 变异：参数扰动（delta ×2/÷2/±1、k ±1、kind 翻转）——确定性 rng（种子可复现）
export function mutate(strategy, rng) {
  const s = { ...strategy }
  if (s.kind === 'gap') {
    const op = Math.floor(rng() * 4)
    if (op === 0) s.delta = Math.max(0.5, s.delta * 2)
    else if (op === 1) s.delta = Math.max(0.5, s.delta / 2)
    else if (op === 2) s.delta = Math.max(0.5, s.delta + 1)
    else s.kind = 'topk', s.k = 3, delete s.delta
  } else {
    const op = Math.floor(rng() * 4)
    if (op === 0) s.k = Math.min(20, s.k + 1)
    else if (op === 1) s.k = Math.max(1, s.k - 1)
    else if (op === 2) s.k = Math.min(20, s.k * 2)
    else s.kind = 'gap', s.delta = 2, delete s.k
  }
  return s
}

const costOf = (m) => m.expands * m.roundtrips
const idOf = (s) => s.kind === 'gap' ? `gap-${s.delta}` : `topk-${s.k}`

// 进化主循环：返回每代账本 + 冠军
export function evolve({ seeds, trainReports, truth, reinforced, generations = 10, population = 8, stopAfter = 3, seed = 42 }) {
  let s = seed
  const rng = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  let pool = seeds.map(x => ({ ...x }))
  const history = []
  let champion = null, championGen = -1
  let stall = 0
  for (let g = 1; g <= generations; g++) {
    // 竞标（正确性过滤 + 成本排序）
    const metrics = pool
      .map(st => ({ ...st, id: idOf(st), ...decide(st, trainReports, reinforced, truth) }))
      .filter(m => m.correct)
    if (metrics.length === 0) { history.push({ gen: g, note: '全灭（无正确候选）' }); break }
    metrics.sort((a, b) => costOf(a) - costOf(b))
    const best = metrics[0]
    const improved = champion === null || costOf(best) < costOf(champion) || (costOf(best) === costOf(champion) && g === 1)
    if (improved) { champion = best; championGen = g; stall = 0 }
    else stall++
    history.push({ gen: g, bestId: best.id, bestCost: costOf(best), correctCount: metrics.length, stall })
    if (stall >= stopAfter) { history.push({ gen: g, note: `早停：连续 ${stopAfter} 代无改进` }); break }
    // 繁殖：精英保留 + 变异
    const elites = metrics.slice(0, 2).map(m => ({ kind: m.kind, delta: m.delta, k: m.k }))
    const next = elites.map(x => ({ ...x }))
    while (next.length < population) {
      const parent = metrics[Math.floor(rng() * Math.min(metrics.length, 4))]
      next.push(mutate({ kind: parent.kind, delta: parent.delta, k: parent.k }, rng))
    }
    pool = next
  }
  return { history, champion: champion ? { id: champion.id, kind: champion.kind, cost: costOf(champion), gen: championGen, ...(champion.kind === 'gap' ? { delta: champion.delta } : { k: champion.k }) } : null }
}
