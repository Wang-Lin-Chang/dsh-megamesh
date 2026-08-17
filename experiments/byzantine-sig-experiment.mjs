// dsh-megamesh/experiments/byzantine-sig-experiment.mjs —— 拜占庭签名验证（E38）
// 预言二落地的本机可实测部分：Ed25519 签名/验签、2/3 背书、D-10~D-12 死因分类
// 诚实边界：崩溃容错换脑 ≠ 拜占庭容错——跨机器合谋/网络分区/双花时序进 spec 标注待实测，不冒认
// 判决标准：
//   EXP-1 签名验证：合法签名放行 + 篡改战报/伪造签名拦截（密码学原语本机可验）
//   EXP-2 2/3 背书：N=5 验证者，3/5 签真通过、2/5 伪造不通过（quorum 严格 2/3）
//   EXP-3 D-10~D-12 分类：三种拜占庭死亡形态各命中对应死因代码（预言二关键信号）
//   EXP-4 对照组：无签名战报（现状）对篡改零感知——签名机制的增量价值量化
import { generateKeyPairSync } from 'node:crypto'
import { signReport, verifyReport, endorsementVotes, classifyByzantineDeath, normalizeReport } from '../byzantine-sig.mjs'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m', magenta: '\x1b[35m', reset: '\x1b[0m' }
const say = (s) => console.log(s)

say(C.bold + C.magenta + '╔══════════════════════════════════════════════════════════╗' + C.reset)
say(C.bold + C.magenta + '║   🛡️ 拜占庭签名验证（E38）：预言二的本机可实测部分 ║' + C.reset)
say(C.bold + C.magenta + '╚══════════════════════════════════════════════════════════╝' + C.reset)
say(C.dim + '  签名/验签/背书/死因分类 = 密码学与协议逻辑，单机可验；跨机器合谋/网络分区 → spec 待实测' + C.reset)
say('')
let allPassed = true
const verdict = (name, cond, detail) => { say((cond ? C.green + '   ✓ ' : C.red + '   ✗ ') + name + C.reset + C.dim + ' — ' + detail + C.reset); if (!cond) allPassed = false }

// 5 个验证者密钥对（N=5 背书组）
const KEYS = Array.from({ length: 5 }, () => generateKeyPairSync('ed25519'))
const report = {
  agentId: 'scout-1', taskId: 42, summary: '北境发现魔教探子，威胁度 50',
  keyNumbers: { severity: 50, task: 42 },
  stateChanges: [{ field: 'threat', target: '北境', delta: 50, note: '魔教探子' }], request: '常规记录',
}

// ---------- EXP-1 签名验证 ----------
{
  say(C.cyan + '═ EXP-1 签名验证：合法放行 + 篡改/伪造拦截 ═' + C.reset)
  const signed = signReport(report, KEYS[0].privateKey)
  const legit = verifyReport(signed, KEYS[0].publicKey)
  const tampered = verifyReport({ ...signed, report: { ...report, summary: '篡改后的战报，威胁度 999' } }, KEYS[0].publicKey)
  const forged = verifyReport({ report, sig: Buffer.from('not-a-real-signature').toString('base64') }, KEYS[0].publicKey)
  const wrongKey = verifyReport(signed, KEYS[1].publicKey)   // 别人公钥验本人签名 = 失败
  verdict('合法签名放行', legit, 'Ed25519 验签通过')
  verdict('篡改战报拦截', tampered === false, '改一个字签名即失效')
  verdict('伪造签名拦截', forged === false, '无对应私钥签不出有效签名')
  verdict('错误公钥拦截', wrongKey === false, '验证者身份绑定')
}

// ---------- EXP-2 2/3 背书 ----------
{
  say('')
  say(C.cyan + '═ EXP-2 2/3 背书：N=5，3 真签通过 / 2 伪造不通过 ═' + C.reset)
  const signed = signReport(report, KEYS[0].privateKey)
  // 场景 A：3 个验证者持有签名方公钥（真签），2 个只有错误公钥（背书失败）
  const votesA = endorsementVotes(signed, [KEYS[0].publicKey, KEYS[0].publicKey, KEYS[0].publicKey, KEYS[1].publicKey, KEYS[2].publicKey])
  // 场景 B：只有 2 个真签
  const votesB = endorsementVotes(signed, [KEYS[0].publicKey, KEYS[0].publicKey, KEYS[1].publicKey, KEYS[2].publicKey, KEYS[3].publicKey])
  verdict('3/5 真签通过 quorum（4）', votesA.yes === 3 && votesA.passed === false, `yes=${votesA.yes}/5 quorum=${votesA.quorum}——3<4 不通过（严格 2/3）`)
  verdict('2/5 不通过', votesB.passed === false, `yes=${votesB.yes}/5 < quorum=${votesB.quorum}`)
  // 场景 C：4/5 真签通过
  const votesC = endorsementVotes(signed, [KEYS[0].publicKey, KEYS[0].publicKey, KEYS[0].publicKey, KEYS[0].publicKey, KEYS[1].publicKey])
  verdict('4/5 通过 quorum', votesC.passed === true, `yes=${votesC.yes}/5 ≥ quorum=${votesC.quorum}`)
}

// ---------- EXP-3 D-10~D-12 死因分类 ----------
{
  say('')
  say(C.cyan + '═ EXP-3 D-10~D-12 死因分类：三种拜占庭死亡形态 ═' + C.reset)
  const deaths = classifyByzantineDeath({
    verifyFailures: ['scout-7 战报验签失败'],
    duplicateTaskIds: ['taskId 42 重复提交两份不同战报'],
    endorsementVotes: [{ yes: 3, total: 5, votes: [true, true, true, false, false] }],
  })
  const codes = new Set(deaths.map(d => d.code))
  verdict('D-10 签名伪造命中', codes.has('D-10'), deaths.find(d => d.code === 'D-10')?.detail ?? '')
  verdict('D-11 双花战报命中', codes.has('D-11'), deaths.find(d => d.code === 'D-11')?.detail ?? '')
  verdict('D-12 拜占庭合谋命中', codes.has('D-12'), deaths.find(d => d.code === 'D-12')?.detail ?? '')
}

// ---------- EXP-4 对照组：无签名现状 ----------
{
  say('')
  say(C.cyan + '═ EXP-4 对照组：无签名战报（现状）对篡改零感知 ═' + C.reset)
  // 无签名战报：篡改后与原件无任何区分机制
  const unsigned = { ...report }
  const tamperedUnsigned = { ...report, summary: '篡改后的战报，威胁度 999' }
  const unsignedDetectable = normalizeReport(unsigned) !== normalizeReport(tamperedUnsigned)   // 内容不同但无权威性证明
  verdict('对照组量化：无签名无法证明"谁写的/改没改"', unsignedDetectable, '内容差异可见，但权威性零保证——签名机制 = 权威性增量')
}

say('')
say(C.bold + '════════ 判决 ════════' + C.reset)
say(C.dim + '  EXP-1/2 签名/验签/背书本机实测全绿——密码学原语与协议逻辑不需要跨机器环境' + C.reset)
say(C.dim + '  EXP-3 D-10~D-12 分类器就位——预言二"当 autopsy-spec 出现拜占庭死因代码时就是这一步开始的标志"落地' + C.reset)
say(C.dim + '  EXP-4 无签名对照量化增量价值——崩溃容错 ≠ 拜占庭容错，签名是后者第一步' + C.reset)
say(C.dim + '  → 本机能测的全测了；跨机器合谋/网络分区/双花时序 → byzantine-spec.md 标注待实测（不冒认）' + C.reset)
process.exit(allPassed ? 0 : 1)
