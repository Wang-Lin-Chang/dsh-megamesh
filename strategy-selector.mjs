// dsh-megamesh/strategy-selector.mjs —— 平行宇宙策略竞标：候选决策策略池 + 重演度量 + Pareto 选择
// 动机：细决策策略（gap δ / topk K）的参数一直由人挑——本模块让候选策略在训练批上重演竞标，
//       Pareto 选优（正确率 100% 中展开成本最低），胜出策略转正为下一批任务的默认。
// 策略是数据：每个候选是纯函数描述（id + kind + 参数），重演度量 = {correct, expands, roundtrips}
export const STRATEGY_POOL = [
  { id: 'gap-0.5', kind: 'gap', delta: 0.5 },
  { id: 'gap-1', kind: 'gap', delta: 1 },
  { id: 'gap-2', kind: 'gap', delta: 2 },
  { id: 'gap-5', kind: 'gap', delta: 5 },
  { id: 'gap-10', kind: 'gap', delta: 10 },
  { id: 'gap-50', kind: 'gap', delta: 50 },
  { id: 'topk-1', kind: 'topk', k: 1 },
  { id: 'topk-3', kind: 'topk', k: 3 },
  { id: 'topk-5', kind: 'topk', k: 5 },
  { id: 'topk-10', kind: 'topk', k: 10 },
]

// 细决策任务：找"severity 最高且 region 未被增援"的任务（region 只在展开层）
export function decide(strategy, reports, reinforced, truth) {
  const ranked = [...reports].sort((a, b) => b.keyNumbers.severity - a.keyNumbers.severity)
  let expands = 0, roundtrips = 0
  const answer = (() => {
    if (strategy.kind === 'gap') {
      const top = ranked.slice(0, 2)
      const gap = top.length === 2 ? top[0].keyNumbers.severity - top[1].keyNumbers.severity : 0
      let batch
      if (top.length === 1 || gap >= strategy.delta) batch = [top[0]]
      else batch = top
      roundtrips++
      expands += batch.length
      for (const r of batch) {
        const region = truth.regionOf(r.taskId)
        if (!reinforced.includes(region)) return { taskId: r.taskId, severity: r.keyNumbers.severity, region }
      }
      for (let i = 1; i < ranked.length; i++) {
        if (batch.includes(ranked[i])) continue
        roundtrips++
        expands++
        const region = truth.regionOf(ranked[i].taskId)
        if (!reinforced.includes(region)) return { taskId: ranked[i].taskId, severity: ranked[i].keyNumbers.severity, region }
      }
      return null
    }
    // topk：批量展开 top-k，批内找第一个未增援
    const k = strategy.k
    for (let i = 0; i < ranked.length; i += k) {
      const batch = ranked.slice(i, i + k)
      roundtrips++
      expands += batch.length
      for (const r of batch) {
        const region = truth.regionOf(r.taskId)
        if (!reinforced.includes(region)) return { taskId: r.taskId, severity: r.keyNumbers.severity, region }
      }
    }
    return null
  })()
  const correct = answer !== null && answer.taskId === truth.answer
  return { correct, expands, roundtrips, answer }
}

// Pareto 选择：正确率 100% 的候选里展开成本最低者（成本 = expands × 往返权重）
export function selectBest(metrics) {
  const perfect = metrics.filter(m => m.correct)
  if (perfect.length === 0) return { winner: null, perfect: perfect.length, note: '无 100% 正确候选——策略池该扩容' }
  const best = perfect.reduce((a, b) => (a.expands * a.roundtrips <= b.expands * b.roundtrips ? a : b))
  return { winner: best, perfect: perfect.length }
}
