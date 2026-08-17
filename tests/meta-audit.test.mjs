// tests/meta-audit.test.mjs —— 元审计判定器单测（E36 核心逻辑）
// 词表 = 数据（lab/bad-words.json）——测试不写字面禁词，防自匹配
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { scanA, scanB, scanC, crossCheck, metaAudit } from '../meta-audit.mjs'

const DATA = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lab', 'bad-words.json'), 'utf-8'))
const WORDS = [DATA[0], DATA[1], 'test-word-x']

test('三实现基线一致（同一文本同命中集）', () => {
  const text = `前面正常 ${WORDS[0]} 中间正常 ${WORDS[1]} 结尾`
  const a = scanA(text, WORDS)
  const b = scanB(text, WORDS)
  const c = scanC(text, WORDS)
  assert.ok(crossCheck(a, b).consistent)
  assert.ok(crossCheck(a, c).consistent)
  assert.equal(a.length, 2)
  assert.equal(b.length, 2)
  assert.equal(c.length, 2)
})

test('无命中文本三实现都零命中', () => {
  const text = '纯干净内容没有命中词'
  assert.equal(scanA(text, WORDS).length, 0)
  assert.equal(scanB(text, WORDS).length, 0)
  assert.equal(scanC(text, WORDS).length, 0)
})

test('重叠词（前缀词先命中）三实现一致', () => {
  const words = ['ab', 'abc', 'bc']
  const text = 'xabcx'
  const a = scanA(text, words)
  const b = scanB(text, words)
  assert.ok(crossCheck(a, b).consistent, JSON.stringify({ a, b }))
})

test('metaAudit：F_1 盲区（漏扫文件）→ F_2 抓分歧', () => {
  const files = { 'a.mjs': '干净', 'b.txt': `含${WORDS[0]}` }
  const f1Results = [{ file: 'a.mjs', hits: [] }]   // F_1 只扫了 .mjs（盲区：漏了 .txt）
  const divs = metaAudit(f1Results, files, WORDS, scanB)
  assert.equal(divs.length, 1)
  assert.equal(divs[0].file, 'b.txt')
  assert.equal(divs[0].f1, 0)
  assert.equal(divs[0].f2, 1)
})

test('metaAudit：无盲区零分歧', () => {
  const files = { 'a.mjs': '干净', 'b.mjs': `含${WORDS[0]}` }
  const f1Results = Object.entries(files).map(([file, text]) => ({ file, hits: scanA(text, WORDS) }))
  const divs = metaAudit(f1Results, files, WORDS, scanB)
  assert.equal(divs.length, 0)
})

test('scanC 字节流与 JS 字符串路径命中位置一致（UTF-8 多字节安全）', () => {
  const text = '前面有中文命中词测试'
  const words = ['命中词']
  const a = scanA(text, words)
  const c = scanC(text, words)
  assert.ok(crossCheck(a, c).consistent, JSON.stringify({ a, c }))
})
