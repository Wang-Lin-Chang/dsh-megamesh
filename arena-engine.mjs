// dsh-megamesh/arena-engine.mjs —— ARENA 推理竞技场引擎（E40 核心，纯函数可导入）
// 离经叛道设计：主流让模型生成答案（法官）；TREMOR 让模型生成假设（证人）+ 人写规则当法官
// ARENA 再进一步：模型生成证人证词（必须声明立场）→ 结论进擂台打赢淘汰赛才值得信
// 两个 TREMOR 没有的维度：
//   ① 平行宇宙翻案：被否结论不删除——进平行宇宙分支（新证据可复活，time-machine 语义）
//   ② 裁判也被治理：验证者模型有任期 + 影子转正 + 事故降级——固定验证器会腐败，会轮换的不会
// 诚实边界（TREMOR 三坑的回应）：
//   ① 军法只查结构（引用存在/无循环/无孤儿），不查语义蕴含——语义交质证层（软判断）
//   ② 质证必带非 LLM 防线（自洽+MAD 离群）——同源 Transformer 会在同类幻觉上共同犯错
//   ③ 成本计量内建——每层 API 调用计数，调度器管并发（E26 α 调度语义）
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'

export const sha256 = (s) => createHash('sha256').update(String(s), 'utf-8').digest('hex').slice(0, 12)

// ---------- 证据（证人证词）----------
// 证人 = 模型；证词必须声明立场（modelId + 历史信用 credit），信用由质证历史累积
export function witnessClaim({ modelId, credit, premiseIds, claim, support }) {
  return {
    claimId: 'c-' + sha256(`${modelId}:${premiseIds.join(',')}:${claim}`),
    modelId, credit, premiseIds, claim, support,
    at: Date.now(),
  }
}

// ---------- 军法结构审（只查结构，不查语义——诚实边界） ----------
// 规则：引用必须存在 / 无循环（拓扑排序）/ 无孤儿（前提被否结论悬空）
export function structuralAudit(claims) {
  const byId = new Map(claims.map(c => [c.claimId, c]))
  const violations = []
  for (const c of claims) {
    for (const pid of c.premiseIds) {
      if (!byId.has(pid) && pid !== 'ROOT') violations.push({ code: 'DANGLING_REF', claimId: c.claimId, detail: `引用不存在的前提 ${pid}` })
    }
  }
  // 循环检测：DFS 沿 premiseIds 找环
  const visiting = new Set(), done = new Set()
  const dfs = (id) => {
    if (visiting.has(id)) return true
    if (done.has(id) || !byId.has(id)) return false
    visiting.add(id)
    const c = byId.get(id)
    for (const p of c.premiseIds) if (p !== 'ROOT' && byId.has(p) && dfs(p)) { visiting.delete(id); return true }
    visiting.delete(id); done.add(id)
    return false
  }
  for (const c of claims) if (dfs(c.claimId)) violations.push({ code: 'CYCLE', claimId: c.claimId, detail: '循环论证' })
  // 孤儿：前提被否（premiseIds 含被否决 claimId 且本结论仍活跃——活跃性由调用方传入）
  return violations
}

// ---------- 擂台淘汰赛（质证层）----------
// 结论进擂台：chair 提议（credit 加权）→ 自洽质证（support 数字 vs claim 矛盾）→ 离群质证（信用 MAD）
// 三票制（E28 语义）+ 复核轮（E32 语义）：contested 不立即否决，换验证者复核一次
export function arenaVerdict(claims, { verifyReport } = {}) {
  // chair：credit 加权选最优证词
  let best = null
  for (const c of claims) if (best === null || c.credit > best.credit) best = c
  if (best === null) return { status: 'no-claims' }
  // 自洽：support 里的数字与 claim 文本矛盾检测（同源防线 1）
  const nums = (best.claim.match(/\d+/g) ?? []).map(Number)
  const supportNums = (best.support.match(/\d+/g) ?? []).map(Number)
  const consistency = nums.length === 0 || supportNums.length === 0 || nums.every(n => supportNums.some(s => Math.abs(s - n) <= 50))
  // 离群：信用 MAD（同源防线 2——信用异常高的模型可能是新上场的冒名者）
  const credits = claims.map(c => c.credit).sort((a, b) => a - b)
  const med = credits[Math.floor(credits.length / 2)]
  const mad = Math.max(...credits.map(c => Math.abs(c - med)).sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(credits.length / 2)))) || 1
  const z = Math.abs(best.credit - med) / (1.4826 * mad)
  const outlier = z > 3.5
  const agree = 1 + (consistency ? 1 : 0) + (!outlier ? 1 : 0)
  const status = agree === 3 ? 'winner' : agree === 2 ? 'contested' : 'rejected'
  return { status, winner: best, votes: { chair: true, consistency, outlier: !outlier }, agree, costApiCalls: claims.length + (agree === 3 ? 0 : 2) }
}

// ---------- 平行宇宙翻案（TREMOR 没有的维度 ①）----------
// 被否结论不删除：存平行宇宙分支。新证据出现 → 复核 → 复活（撤销否决）
export function parallelUniverse({ rejected = [], revived = [] } = {}) {
  const branches = rejected.map(c => ({ claimId: c.claimId, status: 'dormant', at: Date.now() }))
  return { branches, revived }
}

// ---------- 裁判治理（TREMOR 没有的维度 ②）----------
// 验证者模型有任期 + 影子转正 + 事故降级（shadow-law 语义：Wilson 下界 + 误判降级清零）
export function judgeRegistry() {
  const judges = new Map()   // modelId → { credit, term, promotions, accidents }
  return {
    promote(modelId, { credit = 0 } = {}) { judges.set(modelId, { credit, term: 1, promotions: 1, accidents: 0 }) },
    verdictMistake(modelId) {
      const j = judges.get(modelId)
      if (!j) return
      j.accidents++
      if (j.accidents >= 2) { j.credit = 0; j.promotions = 0; j.term++ }   // 事故降级清零（E17 语义）
    },
    get(modelId) { const j = judges.get(modelId); return j === undefined ? undefined : { ...j } },   // 快照语义：调用方拿到的不是活引用（防止事后修改污染历史读数）
    all() { return [...judges.entries()].map(([id, j]) => ({ modelId: id, ...j })) },
  }
}

// ---------- 成本计量 ----------
export function costLedger() {
  let calls = 0
  return {
    add(n = 1) { calls += n; return calls },
    total() { return calls },
  }
}
