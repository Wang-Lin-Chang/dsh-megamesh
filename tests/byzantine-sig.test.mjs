// tests/byzantine-sig.test.mjs —— 拜占庭签名单测（E38 核心逻辑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { signReport, verifyReport, endorsementVotes, classifyByzantineDeath, normalizeReport } from '../byzantine-sig.mjs'

const KEYS = Array.from({ length: 3 }, () => generateKeyPairSync('ed25519'))
const report = {
  agentId: 's1', taskId: 7, summary: '威胁度 50', keyNumbers: { severity: 50, task: 7 },
  stateChanges: [], request: '常规记录',
}

test('合法签名验签通过', () => {
  const signed = signReport(report, KEYS[0].privateKey)
  assert.equal(verifyReport(signed, KEYS[0].publicKey), true)
})

test('篡改战报（内容变化）验签失败', () => {
  const signed = signReport(report, KEYS[0].privateKey)
  const tampered = { ...signed, report: { ...report, summary: '改了' } }
  assert.equal(verifyReport(tampered, KEYS[0].publicKey), false)
})

test('伪造签名验签失败', () => {
  assert.equal(verifyReport({ report, sig: 'AAAA' }, KEYS[0].publicKey), false)
})

test('错误公钥验签失败（身份绑定）', () => {
  const signed = signReport(report, KEYS[0].privateKey)
  assert.equal(verifyReport(signed, KEYS[1].publicKey), false)
})

test('normalizeReport 键序无关（同内容同摘要）', () => {
  const a = { b: 1, a: 2 }
  const b = { a: 2, b: 1 }
  assert.equal(normalizeReport(a), normalizeReport(b))
})

test('2/3 背书：严格 quorum（N=5 → 4）', () => {
  const signed = signReport(report, KEYS[0].privateKey)
  const pk = KEYS[0].publicKey
  const v4 = endorsementVotes(signed, [pk, pk, pk, pk, KEYS[1].publicKey])
  assert.equal(v4.quorum, 4)
  assert.equal(v4.passed, true)
  const v3 = endorsementVotes(signed, [pk, pk, pk, KEYS[1].publicKey, KEYS[2].publicKey])
  assert.equal(v3.passed, false, '3/5 < 4 不通过（严格 2/3）')
})

test('D-10~D-12 死因分类命中', () => {
  const deaths = classifyByzantineDeath({
    verifyFailures: ['x'],
    duplicateTaskIds: ['42'],
    endorsementVotes: [{ yes: 2, total: 5, votes: [true, true, false, false, false] }],
  })
  const codes = deaths.map(d => d.code)
  assert.ok(codes.includes('D-10'))
  assert.ok(codes.includes('D-11'))
  assert.ok(codes.includes('D-12'))
})

test('空输入零死亡', () => {
  assert.equal(classifyByzantineDeath({}).length, 0)
})
