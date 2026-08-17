// dsh-megamesh/adapter-spec.mjs —— 框架适配契约：任何框架 Agent 入网的 5 函数接口
// 核心主张：协议在文件系统层（租约/战报/军法/收养），与框架无关——框架 Agent 只是协议的一个实现
// 契约（v1.0）：
//   claimTask(root, agentId, pid, startSec, taskId) → bool          — O_EXCL 租约锁（谁实现的框架都要遵守）
//   doWork(taskId) → { fullText, report }                          — 框架内部干活，产出必须符合战报协议 schema
//   heartbeat(root, taskId) → bool                                 — 锁 mtime touch
//   respondExpand(root, agentId, shard, req) → resp | null         — 字段级展开响应（可空实现）
//   report → 战报必须过军法（lawCourt 0 违规才可落账）
export const ADAPTER_CONTRACT = {
  name: 'dsh-megamesh-adapter-contract',
  version: '1.0.0',
  functions: ['claimTask', 'doWork', 'heartbeat', 'respondExpand', 'report'],
  reportSchema: ['agentId', 'taskId', 'summary', 'keyNumbers', 'stateChanges', 'request'],
  invariant: '战报必须过军法（lawCourt 0 违规）；租约/收养/军法在文件系统层生效，框架差异不豁免',
  frameworks: ['crewai', 'langgraph', 'autogen', 'openai-agents-sdk', 'mcp', 'dify', 'coze'],
}

export function validateAdapterReport(report, lawCourt) {
  const v = lawCourt(report)
  if (v.length > 0) return { ok: false, violations: v }
  for (const f of ADAPTER_CONTRACT.reportSchema) {
    if (f === 'keyNumbers') { if (!report.keyNumbers || typeof report.keyNumbers.severity !== 'number') return { ok: false, violations: [{ id: 'SCHEMA_keyNumbers' }] } }
    else if (f === 'stateChanges') { if (!Array.isArray(report.stateChanges)) return { ok: false, violations: [{ id: 'SCHEMA_stateChanges' }] } }
    else if (report[f] === undefined) return { ok: false, violations: [{ id: `SCHEMA_${f}` }] }
  }
  return { ok: true, violations: [] }
}
