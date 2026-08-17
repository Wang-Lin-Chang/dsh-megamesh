// dsh-mesh/time-machine.mjs —— 时间战场核心：checkpoint / audit / diff / restore / merge
// 时间线 = root/timeline/<name>/ 下的账本快照（intent-queue + done + shared——递归含 shared/reports 等子目录）
// 朴素模式（raw）：单遍 copy——追求速度，暴露因果断裂（目录列表快照 vs 逐文件拷贝的时序窗）
// 安全模式（safe）：两遍扫描对账——pass2 补收列表后落盘的文件 + 迁移对账（防重复撕裂），因果自洽
// 语义 diff：按内容哈希对比（mtime 噪音不算变更——防假阳性）
// restore：快照 → 新战场（锁不复制，在途任务由三证据收养重派）
// merge：三向合并战报流（base/a/b），同任务两分支分歧 → 冲突留档，不静默覆盖（防假阳性）
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createHash } from 'node:crypto'

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const SNAPSHOT_DIRS = ['intent-queue', 'done', 'shared']

export class TimeMachine {
  constructor(root) {
    this.root = root
    this.timeline = path.join(root, 'timeline')
    fs.mkdirSync(this.timeline, { recursive: true })
  }

  // 快照名或绝对路径均可（跨宇宙 diff/merge 用绝对路径）
  snapDir(name) {
    return path.isAbsolute(name) ? name : path.join(this.timeline, name)
  }

  async checkpoint(name, { mode = 'safe' } = {}) {
    const dest = this.snapDir(name)
    fs.mkdirSync(dest, { recursive: true })
    const manifest = { at: Date.now(), mode, files: 0, skipped: [], pass2Added: 0 }
    // 瞬态协议区不入账本快照：expand-reqs/expand-resps 是易失交换区，入快照会把陈旧回执带进分支宇宙（跨宇宙状态泄漏）
    const isTransient = (relDir) => relDir === 'shared/expand-reqs' || relDir === 'shared/expand-resps'
    const copyAll = async () => {
      for (const dir of SNAPSHOT_DIRS) {
        const srcDir = path.join(this.root, dir)
        if (!fs.existsSync(srcDir)) continue
        const walk = async (d, relDir) => {
          if (isTransient(relDir)) return
          for (const f of fs.readdirSync(d)) {
            if (f.endsWith('.tmp')) { manifest.skipped.push(path.join(relDir, f)); continue }
            if (f.endsWith('.lock')) continue   // 锁不进快照：restore 时在途任务走三证据收养
            const sp = path.join(d, f)
            let st
            try { st = fs.statSync(sp) } catch { continue }
            if (st.isDirectory()) { await walk(sp, path.join(relDir, f)); continue }
            const dp = path.join(dest, relDir, f)
            fs.mkdirSync(path.dirname(dp), { recursive: true })
            try { fs.copyFileSync(sp, dp); manifest.files++ } catch { manifest.skipped.push(path.join(relDir, f)) }
          }
        }
        await walk(srcDir, dir)
      }
    }
    await copyAll()
    if (mode === 'safe') {
      // pass 2 对账：pass1 目录列表之后的落盘文件补收 + 尺寸变化的文件重收 + 迁移对账（done 落地 → 清 queue 旧副本）
      const reconcile = async (srcDir, relDir) => {
        if (!fs.existsSync(srcDir)) return
        if (isTransient(relDir)) return
        for (const f of fs.readdirSync(srcDir)) {
          if (f.endsWith('.tmp') || f.endsWith('.lock')) continue
          const sp = path.join(srcDir, f)
          let st
          try { st = fs.statSync(sp) } catch { continue }
          if (st.isDirectory()) { await reconcile(sp, path.join(relDir, f)); continue }
          const dp = path.join(dest, relDir, f)
          let need = true
          try { need = fs.statSync(dp).size !== st.size } catch { need = true }
          if (need) {
            fs.mkdirSync(path.dirname(dp), { recursive: true })
            try { fs.copyFileSync(sp, dp); manifest.pass2Added++ } catch {}
          }
          if (relDir === 'done') {
            const m = /^task-(.+)\.json$/.exec(f)
            if (m && !f.includes('.result.')) {
              try { fs.unlinkSync(path.join(dest, 'intent-queue', f)) } catch {}   // 防重复撕裂
            }
          }
        }
      }
      for (const dir of SNAPSHOT_DIRS) await reconcile(path.join(this.root, dir), dir)
    }
    fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2))
    return manifest
  }

  audit(name) {
    const snap = this.snapDir(name)
    const corrupt = [], orphans = []
    const walk = (p, rel) => {
      for (const f of fs.readdirSync(p)) {
        const fp = path.join(p, f)
        const r = path.join(rel, f)
        let st
        try { st = fs.statSync(fp) } catch { continue }
        if (st.isDirectory()) { walk(fp, r); continue }
        if (f.endsWith('.json') && f !== 'manifest.json') {
          try { JSON.parse(fs.readFileSync(fp, 'utf-8')) } catch { corrupt.push(r) }
        }
      }
    }
    for (const dir of SNAPSHOT_DIRS) {
      const d = path.join(snap, dir)
      if (fs.existsSync(d)) walk(d, dir)
    }
    const reportsDir = path.join(snap, 'shared', 'reports')
    if (fs.existsSync(reportsDir)) {
      for (const f of fs.readdirSync(reportsDir)) {
        if (!f.startsWith('report-')) continue
        const t = f.replace(/^report-/, '').replace(/\.json$/, '')
        const inDone = fs.existsSync(path.join(snap, 'done', `task-${t}.json`))
        const inQueue = fs.existsSync(path.join(snap, 'intent-queue', `task-${t}.json`))
        if (!inDone && !inQueue) orphans.push(t)
      }
    }
    // 成对撕裂：done 里任务文件在、result 文件不在（finish 的 rename 与 result 写之间的窗口被拍到）
    const unpaired = []
    const doneDir = path.join(snap, 'done')
    if (fs.existsSync(doneDir)) {
      for (const f of fs.readdirSync(doneDir)) {
        if (f.includes('.result.')) continue
        const m = /^task-(.+)\.json$/.exec(f)
        if (!m) continue
        const t = m[1]
        if (!fs.existsSync(path.join(doneDir, `task-${t}.result.json`))) unpaired.push(t)
      }
    }
    // 重复撕裂：同一任务在 intent-queue 和 done 各有一份（状态迁移中间态被拍到）
    const dups = []
    const queueDir = path.join(snap, 'intent-queue')
    if (fs.existsSync(doneDir) && fs.existsSync(queueDir)) {
      for (const f of fs.readdirSync(doneDir)) {
        if (f.includes('.result.')) continue
        if (fs.existsSync(path.join(queueDir, f))) dups.push(f.replace(/^task-/, '').replace(/\.json$/, ''))
      }
    }
    const count = (d) => fs.existsSync(path.join(snap, d)) ? fs.readdirSync(path.join(snap, d)).filter(f => !f.endsWith('.lock')).length : 0
    return { corrupt, orphans, unpaired, dups, counts: { queue: count('intent-queue'), done: count('done'), reports: fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).filter(f => f.startsWith('report-')).length : 0 } }
  }

  _walk(name) {
    const snap = this.snapDir(name)
    const map = new Map()
    for (const dir of SNAPSHOT_DIRS) {
      const d = path.join(snap, dir)
      if (!fs.existsSync(d)) continue
      const walk = (p, rel) => {
        for (const f of fs.readdirSync(p)) {
          const fp = path.join(p, f)
          const r = path.join(rel, f)
          let st
          try { st = fs.statSync(fp) } catch { continue }
          if (st.isDirectory()) { walk(fp, r); continue }
          if (f === 'manifest.json') continue
          map.set(r, sha(fs.readFileSync(fp)))
        }
      }
      walk(d, dir)
    }
    return map
  }

  diff(a, b) {
    const A = this._walk(a), B = this._walk(b)
    let added = 0, removed = 0, changed = 0
    for (const [k, h] of B) {
      if (!A.has(k)) added++
      else if (A.get(k) !== h) changed++
    }
    for (const k of A.keys()) if (!B.has(k)) removed++
    return { added, removed, changed, unchanged: A.size - changed - removed }
  }

  naiveDiff(a, b) {
    let changed = 0
    const da = this.snapDir(a), db = this.snapDir(b)
    for (const dir of SNAPSHOT_DIRS) {
      const sa = path.join(da, dir), sb = path.join(db, dir)
      if (!fs.existsSync(sa) || !fs.existsSync(sb)) continue
      const walk = (pa, pb) => {
        for (const f of fs.readdirSync(pa)) {
          const fa = path.join(pa, f)
          const fb = path.join(pb, f)
          if (!fs.existsSync(fb)) continue
          let sta, stb
          try { sta = fs.statSync(fa); stb = fs.statSync(fb) } catch { continue }
          if (sta.isDirectory()) { walk(fa, fb); continue }
          if (f === 'manifest.json') continue
          if (sta.mtimeMs !== stb.mtimeMs || sta.size !== stb.size) changed++   // mtime 噪音 → 假阳性
        }
      }
      walk(sa, sb)
    }
    return { changed }
  }

  restore(name, newRoot) {
    const snap = this.snapDir(name)
    for (const dir of SNAPSHOT_DIRS) {
      const src = path.join(snap, dir)
      const dst = path.join(newRoot, dir)
      fs.mkdirSync(dst, { recursive: true })   // 空目录也要建（快照里空目录不存）
      if (!fs.existsSync(src)) continue
      const walk = (p, rel) => {
        for (const f of fs.readdirSync(p)) {
          const fp = path.join(p, f)
          const r = rel === '' ? f : path.join(rel, f)
          if (fs.statSync(fp).isDirectory()) { fs.mkdirSync(path.join(dst, r), { recursive: true }); walk(fp, r); continue }
          if (f === 'manifest.json') continue
          fs.copyFileSync(fp, path.join(dst, r))
        }
      }
      walk(src, '')
    }
    for (const d of ['agents', 'timeline']) fs.mkdirSync(path.join(newRoot, d), { recursive: true })
    let inFlight = []
    try { inFlight = fs.readdirSync(path.join(newRoot, 'intent-queue')).filter(f => f.endsWith('.json')).map(f => f.replace(/^task-/, '').replace(/\.json$/, '')) } catch {}
    return { newRoot, inFlight }
  }

  // 三个快照（可绝对路径）→ 三向合并战报流到 targetDir
  mergeReports(baseDir, aDir, bDir, targetDir, { naive = false } = {}) {
    const load = (dir) => {
      const d = path.join(this.snapDir(dir), 'shared', 'reports')
      const m = new Map()
      if (!fs.existsSync(d)) return m
      for (const f of fs.readdirSync(d)) {
        if (!f.startsWith('report-') || f.includes('spy-')) continue
        m.set(f, fs.readFileSync(path.join(d, f), 'utf-8'))
      }
      return m
    }
    const BASE = load(baseDir), A = load(aDir), B = load(bDir)
    fs.mkdirSync(targetDir, { recursive: true })
    const conflictsDir = path.join(path.dirname(targetDir), 'conflicts')
    fs.mkdirSync(conflictsDir, { recursive: true })
    const conflicts = []
    let merged = 0
    if (naive) {
      for (const [f, c] of A) { fs.writeFileSync(path.join(targetDir, f), c); merged++ }
      for (const [f, c] of B) { if (!A.has(f)) merged++; fs.writeFileSync(path.join(targetDir, f), c) }
      return { merged, conflicts: [] }
    }
    const tasks = new Set([...BASE.keys(), ...A.keys(), ...B.keys()])
    for (const f of tasks) {
      const baseV = BASE.get(f), aV = A.get(f), bV = B.get(f)
      if (aV !== undefined && bV !== undefined && aV !== bV && (aV !== baseV || bV !== baseV)) {
        conflicts.push(f)
        fs.writeFileSync(path.join(conflictsDir, `${f}.a.json`), aV)
        fs.writeFileSync(path.join(conflictsDir, `${f}.b.json`), bV)
        fs.writeFileSync(path.join(targetDir, f), JSON.stringify({ conflict: true, task: f, versions: [`conflicts/${f}.a.json`, `conflicts/${f}.b.json`] }))
        continue
      }
      const pick = aV ?? bV ?? baseV
      if (pick !== undefined) { fs.writeFileSync(path.join(targetDir, f), pick); merged++ }
    }
    return { merged, conflicts }
  }
}
