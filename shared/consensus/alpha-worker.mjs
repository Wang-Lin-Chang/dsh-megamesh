
import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
const [root, expsJson, workerId] = process.argv.slice(2)
const exps = JSON.parse(expsJson)
const out = []
for (const exp of exps) {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [path.join(root, 'experiments', exp)], { cwd: root, stdio: 'ignore', windowsHide: true, timeout: 300000 })
  out.push({ exp, exit: r.status, elapsedMs: Date.now() - t0 })
}
fs.writeFileSync(path.join(root, 'shared', 'consensus', 'alpha-worker-' + workerId + '.json'), JSON.stringify(out))
