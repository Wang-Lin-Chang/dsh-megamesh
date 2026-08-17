// dsh-mesh/clerk-worker.mjs —— 文书官：人机共读战报（Markdown 人读区 + JSON 机器区，同一文件两种消费）
// 职责：渲染（JSON 战报 → .md）/ 解析（.md → 两区 + 批注）/ 校验（JSON 区过军法 + 两区一致性）/ 应用批注
// 批注协议：> 【批注】{"field":"value"} —— 人可读可写，机器可解析；批注同样过军法（军法面前人人平等）
// argv: <root> <render|watch> —— watch 循环扫批注并应用，回写 .md 与源头 .json，动作记入 actions.jsonl
import { violations } from './war-law-engine.mjs'
import { DEFAULT_RULES } from './war-law.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

const RULES = DEFAULT_RULES   // 统一规则源：与军法提取器/统一入口同源，一种表示零分歧

export function render(report) {
  const md = [
    `# 战报 task-${report.taskId}`,
    '',
    `> 摘要：${report.summary}`,
    report.note ? `> 备注：${report.note}` : null,
    '',
    '| 指标 | 值 |',
    '|---|---|',
    `| severity | ${report.keyNumbers.severity} |`,
    `| task | ${report.keyNumbers.task} |`,
    '',
    '## 状态变更',
    ...(report.stateChanges ?? []).map(s => `- [x] ${s.target}：${s.note}（delta ${s.delta}）`),
    '',
    '## 请求',
    `- [${report.request === '建议增援' ? 'x' : ' '}] 建议增援`,
    `- [${report.request === '常规记录' ? 'x' : ' '}] 常规记录`,
    '',
    '<!-- JSON -->',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
  ].filter(l => l !== null).join('\n')
  return md
}

export function parse(md) {
  const jsonBlock = /```json\n([\s\S]*?)\n```/.exec(md)
  const summaryLine = /^> 摘要：(.+)$/m.exec(md)
  const noteLine = /^> 备注：(.+)$/m.exec(md)
  const sevRow = /^\| severity \| (\d+) \|$/m.exec(md)
  const annotations = []
  for (const m of md.matchAll(/^> 【批注】(\{[\s\S]*?\})$/gm)) {
    try { annotations.push(JSON.parse(m[1])) } catch {}
  }
  return {
    json: jsonBlock ? JSON.parse(jsonBlock[1]) : null,
    summaryLine: summaryLine ? summaryLine[1] : null,
    noteLine: noteLine ? noteLine[1] : null,
    severityRow: sevRow ? Number(sevRow[1]) : null,
    annotations,
  }
}

export function verify(md) {
  const p = parse(md)
  const errors = []
  if (p.json === null) errors.push('JSON 区缺失/不可解析')
  if (p.summaryLine === null) errors.push('Markdown 摘要行缺失')
  if (p.severityRow === null) errors.push('Markdown severity 行缺失')
  if (p.json !== null) {
    errors.push(...violations(RULES, p.json).map(id => `军法违规: ${id}`))
    if (p.summaryLine !== null && p.json.summary !== p.summaryLine) errors.push('两区矛盾: 摘要不一致')
    if (p.severityRow !== null && p.json.keyNumbers.severity !== p.severityRow) errors.push('两区矛盾: severity 不一致')
    if (p.json.note !== undefined && (p.noteLine === null || p.json.note !== p.noteLine)) errors.push('两区矛盾: 备注不一致')
  }
  return { ok: errors.length === 0, errors }
}

export function applyAnnotations(md) {
  const p = parse(md)
  let report = p.json
  const applied = [], rejected = []
  for (const ann of p.annotations) {
    const next = { ...report, ...ann }
    const v = violations(RULES, next)
    if (v.length > 0) { rejected.push({ ann, violations: v }); continue }   // 军法面前人人平等
    report = next
    applied.push(ann)
  }
  if (applied.length === 0) return { md, applied, rejected, report }
  return { md: render(report), applied, rejected, report }
}

// ---------- CLI ----------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const [root, action] = process.argv.slice(2)
  const reportsDir = path.join(root, 'shared', 'reports')
  const humanDir = path.join(root, 'shared', 'human')
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const logAction = (a) => fs.appendFileSync(path.join(humanDir, 'actions.jsonl'), JSON.stringify(a) + '\n')
  fs.mkdirSync(humanDir, { recursive: true })
  if (action === 'render') {
    let n = 0
    for (const f of fs.readdirSync(reportsDir)) {
      if (!f.startsWith('report-') || !f.endsWith('.json')) continue
      const r = JSON.parse(fs.readFileSync(path.join(reportsDir, f), 'utf-8'))
      fs.writeFileSync(path.join(humanDir, f.replace(/\.json$/, '.md')), render(r))
      n++
    }
    console.log(`clerk render: ${n} human-readable reports`)
    process.exit(0)
  }
  // watch：扫批注 → 应用 → 回写
  ;(async () => {
    for (;;) {
      try {
        for (const f of fs.readdirSync(humanDir)) {
          if (!f.endsWith('.md')) continue
          const p = path.join(humanDir, f)
          const md = fs.readFileSync(p, 'utf-8')
          if (!md.includes('【批注】')) continue
          const r = applyAnnotations(md)
          if (r.applied.length === 0 && r.rejected.length === 0) continue
          if (r.rejected.length > 0) logAction({ at: Date.now(), file: f, type: 'rejected', rejected: r.rejected })
          if (r.applied.length > 0) {
            fs.writeFileSync(p, r.md)
            const src = path.join(reportsDir, f.replace(/\.md$/, '.json'))
            if (fs.existsSync(src)) fs.writeFileSync(src, JSON.stringify(r.report, null, 2))
            logAction({ at: Date.now(), file: f, type: 'applied', applied: r.applied })
          }
        }
      } catch {}
      await sleep(200)
    }
  })()
}
