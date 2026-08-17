// dsh-megamesh/lifecycle.mjs —— witness 生命周期对接：任务五态推导 + EXIT 协议
// 五态（目录结构=真相源，同 witness）：
//   pending（无锁无完成）→ running（有锁）→ done（有 result + EXIT 记录）
//   崩溃 → orphaned（锁残留且持有者死）→ adopted（dead-letter 存档后重入队）
// EXIT 协议：done/task-<id>.exit 写 "EXIT:<code>"——正常完成 0；被 kill 无 EXIT（收养判定证据之一）
import * as fs from 'node:fs'
import * as path from 'node:path'

export const STATES = ['pending', 'running', 'orphaned', 'adopted', 'done']

export function isAlive(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

export function readLock(root, taskId) {
  try { return fs.readFileSync(path.join(root, 'intent-queue', `task-${taskId}.lock`), 'utf-8').trim() } catch { return '' }
}

export function recordExit(root, taskId, code) {
  fs.writeFileSync(path.join(root, 'done', `task-${taskId}.exit`), `EXIT:${code}`)
  return `EXIT:${code}`
}

export function deriveState(root, taskId) {
  const q = path.join(root, 'intent-queue', `task-${taskId}.json`)
  const lock = path.join(root, 'intent-queue', `task-${taskId}.lock`)
  const doneT = path.join(root, 'done', `task-${taskId}.json`)
  const result = path.join(root, 'done', `task-${taskId}.result.json`)
  const exit = path.join(root, 'done', `task-${taskId}.exit`)
  const dl = path.join(root, 'shared', 'dead-letter', `task-${taskId}.json`)
  if (fs.existsSync(doneT) && fs.existsSync(result)) return fs.existsSync(exit) ? 'done' : 'done-no-exit'
  if (fs.existsSync(dl)) return 'adopted'
  if (fs.existsSync(lock)) {
    const m = /^.+:(\d+):(\d+)$/.exec(readLock(root, taskId))
    const pid = m ? Number(m[1]) : null
    if (pid !== null && !isAlive(pid)) return 'orphaned'
    return 'running'
  }
  if (fs.existsSync(q)) return 'pending'
  return 'missing'
}

export function exitCode(root, taskId) {
  try {
    const m = /^EXIT:(\d+)$/.exec(fs.readFileSync(path.join(root, 'done', `task-${taskId}.exit`), 'utf-8').trim())
    return m ? Number(m[1]) : null
  } catch { return null }
}
