// dsh-megamesh/megamesh.mjs —— 超级多 Agent 架构统一入口（一栈式）
// 战场（任务/租约/收养）+ 战报 + 军法（解释器/提取器）+ 任期（联邦）+ 时间线 + 人机共读 + 混沌，全部经此入口
// 融合新增能力：
//   1. 全文冷引用：archiveFullText(digest 寻址) + lookupFullText——修复分支宇宙 expand 全文脱钩（time-experiment EXP-5）
//   2. auditBattlefield：全链路终态审计（done 成对 / 战报因果 / 军法 / 锁残留 / 任期）
//   3. spawnChaosDrill：统一入口起混沌演练（复用 chaos-engine）
import { MeshCore } from './mesh-core.mjs'
import { TimeMachine } from './time-machine.mjs'
import { DEFAULT_RULES } from './war-law.mjs'
import { violations } from './war-law-engine.mjs'
import { render as renderHuman, verify as verifyHuman } from './clerk-worker.mjs'
import { recordExit, deriveState, exitCode } from './lifecycle.mjs'
import { courtStory } from './universal-law.mjs'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const digestOf = (s) => createHash('sha256').update(s, 'utf-8').digest('hex')

export class MegaMesh {
  constructor(root, opts = {}) {
    this.root = root
    this.mesh = new MeshCore(root, opts)
    this.tm = new TimeMachine(root)
    this.rules = opts.rules ?? DEFAULT_RULES
    this.primaryFulltext = opts.primaryFulltext ?? null   // 冷引用主宇宙全文库（分支宇宙回源用）
    for (const d of ['shared/reports', 'shared/human', 'shared/expand-reqs', 'shared/expand-resps', 'shared/consensus/decrees', 'shared/fulltext', 'shared/chaos']) {
      fs.mkdirSync(path.join(root, d), { recursive: true })
    }
  }

  // ---------- 战场 ----------
  enqueue(id, payload) { return this.mesh.enqueue(id, payload) }
  pending() { return this.mesh.pending() }
  claim(...a) { return this.mesh.claim(...a) }
  release(...a) { return this.mesh.release(...a) }
  heartbeat(...a) { return this.mesh.heartbeat(...a) }
  finish(...a) { this.mesh.finish(...a); return recordExit(this.root, a[0], 0) }   // witness EXIT 协议：统一入口完成必留 EXIT:0
  sweep() { return this.mesh.sweep() }
  lifecycle(taskId) { return deriveState(this.root, taskId) }
  exitCode(taskId) { return exitCode(this.root, taskId) }
  doneCount() { return fs.readdirSync(path.join(this.root, 'done')).filter(f => f.endsWith('.json') && !f.includes('.result.')).length }

  // ---------- 战报 + 军法 ----------
  reports() {
    const dir = path.join(this.root, 'shared', 'reports')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter(f => /^report-.*\.json$/.test(f) && !f.includes('spy-')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')))
  }
  lawCourt(report, rules = this.rules) { return violations(rules, report) }
  // 一法通万物：同一入口审叙事域（14 类叙事不变量，规则是数据）
  lawCourtStory(db, opts = {}) { return courtStory(db, undefined, opts) }

  // ---------- 任期（联邦） ----------
  term() {
    try {
      const m = /^(.+):(\d+):(\d+):(\d+)$/.exec(fs.readFileSync(path.join(this.root, 'shared', 'consensus', 'term.lock'), 'utf-8').trim())
      return m ? { brainId: m[1], pid: Number(m[2]), startSec: Number(m[3]), term: Number(m[4]) } : null
    } catch { return null }
  }
  decree(term) {
    try { return JSON.parse(fs.readFileSync(path.join(this.root, 'shared', 'consensus', 'decrees', `decree-${term}.json`), 'utf-8')) } catch { return null }
  }
  decrees() {
    const d = path.join(this.root, 'shared', 'consensus', 'decrees')
    if (!fs.existsSync(d)) return []
    return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''))
  }

  // ---------- 时间线 ----------
  checkpoint(...a) { return this.tm.checkpoint(...a) }
  audit(name) { return this.tm.audit(name) }
  diff(a, b) { return this.tm.diff(a, b) }
  naiveDiff(a, b) { return this.tm.naiveDiff(a, b) }
  restore(name, newRoot) { return this.tm.restore(name, newRoot) }
  mergeReports(...a) { return this.tm.mergeReports(...a) }

  // ---------- 人机共读 ----------
  renderHumanReport(report) { return renderHuman(report) }
  verifyHumanReport(md) { return verifyHuman(md) }

  // ---------- 全文冷引用（digest 寻址——跨宇宙 expand 的修复） ----------
  archiveFullText(taskId, fullText) {
    const digest = digestOf(fullText)
    fs.writeFileSync(path.join(this.root, 'shared', 'fulltext', `${digest}.txt`), fullText)
    fs.appendFileSync(path.join(this.root, 'shared', 'fulltext', 'index.jsonl'), JSON.stringify({ taskId: String(taskId), digest, len: fullText.length }) + '\n')
    return digest
  }
  lookupFullText(digest) {
    // 本地全文库 → 主宇宙全文库（冷引用回源）→ null
    try { return fs.readFileSync(path.join(this.root, 'shared', 'fulltext', `${digest}.txt`), 'utf-8') } catch {}
    if (this.primaryFulltext) {
      try { return fs.readFileSync(path.join(this.primaryFulltext, `${digest}.txt`), 'utf-8') } catch {}
    }
    return null
  }

  // ---------- 混沌 ----------
  spawnChaosDrill(opts = {}) {
    const args = [path.join(HERE, 'chaos-engine.mjs'), this.root]
    if (opts.tasks !== undefined) args.push(String(opts.tasks))
    if (opts.watchMs !== undefined) args.push(String(opts.watchMs))
    return spawn(process.execPath, args, { stdio: 'ignore', windowsHide: true, env: { ...process.env, ...(opts.env ?? {}) } })
  }

  // ---------- 全链路终态审计 ----------
  auditBattlefield() {
    const out = { doneUnpaired: [], orphans: [], lawViolations: {}, staleLocks: [], decrees: [], term: this.term() }
    const doneDir = path.join(this.root, 'done')
    if (fs.existsSync(doneDir)) {
      for (const f of fs.readdirSync(doneDir)) {
        if (f.includes('.result.')) continue
        const m = /^task-(.+)\.json$/.exec(f)
        if (!m) continue
        if (!fs.existsSync(path.join(doneDir, `task-${m[1]}.result.json`))) out.doneUnpaired.push(m[1])
      }
    }
    for (const r of this.reports()) {
      const t = String(r.taskId)
      if (!fs.existsSync(path.join(doneDir, `task-${t}.json`))) out.orphans.push(t)
      const v = this.lawCourt(r)
      if (v.length > 0) out.lawViolations[t] = v
    }
    const qDir = path.join(this.root, 'intent-queue')
    if (fs.existsSync(qDir)) out.staleLocks = fs.readdirSync(qDir).filter(f => f.endsWith('.lock'))
    const decDir = path.join(this.root, 'shared', 'consensus', 'decrees')
    if (fs.existsSync(decDir)) out.decrees = fs.readdirSync(decDir).map(f => f.replace(/\.json$/, ''))
    return out
  }
}
