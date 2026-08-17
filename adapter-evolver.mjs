// dsh-megamesh/adapter-evolver.mjs —— 框架自动适配进化器（E37 的生成器，纯函数可导入）
// 质疑主流"人写 adapter"：每个框架雇一个人手写适配 = 不可扩展。进化器自动扫描框架包 → 生成候选骨架
// 元契约（预言三）：不是硬编码"claimTask/doWork/..."名字，而是识别框架的等价原语并映射到 5 函数契约
// 5 函数契约的框架等价原语映射表（数据驱动——识别框架语言，翻译成协议语言）：
//   claimTask    → 框架的任务领取原语（队列/调度器/worker 注册）
//   doWork       → 框架的执行原语（graph.invoke / crew.kickoff / agent.run / tool.call）
//   heartbeat    → 框架的保活原语（锁续期/健康检查）
//   respondExpand → 框架的字段展开原语（状态展开/工具响应）
//   report       → 框架的结果产出（战报 schema）
import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

// 框架等价原语识别表（数据 = 元契约：框架语言 → 协议语言）
export const PRIMITIVE_MAP = {
  'StateGraph': { contract: 'doWork', evidence: 'state-graph-builder' },
  'compile': { contract: 'doWork', evidence: 'graph-compiler' },
  'invoke': { contract: 'doWork', evidence: 'graph-executor' },
  'Agent': { contract: 'doWork', evidence: 'agent-builder' },
  'Crew': { contract: 'doWork', evidence: 'crew-builder' },
  'kickoff': { contract: 'doWork', evidence: 'crew-executor' },
  'Flow': { contract: 'doWork', evidence: 'flow-builder' },
  'Tool': { contract: 'doWork', evidence: 'tool-call' },
  'ChatCompletion': { contract: 'doWork', evidence: 'llm-call' },
  'McpServer': { contract: 'doWork', evidence: 'mcp-server' },
  'Graph': { contract: 'doWork', evidence: 'graph-api' },
  'Worker': { contract: 'claimTask', evidence: 'worker-registry' },
  'Queue': { contract: 'claimTask', evidence: 'task-queue' },
  'Scheduler': { contract: 'claimTask', evidence: 'scheduler' },
  'lock': { contract: 'heartbeat', evidence: 'lock-primitive' },
  'health': { contract: 'heartbeat', evidence: 'health-check' },
  'extend': { contract: 'respondExpand', evidence: 'expand-primitive' },
  'stream': { contract: 'respondExpand', evidence: 'stream-primitive' },
  'emit': { contract: 'respondExpand', evidence: 'emit-primitive' },
  'result': { contract: 'report', evidence: 'result-output' },
  'output': { contract: 'report', evidence: 'output-primitive' },
}

// 扫描目标框架 npm 包：package.json 入口 + 主模块导出 API 面
export async function scanFramework(packageName, resolveRoot = process.cwd()) {
  const result = { packageName, installed: false, version: 'unknown', entry: null, exports: [], primitives: {} }
  try {
    // 1) package.json（入口字段：module/main/exports 三种形态都认）
    const pj = await import(pathToFileURL(path.join(resolveRoot, 'node_modules', packageName, 'package.json')).href, { with: { type: 'json' } }).catch(() => null)
    if (pj === null) return { ...result, hint: `npm i -D ${packageName}` }
    const p = pj.default ?? pj
    result.version = p.version ?? 'unknown'
    result.entry = p.module ?? p.main ?? (p.exports ? (typeof p.exports === 'string' ? p.exports : (p.exports['.']?.import ?? p.exports['.']?.default ?? Object.values(p.exports).find(v => typeof v === 'string'))) : null)
    // 2) 动态 import 主模块，枚举导出 API 面（函数/类名）
    const mod = await import(packageName).catch(() => null)
    if (mod === null) return { ...result, hint: 'module-load-failed' }
    result.installed = true
    const exportNames = Object.keys(mod)
    result.exports = exportNames
    // 3) 元契约映射：导出名 → 框架等价原语 → 5 函数契约
    for (const name of exportNames) {
      if (PRIMITIVE_MAP[name]) {
        const m = PRIMITIVE_MAP[name]
        result.primitives[m.contract] ??= []
        result.primitives[m.contract].push({ name, evidence: m.evidence })
      }
    }
  } catch (e) {
    return { ...result, hint: `scan-failed: ${e.message}` }
  }
  return result
}

// 生成候选 adapter 骨架：5 函数契约模板 + 已识别原语的接线
// 识别到的原语直接接线；未识别的契约函数生成"待人工确认"占位（诚实：不假装识别出没有的东西）
export function generateSkeleton(scan, contract = ['claimTask', 'doWork', 'heartbeat', 'respondExpand', 'report']) {
  const lines = []
  lines.push(`// 候选 adapter 骨架（自动生成于 adapter-evolver）——框架 ${scan.packageName}@${scan.version}`)
  lines.push(`// 元契约映射：${Object.keys(scan.primitives).length}/5 契约已识别原语，其余待人工确认（诚实标记，不冒充）`)
  lines.push(`// 部署接线：MeshCore 由影子运行环境注入（骨架不写死相对路径——依赖图保持干净）`)
  lines.push('')
  for (const fn of contract) {
    const prims = scan.primitives[fn] ?? []
    if (prims.length > 0) {
      const p = prims[0]
      lines.push(`// ${fn} ← 识别原语 ${p.name}（${p.evidence}）`)
      lines.push(`export async function ${fn}(...args) { /* TODO: 接线 ${p.name} —— 骨架生成，执行语义由影子运行验证 */ throw new Error('skeleton') }`)
    } else {
      lines.push(`// ${fn} ← 未识别（待人工确认）`)
      lines.push(`export async function ${fn}(...args) { throw new Error('unconfirmed') }`)
    }
  }
  return lines.join('\n')
}
