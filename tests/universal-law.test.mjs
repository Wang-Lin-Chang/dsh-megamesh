// tests/universal-law.test.mjs —— 叙事 14 类不变量 kind 化单测（含双引擎对照回归）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openStory, courtStory, STORY_RULES } from '../universal-law.mjs'
import * as ref from '../experiments/ref-story-invariant.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const CONFIG = { levels: ['凡人', '筑基', '金丹', '元婴'], maxGap: 40, nowChapter: 3, volumeSize: 30, locations: ['壁垒', '蜀中'], uniqueItems: [] }

function buildDb() {
  const dbPath = path.join(os.tmpdir(), `lawtest-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  const db = openStory(dbPath)
  const seed = (chapter, field, target, delta, note) =>
    db.prepare('INSERT INTO events(chapter, field, target, delta, note, ghost, at) VALUES (?,?,?,?,?,0,?)').run(chapter, field, target, delta, note, Date.now())
  db.prepare("INSERT INTO characters(id, name, status, realm, wallet) VALUES ('cy','楚渊','alive','筑基',100)").run()
  db.prepare("INSERT INTO characters(id, name, status, realm, wallet) VALUES ('syq','苏云栖','alive','凡人',50)").run()
  seed(0, 'wallet', 'cy', 100, '初始家底')
  seed(1, 'realm', 'cy', 0, '筑基')
  seed(1, 'date', 'cy', 0, '1')
  seed(1, 'age', 'cy', 0, '16')
  seed(1, 'place', 'cy', 0, '壁垒')
  seed(2, 'date', 'cy', 0, '2')
  seed(2, 'place', 'cy', 0, '蜀中')
  return { db, dbPath, seed }
}

test('干净账本零误杀（新旧引擎一致）', () => {
  const { db } = buildDb()
  assert.equal(ref.audit(db, CONFIG).issues.length, 0)
  assert.equal(courtStory(db, STORY_RULES, CONFIG).length, 0)
})

test('6 类漂移全抓（kind 数据与 check 函数零分歧）', () => {
  const { db, seed } = buildDb()
  seed(2, 'wallet', 'cy', -999, '漂移：资产为负')
  seed(2, 'realm', 'cy', 0, '凡人')
  seed(1, 'death', 'syq', 0, '漂移：死亡')
  seed(2, 'emotion', 'syq', 5, '漂移：死后还有戏')
  seed(3, 'date', 'cy', 0, '1')
  seed(3, 'place', 'cy', 0, '魔都')
  seed(3, 'loan', 'syq', -10, '漂移：还了没借过的钱')
  const old = ref.audit(db, CONFIG).summary
  const fresh = courtStory(db, STORY_RULES, CONFIG)
  const summary = {}
  for (const d of fresh) summary[d.code] = (summary[d.code] ?? 0) + 1
  assert.deepEqual(summary, old)   // 逐 code 一致
  const expected = ['ASSET_NON_NEGATIVE', 'REALM_MONOTONIC', 'DEAD_NO_EVENT', 'TIME_MONOTONIC', 'PLACE_GHOST', 'DEBT_BALANCE']
  for (const c of expected) assert.ok(summary[c] >= 1, `缺 ${c}`)
})

test('判决结构同构 {code, severity, detail}', () => {
  const { db, seed } = buildDb()
  seed(2, 'wallet', 'cy', -5, '负债')
  for (const d of courtStory(db, STORY_RULES, CONFIG)) {
    assert.equal(typeof d.code, 'string')
    assert.equal(typeof d.detail, 'string')
  }
})
