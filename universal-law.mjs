// dsh-megamesh/universal-law.mjs —— 一法通万物：叙事 14 类不变量以"数据"并入军法框架
// 融合动作：dsh-story 的 check 函数版 14 类规则 → kind 数据版（规则是数据不是代码，与 war-law 同一哲学）
// 解释器 courtStory(db, rules, opts) 执行声明式规则，输出与战报军法同构的判决 {code, severity, detail}
// kinds：
//   sql              — 声明式 SQL 产出违规行（detail 模板 {字段} 插值）
//   stream-realm     — 境界等级表单调（note 按 levels 表不得倒退）
//   stream-num-target— 数值字段按 target 单调（年龄）
//   stream-day       — 章内日期全局单调（时间线）
//   dead-no-event    — 死者无新事
//   sect-loyalty     — 改换门庭需显式叛门事件
//   holder-chain     — 神器唯一持有（换人需 lost 事件）
//   place-ghost      — 幽灵地点（模板白名单外）
//   foreshadow-overdue / foreshadow-due — 伏笔超期 / 主线钩子应收未收
export const STORY_RULES = [
  {
    code: 'ASSET_NON_NEGATIVE', kind: 'sql', severity: 'critical',
    sql: "SELECT target, SUM(delta) AS cur FROM events WHERE field='wallet' GROUP BY target HAVING cur < 0",
    detail: '{target} 资产回放为负（{cur}）——口袋不可能欠这个世界',
  },
  {
    code: 'REALM_MONOTONIC', kind: 'stream-realm', severity: 'critical',
    levels: [],   // opts.levels 注入（境界等级表是世界观配置，不是代码）
    detail: '{target} 境界倒退：{prev} → {note}（第 {chapter} 章）——除非有显式"重修/跌落"事件',
  },
  { code: 'DEAD_NO_EVENT', kind: 'dead-no-event', severity: 'critical' },
  {
    code: 'RANGE_CHECK', kind: 'sql', severity: 'warning',
    sql: "SELECT * FROM events WHERE field IN ('relation','emotion') AND (delta < -100 OR delta > 100)",
    detail: '第 {chapter} 章 {field} 变动 {delta} 超出 [-100,100]',
  },
  { code: 'FORESHADOW_OVERDUE', kind: 'foreshadow-overdue', severity: 'warning', maxGap: 40 },
  { code: 'FORESHADOW_DUE', kind: 'foreshadow-due', severity: 'warning', volumeSize: 30 },
  {
    code: 'GHOST_PAYOFF', kind: 'sql', severity: 'warning',
    sql: "SELECT * FROM events WHERE field='payoff' AND ghost=1",
    detail: '第 {chapter} 章回收了不存在的伏笔「{target}」——作者以为埋过，账本说没有',
  },
  { code: 'TIME_MONOTONIC', kind: 'stream-day', severity: 'warning' },
  { code: 'AGE_FLOW', kind: 'stream-num-target', severity: 'warning', field: 'age' },
  { code: 'ITEM_UNIQUE', kind: 'holder-chain', severity: 'critical', uniqueItems: [] },
  {
    code: 'DEBT_BALANCE', kind: 'sql', severity: 'warning',
    sql: "SELECT target, SUM(delta) AS bal FROM events WHERE field='loan' GROUP BY target HAVING bal < 0",
    detail: '{target} 还债超出借款 {-bal} 两——还了没借过的钱',
  },
  {
    code: 'NAME_UNIQUE', kind: 'sql', severity: 'warning',
    sql: 'SELECT name, COUNT(*) AS c FROM characters GROUP BY name HAVING c > 1',
    detail: '人物名「{name}」出现 {c} 次——读者会混淆，必须改名或加区分',
  },
  { code: 'SECT_LOYALTY', kind: 'sect-loyalty', severity: 'warning' },
  { code: 'PLACE_GHOST', kind: 'place-ghost', severity: 'critical', locations: [] },
]

export function courtStory(db, rules = STORY_RULES, opts = {}) {
  const out = []
  const levels = opts.levels ?? []
  for (const rule of rules) {
    try {
      switch (rule.kind) {
        case 'sql': {
          const rows = db.prepare(rule.sql).all(...(rule.params?.(opts) ?? []))
          for (const r of rows) out.push({ code: rule.code, severity: rule.severity, detail: rule.detail.replace(/\{(-?\w+)\}/g, (_, k) => r[k] ?? '') })
          break
        }
        case 'stream-realm': {
          if (levels.length === 0) break
          for (const e of db.prepare("SELECT * FROM events WHERE field='realm' ORDER BY seq").all()) {
            const prev = db.prepare('SELECT note FROM events WHERE field=? AND target=? AND seq<? ORDER BY seq DESC LIMIT 1').get('realm', e.target, e.seq)
            if (prev !== undefined && levels.indexOf(e.note) < levels.indexOf(prev.note)) {
              out.push({ code: rule.code, severity: rule.severity, detail: rule.detail.replace(/\{(-?\w+)\}/g, (_, k) => ({ ...e, prev: prev.note })[k] ?? '') })
            }
          }
          break
        }
        case 'stream-num-target': {
          const last = new Map()
          for (const e of db.prepare(`SELECT * FROM events WHERE field='${rule.field}' ORDER BY chapter, seq`).all()) {
            const prev = last.get(e.target)
            const cur = Number(e.note)
            if (prev !== undefined && cur < prev) out.push({ code: rule.code, severity: rule.severity, detail: `${e.target} ${rule.field === 'age' ? '年龄' : rule.field} 倒退：${prev} → ${cur}（第 ${e.chapter} 章）` })
            last.set(e.target, cur)
          }
          break
        }
        case 'stream-day': {
          let prevDay = null
          for (const e of db.prepare("SELECT * FROM events WHERE field='date' ORDER BY chapter, seq").all()) {
            const day = Number(e.note)
            if (prevDay !== null && day < prevDay) out.push({ code: rule.code, severity: rule.severity, detail: `第 ${e.chapter} 章时间倒流：第 ${day} 天 → 之前已是第 ${prevDay} 天` })
            if (!Number.isNaN(day)) prevDay = Math.max(prevDay ?? 0, day)
          }
          break
        }
        case 'dead-no-event': {
          const deaths = db.prepare("SELECT seq, chapter, target FROM events WHERE field='death' ORDER BY seq").all()
          for (const d of deaths) {
            const after = db.prepare('SELECT * FROM events WHERE target=? AND seq>? AND field!=? LIMIT 3').all(d.target, d.seq, 'death')
            for (const a of after) out.push({ code: rule.code, severity: rule.severity, detail: `已故角色 ${d.target}（第 ${d.chapter} 章死亡）在第 ${a.chapter} 章仍有事件「${a.field}:${a.note}」——复活/夺舍必须是显式事件` })
          }
          break
        }
        case 'sect-loyalty': {
          const last = new Map(), lastSeq = new Map()
          for (const e of db.prepare("SELECT * FROM events WHERE field='sect' ORDER BY seq").all()) {
            const prev = last.get(e.target)
            if (prev !== undefined && prev !== e.note) {
              const defect = db.prepare("SELECT COUNT(*) c FROM events WHERE field='defect' AND target=? AND seq>? AND seq<=?").get(e.target, lastSeq.get(e.target) ?? 0, e.seq)
              if (defect.c === 0) out.push({ code: rule.code, severity: rule.severity, detail: `${e.target} 门派变更 ${prev} → ${e.note}（第 ${e.chapter} 章）但无"叛门/被逐"显式事件` })
            }
            last.set(e.target, e.note)
            lastSeq.set(e.target, e.seq)
          }
          break
        }
        case 'holder-chain': {
          const uniques = rule.uniqueItems ?? []
          for (const item of uniques) {
            const holders = db.prepare("SELECT * FROM events WHERE field='hold' AND note=? ORDER BY seq").all(item)
            let holder = null, holderSeq = 0
            for (const h of holders) {
              if (holder !== null && holder !== h.target) {
                const lostBetween = db.prepare('SELECT COUNT(*) c FROM events WHERE field=? AND note=? AND seq>? AND seq<?').get('lost', item, holderSeq, h.seq)
                if (lostBetween.c === 0) out.push({ code: rule.code, severity: rule.severity, detail: `神器「${item}」从 ${holder} 转到 ${h.target}（第 ${h.chapter} 章）但前一持有者从未有"丢失/易主"事件——神器不可能同时在两人手里` })
              }
              holder = h.target
              holderSeq = h.seq
            }
          }
          break
        }
        case 'place-ghost': {
          const locations = new Set(opts.locations ?? rule.locations ?? [])   // 世界观配置走 opts 注入（规则数据只留默认）
          if (locations.size === 0) break
          const ph = Array.from(locations).map(() => '?').join(',')
          const rows = db.prepare(`SELECT chapter, note FROM events WHERE field='place' AND note NOT IN (${ph})`).all(...locations)
          const seen = new Set()
          for (const e of rows) {
            const k = `${e.chapter}|${e.note}`
            if (seen.has(k)) continue
            seen.add(k)
            out.push({ code: rule.code, severity: rule.severity, detail: `第 ${e.chapter} 章出现模板未声明的地点「${e.note}」——要么补地图，要么改地点` })
          }
          break
        }
        case 'foreshadow-overdue': {
          const maxGap = rule.maxGap ?? 40
          const now = opts.nowChapter ?? 0
          for (const f of db.prepare('SELECT * FROM foreshadows').all()) {
            if (f.paid_off_at !== null) continue
            const gap = now - f.last_touched_at
            if (gap > maxGap) out.push({ code: rule.code, severity: rule.severity, detail: `伏笔「${f.id}」${f.note} 埋于第 ${f.planted_at} 章，已 ${gap} 章无人提及` })
          }
          break
        }
        case 'foreshadow-due': {
          const volumeSize = rule.volumeSize ?? 30
          const now = opts.nowChapter ?? 0
          for (const f of db.prepare("SELECT * FROM foreshadows WHERE type='main' AND paid_off_at IS NULL").all()) {
            const due = Math.ceil(f.planted_at / volumeSize) * volumeSize
            if (now > due) out.push({ code: rule.code, severity: rule.severity, detail: `主线钩子「${f.id}」${f.note} 于卷尾 ${due} 章应回收，至今未收` })
          }
          break
        }
      }
    } catch (e) {
      out.push({ code: rule.code, severity: 'error', detail: `审计异常: ${e.message}` })
    }
  }
  return out
}

export function auditStory(db, opts = {}) {
  const t0 = process.hrtime.bigint()
  const issues = courtStory(db, STORY_RULES, opts)
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  const summary = {}
  for (const d of issues) summary[d.code] = (summary[d.code] ?? 0) + 1
  return { issues, summary, engineMs: ms }
}

// 账本（与 dsh-story 同构：单一 append-only 事件流 + 角色投影 + 伏笔表）
import { DatabaseSync } from 'node:sqlite'
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
