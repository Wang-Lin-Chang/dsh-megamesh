// dsh-megamesh/shadow-law.mjs —— 影子法庭：候选规则影子运行 + Wilson 统计转正判据 + promote/demote 可回退闭环
// 动机：军法提取器自动挖出新规则，但"自动提取不自动生效"（人工批准才上线）——保守，也慢。
// 本模块给出的答案：影子规则只记录不拦截，当"零误杀"达到统计置信（Wilson 区间下限）时自动转正；
// 转正后一旦误杀（申诉机制）自动降级回影子——自治与安全的平衡点由数据给出，不由口号给出。
import * as fs from 'node:fs'
import * as path from 'node:path'

// Wilson 置信区间下限：在 n 次观察、k 次"误杀"下，误杀率的最坏情况估计（保守）
export function wilsonLower(k, n, z = 1.96) {
  if (n === 0) return 0
  const phat = k / n
  const z2 = z * z
  return (phat + z2 / (2 * n) - z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n)) / (1 + z2 / n)
}

export class ShadowCourt {
  constructor(root) {
    this.root = root
    this.statePath = path.join(root, 'shared', 'consensus', 'shadow-court.json')
    this.load()
  }
  load() {
    try { this.state = JSON.parse(fs.readFileSync(this.statePath, 'utf-8')) } catch {
      this.state = { rules: {}, promoted: [], demoted: [], log: [] }
    }
  }
  save() {
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true })
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2))
  }
  // 影子观察：候选规则对该样本的判定 + 该样本的真伪标签（ground truth 由审计/申诉提供）
  observe(ruleId, flagged, isForgery) {
    const r = this.state.rules[ruleId] ?? (this.state.rules[ruleId] = { observations: 0, falseKills: 0, trueHits: 0, status: 'shadow' })
    if (flagged) {
      r.observations++
      if (isForgery) r.trueHits++
      else {
        r.falseKills++
        // 申诉 → 已转正规则误杀真报 → 立即降级回影子，观测清零重来
        if (r.status === 'promoted') {
          r.status = 'shadow'
          r.observations = 0
          r.falseKills = 0
          r.trueHits = 0
          this.state.demoted.push({ ruleId, at: Date.now() })
          this.state.log.push({ t: Date.now(), ruleId, event: 'demote' })
        }
      }
    }
    this.save()
    return r
  }
  // 转正判据：观察数 ≥ nMin 且误杀率 Wilson 下限 ≤ epsilon
  considerPromotion(ruleId, { nMin = 20, epsilon = 0.01 } = {}) {
    const r = this.state.rules[ruleId]
    if (!r || r.status !== 'shadow') return false
    if (r.observations < nMin) return false
    if (wilsonLower(r.falseKills, r.observations) > epsilon) return false
    r.status = 'promoted'
    this.state.promoted.push({ ruleId, at: Date.now(), observations: r.observations, falseKills: r.falseKills })
    this.state.log.push({ t: Date.now(), ruleId, event: 'promote', observations: r.observations, falseKills: r.falseKills })
    this.save()
    return true
  }
  status(ruleId) { return this.state.rules[ruleId]?.status ?? 'shadow' }
}
