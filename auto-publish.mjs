// dsh-megamesh/auto-publish.mjs —— 自治发布判据：发布决策器 + 影子转正（复用 ShadowCourt 的 Wilson 判据）
// 语义映射（发布域 → 影子法庭域）：
//   建议发布（flagged）→ 影子期只记录不执行；事后审计无事故 = 建议正确（isForgery=true）
//   事后审计发现事故 = 建议误判（isForgery=false）→ 计入误判率 → Wilson 判据管住"错误建议率"
//   转正后：建议发布 → 自动执行；误判一次（事故）→ 立即降级回影子、清零重考
import { ShadowCourt } from './shadow-law.mjs'

export class PublishJudge {
  constructor(root, knownPatterns) {
    this.court = new ShadowCourt(root)
    this.knownPatterns = knownPatterns   // 影子期教过的危险 pattern 列表（数据不是代码）
  }
  judge(change) {
    const issues = this.knownPatterns.filter(p => p.test(change.text))
    return { action: issues.length > 0 ? 'hold' : 'publish', issues: issues.map(p => p.id) }
  }
  // 一轮决策：影子期只记录建议 + 事后审计；转正后自动执行；事故 → 申诉降级
  round(change, auditIssues, opts = {}) {
    const verdict = this.judge(change)
    const promoted = this.court.status('PUBLISH_JUDGE') === 'promoted'
    let executed = false, accident = false
    if (verdict.action === 'publish') {
      if (promoted) {
        executed = true
        accident = auditIssues.length > 0
        this.court.observe('PUBLISH_JUDGE', true, !accident)   // 事故 = 误判 → 降级
      } else {
        this.court.observe('PUBLISH_JUDGE', true, auditIssues.length === 0)
        this.court.considerPromotion('PUBLISH_JUDGE', { nMin: opts.nMin ?? 20, epsilon: opts.epsilon ?? 0.01 })
      }
    }
    return { verdict, executed, accident, status: this.court.status('PUBLISH_JUDGE') }
  }
}

// 发布后审计：模拟"词检 + 测试 + schema"流水线（ground truth 由装置提供）
export function auditChange(change, allPatterns) {
  return allPatterns.filter(p => p.test(change.text)).map(p => p.id)
}
