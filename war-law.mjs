// dsh-megamesh/war-law.mjs —— 军法：声明式规则集（数据不是代码，解释器在 war-law-engine.mjs）
// 融合统一：与 clerk-worker / law-miner / megamesh 共用同一规则源——一种表示，零分歧
import { violations } from './war-law-engine.mjs'

export const DEFAULT_RULES = [
  { id: 'RANGE_SEVERITY', kind: 'range', field: 'severity', lo: 0, hi: 100 },
  { id: 'SUMMARY_BOUND', kind: 'maxlen', field: 'summary', max: 100 },
  { id: 'REQUEST_CONSISTENT', kind: 'requestThreshold', threshold: 80 },
  { id: 'TASK_MATCH', kind: 'eq', a: 'taskId', b: 'keyNumbers.task' },
]

// 兼容旧名（check 函数版升级为 kind 数据版）
export const militaryLaw = DEFAULT_RULES

// 军法审判：返回违规条款对象数组（空数组 = 放行）
export const courtMartial = (report, rules = DEFAULT_RULES) => violations(rules, report).map(id => ({ id }))
