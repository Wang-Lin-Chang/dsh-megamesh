// dsh-story/story-invariant-core.mjs —— 叙事不变量审计引擎（声明式硬规则 + 事件流回放，零依赖）
// 设计原则：规则是数据（声明式 JSON），不是代码——规则集可插拔、可扩展、可进 story-spec 规范
// 纪律：硬规则零误杀（每条规则只报确定违反，语义边界交给软审层）
import { DatabaseSync } from 'node:sqlite'
import * as fs from 'node:fs'

// ---------- 叙事不变量库（声明式） ----------
export const INVARIANTS = {
  ASSET_NON_NEGATIVE: {
    name: '资产非负',
    severity: 'critical',
    check(db) {
      // 实测判决：初始快照事件化（建档时写 chapter=0 种子事件）——真理模型统一为单一事件流，
      // 规则变纯 SQL 聚合（无 JOIN：SQL JOIN 版 2979ms 弃用；JS 回放 93ms 被纯聚合替代）
      return db.prepare("SELECT target, SUM(delta) AS cur FROM events WHERE field='wallet' GROUP BY target HAVING cur < 0").all()
        .map(r => ({ code: 'ASSET_NON_NEGATIVE', detail: `${r.target} 资产回放为负（${r.cur}）——口袋不可能欠这个世界` }))
    },
  },
  REALM_MONOTONIC: {
    name: '境界单调不减',
    severity: 'critical',
    check(db, opts = {}) {
      const levels = opts.levels ?? []
      const out = []
      // 真理模型 = 单一事件流（初始快照事件化：建档时写 chapter=0 种子事件）
      for (const e of db.prepare("SELECT * FROM events WHERE field='realm' ORDER BY seq").all()) {
        const prev = db.prepare('SELECT note FROM events WHERE field=? AND target=? AND seq<? ORDER BY seq DESC LIMIT 1').get('realm', e.target, e.seq)
        if (prev !== undefined && levels.indexOf(e.note) < levels.indexOf(prev.note)) {
          out.push({ code: 'REALM_MONOTONIC', detail: `${e.target} 境界倒退：${prev.note} → ${e.note}（第 ${e.chapter} 章）——除非有显式"重修/跌落"事件` })
        }
      }
      return out
    },
  },
  DEAD_NO_EVENT: {
    name: '死者无新事',
    severity: 'critical',
    check(db) {
      const out = []
      const deaths = db.prepare("SELECT seq, chapter, target FROM events WHERE field='death' ORDER BY seq").all()
      for (const d of deaths) {
        const after = db.prepare('SELECT * FROM events WHERE target=? AND seq>? AND field!=? LIMIT 3').all(d.target, d.seq, 'death')
        for (const a of after) out.push({ code: 'DEAD_NO_EVENT', detail: `已故角色 ${d.target}（第 ${d.chapter} 章死亡）在第 ${a.chapter} 章仍有事件「${a.field}:${a.note}」——复活/夺舍必须是显式事件` })
      }
      return out
    },
  },
  RANGE_CHECK: {
    name: '关系/情绪值域',
    severity: 'warning',
    check(db) {
      return db.prepare("SELECT * FROM events WHERE field IN ('relation','emotion') AND (delta < -100 OR delta > 100)").all()
        .map(e => ({ code: 'RANGE_CHECK', detail: `第 ${e.chapter} 章 ${e.field} 变动 ${e.delta} 超出 [-100,100]` }))
    },
  },
  FORESHADOW_OVERDUE: {
    name: '伏笔超期',
    severity: 'warning',
    check(db, opts = {}) {
      const maxGap = opts.maxGap ?? 40
      const now = opts.nowChapter
      const out = []
      const items = db.prepare('SELECT * FROM foreshadows').all()
      for (const f of items) {
        if (f.paid_off_at !== null) continue
        const gap = now - f.last_touched_at
        if (gap > maxGap) out.push({ code: 'FORESHADOW_OVERDUE', detail: `伏笔「${f.id}」${f.note} 埋于第 ${f.planted_at} 章，已 ${gap} 章无人提及` })
      }
      return out
    },
  },
  FORESHADOW_DUE: {
    name: '主线钩子应收未收',
    severity: 'warning',
    check(db, opts = {}) {
      const volumeSize = opts.volumeSize ?? 30
      const now = opts.nowChapter
      const out = []
      const items = db.prepare("SELECT * FROM foreshadows WHERE type='main' AND paid_off_at IS NULL").all()
      for (const f of items) {
        const due = Math.ceil(f.planted_at / volumeSize) * volumeSize
        if (now > due) out.push({ code: 'FORESHADOW_DUE', detail: `主线钩子「${f.id}」${f.note} 于卷尾 ${due} 章应回收，至今未收` })
      }
      return out
    },
  },
  GHOST_PAYOFF: {
    name: '幽灵回收',
    severity: 'warning',
    check(db) {
      return db.prepare("SELECT * FROM events WHERE field='payoff' AND ghost=1").all()
        .map(e => ({ code: 'GHOST_PAYOFF', detail: `第 ${e.chapter} 章回收了不存在的伏笔「${e.target}」——作者以为埋过，账本说没有` }))
    },
  },
  TIME_MONOTONIC: {
    name: '时间线单调',
    severity: 'warning',
    check(db) {
      const out = []
      const evs = db.prepare("SELECT * FROM events WHERE field='date' ORDER BY chapter, seq").all()
      let prevDay = null
      for (const e of evs) {
        const day = Number(e.note)   // 章内日期（第几天）
        if (prevDay !== null && day < prevDay) out.push({ code: 'TIME_MONOTONIC', detail: `第 ${e.chapter} 章时间倒流：第 ${day} 天 → 之前已是第 ${prevDay} 天` })
        if (day !== null && !Number.isNaN(day)) prevDay = Math.max(prevDay ?? 0, day)
      }
      return out
    },
  },
  PLACE_GHOST: {
    name: '幽灵地点（地图外）',
    severity: 'critical',
    check(db, opts = {}) {
      const locations = new Set(opts.locations ?? [])
      if (locations.size === 0) return []
      // 实测优化：SQL 端过滤（NOT IN 白名单）+ JS Set 去重（DISTINCT 排序成本 30ms → Set 去重 ~5ms）
      const ph = Array.from(locations).map(() => '?').join(',')
      const rows = db.prepare(`SELECT chapter, note FROM events WHERE field='place' AND note NOT IN (${ph})`).all(...locations)
      const seen = new Set()
      const out = []
      for (const e of rows) {
        const k = `${e.chapter}|${e.note}`
        if (seen.has(k)) continue
        seen.add(k)
        out.push({ code: 'PLACE_GHOST', detail: `第 ${e.chapter} 章出现模板未声明的地点「${e.note}」——要么补地图，要么改地点` })
      }
      return out
    },
  },
  AGE_FLOW: {
    name: '年龄单调',
    severity: 'warning',
    check(db) {
      const out = []
      const last = new Map()
      for (const e of db.prepare("SELECT * FROM events WHERE field='age' ORDER BY chapter, seq").all()) {
        const prev = last.get(e.target)
        const cur = Number(e.note)
        if (prev !== undefined && cur < prev) out.push({ code: 'AGE_FLOW', detail: `${e.target} 年龄倒退：${prev} → ${cur}（第 ${e.chapter} 章）` })
        last.set(e.target, cur)
      }
      return out
    },
  },
  ITEM_UNIQUE: {
    name: '神器唯一持有',
    severity: 'critical',
    check(db, opts = {}) {
      const uniques = new Set(opts.uniqueItems ?? [])
      if (uniques.size === 0) return []
      const out = []
      for (const item of uniques) {
        const holders = db.prepare("SELECT * FROM events WHERE field='hold' AND note=? ORDER BY seq").all(item)
        // 持有链：换人必须经过 'lost' 显式事件（丢失/易主）
        let holder = null
        let holderSeq = 0
        for (const h of holders) {
          if (holder !== null && holder !== h.target) {
            const lostBetween = db.prepare('SELECT COUNT(*) c FROM events WHERE field=? AND note=? AND seq>? AND seq<?').get('lost', item, holderSeq, h.seq)
            if (lostBetween.c === 0) out.push({ code: 'ITEM_UNIQUE', detail: `神器「${item}」从 ${holder} 转到 ${h.target}（第 ${h.chapter} 章）但前一持有者从未有"丢失/易主"事件——神器不可能同时在两人手里` })
          }
          holder = h.target
          holderSeq = h.seq
        }
      }
      return out
    },
  },
  DEBT_BALANCE: {
    name: '债务余额非负（还超借）',
    severity: 'warning',
    check(db) {
      const bal = new Map()
      for (const e of db.prepare("SELECT * FROM events WHERE field='loan' ORDER BY seq").all()) {
        bal.set(e.target, (bal.get(e.target) ?? 0) + (e.delta ?? 0))
      }
      return [...bal.entries()].filter(([, b]) => b < 0)
        .map(([who, b]) => ({ code: 'DEBT_BALANCE', detail: `${who} 还债超出借款 ${-b} 两——还了没借过的钱` }))
    },
  },
  NAME_UNIQUE: {
    name: '同名人物冲突',
    severity: 'warning',
    check(db) {
      return db.prepare('SELECT name, COUNT(*) c FROM characters GROUP BY name HAVING c > 1').all()
        .map(r => ({ code: 'NAME_UNIQUE', detail: `人物名「${r.name}」出现 ${r.c} 次——读者会混淆，必须改名或加区分` }))
    },
  },
  SECT_LOYALTY: {
    name: '改换门庭需显式叛门',
    severity: 'warning',
    check(db) {
      const out = []
      const last = new Map()
      const lastSeq = new Map()   // 每个角色各自的上一 sect 事件 seq（defect 查询窗口按角色）
      for (const e of db.prepare("SELECT * FROM events WHERE field='sect' ORDER BY seq").all()) {
        const prev = last.get(e.target)
        if (prev !== undefined && prev !== e.note) {
          const defect = db.prepare("SELECT COUNT(*) c FROM events WHERE field='defect' AND target=? AND seq>? AND seq<=?").get(e.target, lastSeq.get(e.target) ?? 0, e.seq)
          if (defect.c === 0) out.push({ code: 'SECT_LOYALTY', detail: `${e.target} 门派变更 ${prev} → ${e.note}（第 ${e.chapter} 章）但无"叛门/被逐"显式事件` })
        }
        last.set(e.target, e.note)
        lastSeq.set(e.target, e.seq)
      }
      return out
    },
  },
}

// ---------- 账本 ----------
export function openStory(dbPath) {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'alive', realm TEXT, wallet REAL NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, chapter INTEGER NOT NULL, field TEXT NOT NULL, target TEXT NOT NULL, delta REAL, note TEXT, ghost INTEGER DEFAULT 0, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_events_field ON events(field);
    CREATE INDEX IF NOT EXISTS idx_events_chapter ON events(chapter);
    CREATE TABLE IF NOT EXISTS foreshadows(id TEXT PRIMARY KEY, type TEXT, planted_at INTEGER, last_touched_at INTEGER, paid_off_at INTEGER, note TEXT);
  `)
  return db
}

export function audit(db, config = {}) {
  const t0 = process.hrtime.bigint()
  const all = []
  for (const [key, inv] of Object.entries(INVARIANTS)) {
    try { all.push(...inv.check(db, config)) } catch (e) { all.push({ code: key, detail: `审计异常: ${e.message}` }) }
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  const summary = {}
  for (const d of all) summary[d.code] = (summary[d.code] ?? 0) + 1
  return { issues: all, summary, engineMs: ms }
}
