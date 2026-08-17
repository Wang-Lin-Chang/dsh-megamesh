// dsh-megamesh/daily-cruise.mjs —— 每日巡航：部署单 + 绿灯入账（自治运营的自动驾驶）
// 语义：部署单红灯 = 巡航报警（exit 1，不发布）；黄灯 = 报告待人工复核；绿灯 = 预检结果入账（非破坏性自治动作）
//       发布动作本身仍需人工批准——人只批关键动作，巡航负责每天把"该不该发"算清楚
// 用法: node daily-cruise.mjs [projectRoot]
import { runDeploy } from './publish-deploy.mjs'
import { PublishLedger } from './publish-ledger.mjs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(process.argv[2] ?? HERE)

const deploy = runDeploy(root)
const ledger = new PublishLedger(root)

// 绿灯：预检入账（自动驾驶的合法动作范围——记录与报告；发布仍需人批准）
if (deploy.advice.level === 'green') {
  ledger.record({ version: 'daily-cruise-preflight', checks: deploy.checks, outcome: 'preflight-ok' })
}

const report = {
  at: Date.now(),
  deploy: { level: deploy.advice.level, action: deploy.advice.action, note: deploy.advice.note, checks: deploy.checks },
  autonomy: { eligible: deploy.autonomy.eligible, wilson: deploy.autonomy.wilson, criteria: deploy.criteria?.best ?? null },
  ledgerEntries: ledger.history().length,
  published: false,   // 巡航不自动发布——人只批关键动作
}
console.log(JSON.stringify(report, null, 2))
process.exit(deploy.advice.level === 'red' ? 1 : 0)
