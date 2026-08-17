// dsh-megamesh/publish-preflight.mjs —— 发布预检单（真实可用：每次发布前跑它——自治运营的第一块砖）
// 输出：词检/测试/总检三关实测结果 + 发布账本自治资格 → 建议（publish/hold）+ 理由
// 用法: node publish-preflight.mjs <projectRoot>
import { PublishLedger } from './publish-ledger.mjs'
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const [rootArg] = process.argv.slice(2)
const root = path.resolve(rootArg ?? HERE)   // 默认 = 脚本所在项目根（HERE 已是根，勿再加 ..）

// 关 1：词检（全发布树，词表=数据）
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

// 关 2：测试（node --test）
const testRun = spawnSync(process.execPath, ['--test'], { cwd: root, stdio: 'ignore', windowsHide: true, timeout: 300000 })
const testsPass = testRun.status === 0

// 关 3：总检（preflight 四关）
const preflightRun = spawnSync(process.execPath, [path.join(root, 'experiments', 'preflight-experiment.mjs')], { cwd: root, stdio: 'ignore', windowsHide: true, timeout: 300000 })
const preflightPass = preflightRun.status === 0

// 关 4：发布账本自治资格
const ledger = new PublishLedger(root)
const elig = ledger.eligibility({ nMin: 20, epsilon: 0.01 })

const checks = { words: wordHits.length, tests: testsPass ? 0 : 1, preflight: preflightPass ? 0 : 1 }
const advice = checks.words === 0 && checks.tests === 0 && checks.preflight === 0
  ? { action: 'publish', note: '三关全绿' }
  : { action: 'hold', note: [wordHits[0], !testsPass && '测试红', !preflightPass && '总检红'].filter(Boolean).join('；') }

const report = { at: Date.now(), root, checks, advice, autonomy: elig }
console.log(JSON.stringify(report, null, 2))
process.exit(checks.words + checks.tests + checks.preflight === 0 ? 0 : 1)
