// dsh-megamesh/publish-deploy.mjs —— 发布部署单：预检三关 + 账本资格 + 判据参数扫描（自治发布流程的真实关口）
// 用法: node publish-deploy.mjs <projectRoot>
// 输出部署单：{ checks, criteriaScan, autonomy, advice }——绿灯 = 人一键放行，黄灯 = 需人工复核，红灯 = hold
import { PublishLedger } from './publish-ledger.mjs'
import { wilsonLower } from './shadow-law.mjs'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(process.argv[2] ?? HERE)   // 默认 = 脚本所在项目根（HERE 已是根，勿再加 ..）

// 关 1：预检三关（复用 publish-preflight 的实测逻辑）
const BAD = new RegExp(JSON.parse(fs.readFileSync(path.join(HERE, 'lab', 'bad-words.json'), 'utf-8')).join('|'))
const SKIP = new Set(['node_modules', '.git', 'lab'])
const wordHits = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(mjs|js|cjs|ts|md|json|yml|py)$/.test(e.name)) {
      const m = BAD.exec(fs.readFileSync(p, 'utf-8'))
      if (m) wordHits.push(`${path.relative(root, p)}:...${m[0]}...`)
    }
  }
}
walk(root)
const testRun = spawnSync(process.execPath, ['--test'], { cwd: root, stdio: 'ignore', windowsHide: true, timeout: 300000 })
const preflightRun = spawnSync(process.execPath, [path.join(root, 'experiments', 'preflight-experiment.mjs')], { cwd: root, stdio: 'ignore', windowsHide: true, timeout: 300000 })
const checks = { words: wordHits.length, tests: testRun.status === 0 ? 0 : 1, preflight: preflightRun.status === 0 ? 0 : 1 }

// 关 2：判据参数扫描——候选 (nMin, epsilon) 在真实账本历史上滚动重演资格轨迹
// 度量：首次达标位置 + 达标后轨迹稳定（不再掉回未达标）；零违规历史下首达位置由 nMin 决定
export function scanCriteria(ledger, nMinSet = [5, 10, 15, 20, 25], epsSet = [0.001, 0.005, 0.01, 0.05]) {
  const history = ledger.history()
  const out = []
  for (const nMin of nMinSet) {
    for (const epsilon of epsSet) {
      let firstAt = null, dropsAfter = 0, everEligible = false
      for (let i = 1; i <= history.length; i++) {
        const recent = history.slice(0, i).slice(-nMin)
        let eligible = false
        if (recent.length === nMin) {
          const violations = recent.filter(r => r.checks && (r.checks.words !== 0 || r.checks.tests !== 0 || r.checks.preflight !== 0))
          eligible = wilsonLower(violations.length, nMin) <= epsilon
        }
        if (eligible) {
          everEligible = true
          if (firstAt === null) firstAt = i
        } else if (firstAt !== null) dropsAfter++
      }
      out.push({ nMin, epsilon, firstAt, dropsAfter, stable: everEligible && dropsAfter === 0 })
    }
  }
  return out
}

export function pickCriteria(scan) {
  const stable = scan.filter(s => s.stable && s.firstAt !== null)
  if (stable.length === 0) return { best: null, note: '无稳定参数组合' }
  const best = stable.reduce((a, b) => (a.firstAt <= b.firstAt ? a : b))
  return { best, note: `最早稳定达标：nMin=${best.nMin}, epsilon=${best.epsilon}（第 ${best.firstAt} 条记录起）` }
}

// 关 3：资格（用扫描出的最优参数评当前资格）
const ledger = new PublishLedger(root)
const scan = scanCriteria(ledger)
const picked = pickCriteria(scan)
const autonomy = picked.best
  ? { ...ledger.eligibility({ nMin: picked.best.nMin, epsilon: picked.best.epsilon }), criteria: picked.best }
  : ledger.eligibility()

const advice = checks.words + checks.tests + checks.preflight > 0
  ? { level: 'red', action: 'hold', note: [wordHits[0], checks.tests && '测试红', checks.preflight && '总检红'].filter(Boolean).join('；') }
  : autonomy.eligible
    ? { level: 'green', action: 'publish', note: '三关全绿 + 自治资格达标（绿灯：人一键放行）' }
    : { level: 'yellow', action: 'review', note: `三关全绿但自治资格未达标（${autonomy.reason}）——需人工复核` }

console.log(JSON.stringify({ at: Date.now(), root, checks, criteria: picked, autonomy, advice }, null, 2))
process.exit(advice.level === 'red' ? 1 : 0)
