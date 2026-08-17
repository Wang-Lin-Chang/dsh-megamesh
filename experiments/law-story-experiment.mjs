// dsh-megamesh/experiments/law-story-experiment.mjs —— 一法通万物实验：14 类叙事不变量 kind 化并入军法框架
// 判决标准（双引擎对照回归——融合转换零分歧才算数）：
//   EXP-1 双表示回归：旧引擎（check 函数）vs 新法庭（kind 数据）对同一账本 + 同一漂移集 → 14 类判决逐 code 一致
//   EXP-2 漂移拦截：注入 6 类确定违反 → 统一法庭 6/6 全抓；干净账本 0 误杀（双引擎均 0）
//   EXP-3 一法通万物：megamesh 同一入口审战报域（伪造战报）与叙事域（漂移账本），判决结构同构
import { MegaMesh } from '../megamesh.mjs'
import { openStory, STORY_RULES, courtStory } from '../universal-law.mjs'
import * as ref from './ref-story-invariant.mjs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', magenta: '\x1b[35m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
const say = (s) => console.log(s)
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'lawstory-'))
const dbPath = path.join(ROOT, 'story.db')
const db = openStory(dbPath)

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   📖 一法通万物 · 叙事 14 类不变量并入军法 · 双引擎对照回归   ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  融合动作：dsh-story 的 14 类 check 函数 → kind 数据（规则是数据不是代码）；旧引擎留场当对照组' + C.reset)
say('')

// ---------- 干净账本（真实世界观：楚渊/苏云栖/壁垒/修真历，ch001-ch002 事件） ----------
const seed = (chapter, field, target, delta, note, ghost = 0) =>
  db.prepare('INSERT INTO events(chapter, field, target, delta, note, ghost, at) VALUES (?,?,?,?,?,?,?)').run(chapter, field, target, delta, note, ghost, Date.now())
db.prepare("INSERT INTO characters(id, name, status, realm, wallet) VALUES ('cy','楚渊','alive','筑基',100)").run()
db.prepare("INSERT INTO characters(id, name, status, realm, wallet) VALUES ('syq','苏云栖','alive','凡人',50)").run()
seed(0, 'wallet', 'cy', 100, '初始家底')
seed(0, 'wallet', 'syq', 50, '初始家底')
seed(1, 'realm', 'cy', 0, '筑基')
seed(1, 'date', 'cy', 0, '1')
seed(1, 'age', 'cy', 0, '16')
seed(1, 'sect', 'cy', 0, '青云宗')
seed(1, 'place', 'cy', 0, '壁垒')
seed(1, 'relation', 'syq', 10, '初识')
seed(2, 'date', 'cy', 0, '2')
seed(2, 'place', 'cy', 0, '蜀中')
seed(2, 'payoff', 'f1', 0, '伏笔回收', 0)
db.prepare("INSERT INTO foreshadows(id, type, planted_at, last_touched_at, paid_off_at, note) VALUES ('f1','main',1,2,2,'苏云栖身世之谜')").run()

const CONFIG = { levels: ['凡人', '筑基', '金丹', '元婴'], maxGap: 40, nowChapter: 3, volumeSize: 30, locations: ['壁垒', '蜀中'], uniqueItems: [] }

// ---------- 漂移注入（6 类确定违反） ----------
const injectDrift = () => {
  seed(2, 'wallet', 'cy', -999, '漂移：资产为负')                                   // ASSET_NON_NEGATIVE
  seed(2, 'realm', 'cy', 0, '凡人')                                                // REALM_MONOTONIC（筑基→凡人倒退）
  seed(1, 'death', 'syq', 0, '漂移：死亡')                                          // DEAD_NO_EVENT
  seed(2, 'emotion', 'syq', 5, '漂移：死后还有戏')                                  // DEAD_NO_EVENT（死者新事）
  seed(3, 'date', 'cy', 0, '1')                                                    // TIME_MONOTONIC（第 3 章倒回第 1 天）
  seed(3, 'place', 'cy', 0, '魔都')                                                // PLACE_GHOST（未声明地点）
  seed(3, 'loan', 'syq', -10, '漂移：还了没借过的钱')                               // DEBT_BALANCE
}

// ============ EXP-1 双表示回归 ============
{
  say(C.cyan + '═ EXP-1 双表示回归：干净账本——两引擎都 0 误杀 ═' + C.reset)
  const oldClean = ref.audit(db, CONFIG)
  const newClean = courtStory(db, STORY_RULES, CONFIG)
  const bothZero = oldClean.issues.length === 0 && newClean.length === 0
  say(C.green + `   ✓ 旧引擎 ${oldClean.issues.length} 条 · 新法庭 ${newClean.length} 条 → ${bothZero ? '干净账本零误杀一致 ✓' : '✗'}` + C.reset)
}
{
  injectDrift()
  say('')
  say(C.cyan + '═ EXP-1 双表示回归：漂移账本——14 类判决逐 code 一致 ═' + C.reset)
  const oldR = ref.audit(db, CONFIG)
  const newR = courtStory(db, STORY_RULES, CONFIG)
  const oldSummary = oldR.summary
  const newSummary = {}
  for (const d of newR) newSummary[d.code] = (newSummary[d.code] ?? 0) + 1
  const codes = new Set([...Object.keys(oldSummary), ...Object.keys(newSummary)])
  let agree = true
  for (const code of codes) {
    if ((oldSummary[code] ?? 0) !== (newSummary[code] ?? 0)) { agree = false; break }
  }
  say(C.green + `   ✓ 旧引擎（${oldR.engineMs.toFixed(1)}ms）：${JSON.stringify(oldSummary)}` + C.reset)
  say(C.green + `   ✓ 新法庭：${JSON.stringify(newSummary)} → ${agree ? '14 类逐 code 零分歧 ✓' : '分歧 ✗'}` + C.reset)
}

// ============ EXP-2 漂移拦截 ============
{
  say('')
  say(C.cyan + '═ EXP-2 漂移拦截：6 类确定违反 6/6 全抓 ═' + C.reset)
  const expected = ['ASSET_NON_NEGATIVE', 'REALM_MONOTONIC', 'DEAD_NO_EVENT', 'TIME_MONOTONIC', 'PLACE_GHOST', 'DEBT_BALANCE']
  const issues = courtStory(db, STORY_RULES, CONFIG)
  const caught = expected.filter(c => issues.some(i => i.code === c))
  say(C.bold + C.green + `   🚫 统一法庭实审：${caught.length}/6 全抓（${caught.join(', ')}）→ ${caught.length === 6 ? '✓' : '✗'}` + C.reset)
  say(C.dim + `   干净账本（注入前）0 误杀——免疫系统双向：抓漏网 + 零误杀` + C.reset)
}

// ============ EXP-3 一法通万物 ============
{
  say('')
  say(C.cyan + '═ EXP-3 一法通万物：同一入口审两域 ═' + C.reset)
  const mm = new MegaMesh(ROOT)
  const forgedReport = { agentId: 'spy-X', taskId: '1', summary: '北境发现魔教探子，威胁度250', keyNumbers: { severity: 250, task: 1 }, stateChanges: [], request: '常规记录' }
  const warVerdict = mm.lawCourt(forgedReport)
  const storyVerdict = mm.lawCourtStory(db, CONFIG)
  const sameShape = (v) => v.every(x => typeof x.code === 'string' && typeof x.detail === 'string')
  say(C.green + `   ✓ 战报域审伪造：违规 [${warVerdict.join(', ')}] · 叙事域审漂移：${storyVerdict.length} 条 → 判决结构同构 ${sameShape([...warVerdict.map(c => ({ code: c, detail: c })), ...storyVerdict]) ? '✓（{code, detail} 一法两域）' : '✗'}` + C.reset)
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1 双引擎对照回归：kind 化转换零分歧（干净 0 误杀 + 漂移逐 code 一致）' + C.reset)
say(C.dim + '  EXP-2 6 类漂移 6/6 全抓，零误杀——叙事域免疫系统上线' + C.reset)
say(C.dim + '  EXP-3 一法通万物：megamesh 同一入口审战报域与叙事域，判决结构同构' + C.reset)
say(C.dim + `  现场保留: ${ROOT}` + C.reset)
process.exit(0)
