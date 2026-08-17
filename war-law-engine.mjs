// dsh-mesh/war-law-engine.mjs —— 军法解释器：规则是数据（JSON），代码只是解释器
// 规则 kinds：range（数值范围）/ maxlen（文本长度）/ requestThreshold（severity-request 一致性）/ eq（字段相等）
//            / enum（类别集合）/ hasAnyOf（文本含其一）/ minItems（数组最小长度）
// evaluate(rule, report) → 违规的 ruleId 数组（[] = 放行）
export const evaluate = (rule, r) => {
  switch (rule.kind) {
    case 'range': { const v = r.keyNumbers?.[rule.field]; return (v >= rule.lo && v <= rule.hi) ? [] : [rule.id] }
    case 'maxlen': { const v = r[rule.field]; return (typeof v === 'string' && v.length <= rule.max) ? [] : [rule.id] }
    case 'requestThreshold': {
      const sev = r.keyNumbers?.severity
      if (sev === undefined) return [rule.id]
      const ok = sev > rule.threshold ? r.request === '建议增援' : r.request === '常规记录'
      return ok ? [] : [rule.id]
    }
    case 'eq': {
      const get = (p) => p.split('.').reduce((o, k) => o?.[k], r)
      return Number(get(rule.a)) === Number(get(rule.b)) ? [] : [rule.id]
    }
    case 'enum': { return rule.allowed.includes(r[rule.field]) ? [] : [rule.id] }
    case 'hasAnyOf': { const v = r[rule.field] ?? ''; return rule.anyOf.some(w => String(v).includes(w)) ? [] : [rule.id] }
    case 'minItems': { const v = r[rule.field] ?? []; return v.length >= rule.min ? [] : [rule.id] }
    default: return []
  }
}
export const violations = (rules, r) => rules.flatMap(rule => evaluate(rule, r))
