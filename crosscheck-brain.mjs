// dsh-megamesh/crosscheck-brain.mjs —— 多方质证判定核心（E28 的判定器，纯函数可导入）
// 质疑主流"取最优"：单准则单点失效——一个假阳性战报就能劫持 decree
// 质证协议：chair 提议（max severity，现状）+ 2 质证脑独立准则表决：
//   质证 A（自洽）：summary 里的数字与 keyNumbers 必须一致——矛盾 = 战报不可信
//   质证 B（离群）：severity 用 MAD 稳健检测离群值——假阳性极端值会被标出
// 投票：3/3 → unanimous 放行；2/3 → contested（高风险不放行）；1/3 → vetoed
// 兼容：部署域战报无 keyNumbers（severity null）→ A 无可矛盾=信、B 全同值=无离群=信

// chair 提议：取最优（现状逻辑，作为质证对象）
export function proposeChair(reports) {
  let best = null
  for (const r of reports) {
    const sev = r.keyNumbers?.severity ?? -1
    if (best === null || sev > (best.keyNumbers?.severity ?? -1)) best = r
  }
  if (best === null) return null
  return { taskId: Number(best.taskId), severity: best.keyNumbers?.severity ?? null, summary: best.summary ?? best.evidence ?? '', request: best.request ?? null }
}

// 质证 A：自洽——summary 文本中出现的数字必须与 keyNumbers 一致（矛盾 = 篡改痕迹）
export function crosscheckConsistency(report) {
  const sev = report.keyNumbers?.severity
  if (sev === undefined || sev === null) return { trust: true, reason: 'no-keyNumbers' }   // 部署域：无可矛盾
  const nums = (report.summary ?? '').match(/\d+/g)?.map(Number) ?? []
  if (nums.length === 0) return { trust: true, reason: 'no-numbers-in-summary' }
  const mismatch = nums.find(n => n !== sev && Math.abs(n - sev) > 50)   // 允许近似表述，跨 50 以上=硬矛盾
  return mismatch !== undefined ? { trust: false, reason: `summary says ${mismatch} but severity=${sev}` } : { trust: true, reason: 'consistent' }
}

// 质证 B：离群——MAD（中位数绝对偏差）稳健检测，假阳性极端 severity 是离群值
// 样本同值（MAD=0）时离群检测无统计意义：全体一致下的"唯一不同"不能靠统计判定——交给复核轮（审计域）
export function crosscheckOutlier(report, allReports) {
  const sevs = allReports.map(r => r.keyNumbers?.severity).filter(v => v !== undefined && v !== null)
  if (sevs.length < 3) return { trust: true, reason: 'too-few-samples' }
  const sorted = [...sevs].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  const mads = sorted.map(v => Math.abs(v - med)).sort((a, b) => a - b)
  const rawMad = mads[Math.floor(mads.length / 2)]
  const mad = rawMad || 1
  const sev = report.keyNumbers?.severity ?? null
  if (sev === null) return { trust: true, reason: 'no-severity' }
  if (rawMad === 0 && sev === med) return { trust: true, reason: 'uniform-consistent' }
  if (rawMad === 0 && sev !== med) return { trust: true, reason: 'uniform-no-baseline (defer to review round)' }   // 全体一致时统计无基线——不误拦，交复核
  const z = Math.abs(sev - med) / (1.4826 * mad)   // 修正 MAD → 稳健 z 分数
  return z > 3.5 ? { trust: false, reason: `severity ${sev} is ${z.toFixed(1)}σ from median ${med}` } : { trust: true, reason: `within ${z.toFixed(1)}σ` }
}

// 多方质证投票：chair 提议 + A/B 独立表决 → 一致/争议/否决
// 高风险定义：severity 超阈值（默认 90）或 request 含增援类关键词
export function courtVote(reports, { highRiskThreshold = 90 } = {}) {
  const proposal = proposeChair(reports)
  if (proposal === null) return { status: 'no-proposal', proposal: null }
  const best = reports.find(r => Number(r.taskId) === proposal.taskId) ?? reports[0]
  const a = crosscheckConsistency(best)
  const b = crosscheckOutlier(best, reports)
  const votes = { chair: { trust: true, reason: 'max-severity' }, consistency: a, outlier: b }
  const agree = 1 + (a.trust ? 1 : 0) + (b.trust ? 1 : 0)
  const highRisk = (proposal.severity ?? 0) > highRiskThreshold || /增援|紧急|危/i.test(proposal.request ?? '')
  let status
  if (agree === 3) status = 'unanimous'
  else if (agree === 2) status = highRisk ? 'contested-high-risk' : 'contested-low-risk'
  else status = 'vetoed'
  return { status, proposal, votes, agree, highRisk }
}

// 质证复核协议（E32 生产函数）：否决 → 重采样再投票 → 两次一致才定案
// final: release（首轮放行）/ flipped-release（复核翻转=噪声过滤）/ confirmed-*（两次一致定案）/ review-divergent
export function reviewCourt(reportsRound1, reportsRound2, { highRiskThreshold = 90 } = {}) {
  const first = courtVote(reportsRound1, { highRiskThreshold })
  if (first.status === 'unanimous') return { ...first, round: 1, final: 'release' }
  if (first.status === 'no-proposal') return { ...first, round: 1, final: 'no-proposal' }
  const second = courtVote(reportsRound2, { highRiskThreshold })
  const final = second.status === 'unanimous'
    ? 'flipped-release'
    : (second.status !== 'unanimous' && first.status !== 'unanimous' ? 'confirmed-' + second.status : 'review-divergent')
  return { first, second, final }
}
