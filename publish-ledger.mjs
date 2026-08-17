// dsh-megamesh/publish-ledger.mjs —— 发布账本：真实发布历史 append-only 记录 + 自治资格判据
// 语义（诚实区分两类事故）：
//   checks 全绿 = 发布前预检过关（词检 0 / 测试 0 / preflight 过）
//   outcome = success | accident（发布后结果；accident 又分可预见（检查该红没红）与不可预见（发布后才发现））
// 自治资格 = 流程可靠性：最近 nMin 次发布中"可预见事故率"的 Wilson 下限 ≤ epsilon 且零流程违规
import { wilsonLower } from './shadow-law.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'

export class PublishLedger {
  constructor(root) {
    this.root = root
    this.ledgerPath = path.join(root, 'shared', 'consensus', 'publish-ledger.jsonl')
    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true })
  }
  record(entry) {
    fs.appendFileSync(this.ledgerPath, JSON.stringify({ at: Date.now(), ...entry }) + '\n')
  }
  history() {
    try {
      return fs.readFileSync(this.ledgerPath, 'utf-8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
    } catch { return [] }
  }
  // 可预见事故 = 预检有红却发布了（流程违规）；不可预见事故只入账不扣资格
  eligibility({ nMin = 20, epsilon = 0.01 } = {}) {
    const all = this.history()
    const recent = all.slice(-nMin)
    if (recent.length < nMin) return { eligible: false, reason: `样本不足 ${recent.length}/${nMin}`, wilson: null, violations: 0, n: recent.length }
    const violations = recent.filter(r => r.checks && (r.checks.words !== 0 || r.checks.tests !== 0 || r.checks.preflight !== 0))
    const w = wilsonLower(violations.length, recent.length)
    return { eligible: w <= epsilon, reason: null, wilson: w, violations: violations.length, n: recent.length, accidents: recent.filter(r => r.outcome === 'accident').length }
  }
}
