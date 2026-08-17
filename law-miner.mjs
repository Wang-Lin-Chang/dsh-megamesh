// dsh-mesh/law-miner.mjs —— 军法规则提取器（免疫系统）：画像 → 候选规则 → 矛盾检测 → 假阳性报告
// 军纪：提取器不自动生效——候选规则必须过两道自检（画像集零误杀 + 留出集零误杀）才进 v2 草案，人工批准后上线
// 输入：真报目录 shared/reports/report-*.json、现有军法 shared/consensus/war-law-v1.json
// 输出：shared/consensus/miner-report.json（候选 + 矛盾报告）、shared/consensus/war-law-v2.json（修订草案）
// argv: <root>
import * as fs from 'node:fs'
import * as path from 'node:path'
import { evaluate } from './war-law-engine.mjs'

const [root] = process.argv.slice(2)
const reportsDir = path.join(root, 'shared', 'reports')
const consensusDir = path.join(root, 'shared', 'consensus')
const loadJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'))

const allReports = fs.readdirSync(reportsDir)
  .filter(f => f.startsWith('report-') && f.endsWith('.json') && !f.includes('forgery'))
  .map(f => loadJson(path.join(reportsDir, f)))
  .sort((a, b) => Number(a.taskId) - Number(b.taskId))
const split = Math.floor(allReports.length * 2 / 3)
const train = allReports.slice(0, split)
const holdout = allReports.slice(split)
const v1 = loadJson(path.join(consensusDir, 'war-law-v1.json'))

// ---------- 画像 → 候选规则（全部从正常语料统计得出） ----------
const sevs = train.map(r => r.keyNumbers.severity)
const candidates = [
  {
    id: 'RANGE_SEVERITY', kind: 'range', field: 'severity',
    lo: Math.min(...sevs) - 1, hi: Math.max(...sevs) + 1,
    source: 'corpus-bounds',
    note: `语料边界 [${Math.min(...sevs)}, ${Math.max(...sevs)}] + 容差 ±1（防边界假阳性——语料没见过的值不擅自禁）`,
  },
  {
    id: 'REQUEST_ENUM', kind: 'enum', field: 'request',
    allowed: [...new Set(train.map(r => r.request))],
    source: 'corpus-enum',
  },
  {
    id: 'TASK_MATCH', kind: 'eq', a: 'taskId', b: 'keyNumbers.task',
    source: 'corpus-invariant',
  },
  {
    id: 'SUMMARY_HAS_REGION', kind: 'hasAnyOf', field: 'summary',
    anyOf: ['北境', '江南', '蜀中', '东海', '西域'],
    source: 'corpus-pattern',
    note: '真报摘要 100% 含战区词——手写军法没有这条',
  },
  {
    id: 'STATECHANGES_NONEMPTY', kind: 'minItems', field: 'stateChanges', min: 1,
    source: 'corpus-pattern',
    note: '真报状态变更 100% 非空——手写军法没有这条',
  },
]

// ---------- 自检 1/2：候选规则在画像集与留出集都必须零误杀 ----------
const trainKills = candidates.map(c => ({ id: c.id, kills: train.filter(r => evaluate(c, r).length > 0).map(r => r.taskId) }))
const holdoutKills = candidates.map(c => ({ id: c.id, kills: holdout.filter(r => evaluate(c, r).length > 0).map(r => r.taskId) }))

// ---------- 矛盾检测：现有军法在正常语料上的拦截 = 假阳性发现 ----------
const conflictReport = []
for (const rule of v1) {
  const victims = train.filter(r => evaluate(rule, r).length > 0)
  if (victims.length === 0) continue
  let suggestion = null
  if (rule.kind === 'requestThreshold') {
    const conventional = train.filter(r => r.request === '常规记录').map(r => r.keyNumbers.severity)
    const reinforce = train.filter(r => r.request === '建议增援').map(r => r.keyNumbers.severity)
    suggestion = {
      threshold: Math.min(...reinforce) - 1,
      evidence: `正常语料中"常规记录"severity 上限 ${Math.max(...conventional)}，"建议增援"下限 ${Math.min(...reinforce)} → 分界在 ${Math.min(...reinforce) - 1}`,
    }
  }
  conflictReport.push({ ruleId: rule.id, falseKills: victims.length, victims: victims.slice(0, 8).map(r => r.taskId), suggestion })
}

// ---------- v2 草案 = v1 修正 + 零误杀候选（人工批准后生效） ----------
const v2 = v1.map(rule => {
  const hit = conflictReport.find(c => c.ruleId === rule.id && c.suggestion?.threshold !== undefined)
  return hit ? { ...rule, threshold: hit.suggestion.threshold, revisedBy: 'law-miner', status: 'revised-awaiting-review' } : rule
})
for (const c of candidates) {
  const okTrain = trainKills.find(k => k.id === c.id).kills.length === 0
  const okHold = holdoutKills.find(k => k.id === c.id).kills.length === 0
  if (okTrain && okHold && !v2.some(r => r.id === c.id)) v2.push({ ...c, status: 'candidate-awaiting-review' })
}

const report = { at: Date.now(), trainSize: train.length, holdoutSize: holdout.length, candidates, trainKills, holdoutKills, conflictReport, v2 }
fs.writeFileSync(path.join(consensusDir, 'miner-report.json'), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(consensusDir, 'war-law-v2.json'), JSON.stringify(v2, null, 2))
console.log(`law-miner done: ${candidates.length} candidates, ${conflictReport.length} conflicts, v2 ${v2.length} rules`)
