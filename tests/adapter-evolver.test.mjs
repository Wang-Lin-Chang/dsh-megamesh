// tests/adapter-evolver.test.mjs —— 框架适配进化器单测（E37 核心逻辑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRIMITIVE_MAP, generateSkeleton } from '../adapter-evolver.mjs'

test('元契约映射表覆盖 5 函数契约', () => {
  const contracts = new Set(Object.values(PRIMITIVE_MAP).map(v => v.contract))
  for (const fn of ['claimTask', 'doWork', 'heartbeat', 'respondExpand', 'report']) {
    assert.ok(contracts.has(fn), `${fn} 应有等价原语映射`)
  }
})

test('骨架生成：5 函数完整 + 识别接线 + 未识别诚实标记', () => {
  const scan = {
    packageName: 'test-framework', version: '1.0.0',
    primitives: { doWork: [{ name: 'Graph', evidence: 'graph-api' }] },
  }
  const sk = generateSkeleton(scan)
  for (const fn of ['claimTask', 'doWork', 'heartbeat', 'respondExpand', 'report']) {
    assert.ok(sk.includes(`export async function ${fn}`), `${fn} 应在骨架中`)
  }
  assert.ok(sk.includes('未识别'), '未识别原语应诚实标记')
  assert.ok(sk.includes('← 识别原语 Graph'), '识别到的原语应接线标注')
})

test('骨架生成：零识别也诚实（不冒充）', () => {
  const scan = { packageName: 'empty-fw', version: '0.0.1', primitives: {} }
  const sk = generateSkeleton(scan)
  assert.ok(sk.includes('0/5 契约已识别'))
  assert.ok(sk.includes("throw new Error('unconfirmed')"), '未识别函数应抛 unconfirmed 而非假装实现')
})

test('骨架生成：全识别时 5/5 接线', () => {
  const scan = {
    packageName: 'full-fw', version: '2.0.0',
    primitives: {
      claimTask: [{ name: 'Queue', evidence: 'task-queue' }],
      doWork: [{ name: 'Agent', evidence: 'agent-builder' }],
      heartbeat: [{ name: 'lock', evidence: 'lock-primitive' }],
      respondExpand: [{ name: 'stream', evidence: 'stream-primitive' }],
      report: [{ name: 'output', evidence: 'output-primitive' }],
    },
  }
  const sk = generateSkeleton(scan)
  assert.ok(sk.includes('5/5 契约已识别'))
  assert.ok(!sk.includes('unconfirmed'), '全识别时不应有未确认占位')
})
