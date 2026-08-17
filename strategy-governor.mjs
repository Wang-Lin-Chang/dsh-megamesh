// dsh-megamesh/strategy-governor.mjs —— 策略执政官：进化创新 + 影子把关 + 转正/降级/回退（自治闭环）
// 分工：
//   进化器（strategy-evolver）产出挑战者——负责创新，不负责安全
//   影子法庭（ShadowCourt）观察挑战者——误判率 Wilson 判据达标才转正
//   转正后上岗：挑战者成为现任；误判一次 → 申诉 → 降级 → 回退旧稳定策略，挑战者回影子重考
import { ShadowCourt } from './shadow-law.mjs'

export class StrategyGovernor {
  constructor(root, fallback) {
    this.court = new ShadowCourt(root)
    this.fallback = fallback          // 旧稳定策略（回退保底）
    this.current = fallback
    this.accidents = 0
    this.promotes = 0
    this.demotes = 0
  }
  // 影子观察 + 转正判定：每次决策都观察（flagged=true），correct=true 记为真、false 记误判
  // costInfo（v2 判据）：挑战者成本劣于现任 → 记误判（正确但昂贵 = 不配转正）
  observe(challenger, decisionCorrect, costInfo = null) {
    if (costInfo && costInfo.cost > costInfo.fallbackCost) {
      this.court.observe('CHALLENGER', true, false)
      return this.court.status('CHALLENGER')
    }
    this.court.observe('CHALLENGER', true, decisionCorrect)
    this.court.considerPromotion('CHALLENGER', { nMin: 20, epsilon: 0.01 })
    const promoted = this.court.status('CHALLENGER') === 'promoted'
    if (promoted && this.current !== challenger) { this.current = challenger; this.promotes++ }
    return this.court.status('CHALLENGER')
  }
  // 转正后误判 → 申诉降级 → 回退
  demote(challenger) {
    if (this.current === challenger) this.current = this.fallback
    this.court.observe('CHALLENGER', true, false)   // ShadowCourt 内部：转正状态误判 → 降级清零
    this.demotes++
    this.accidents++
    return this.current
  }
  status() { return { shadow: this.court.status('CHALLENGER'), current: this.current, promotes: this.promotes, demotes: this.demotes, accidents: this.accidents } }
}
