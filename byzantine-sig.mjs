// dsh-megamesh/byzantine-sig.mjs —— 拜占庭签名验证核心（E38 判定器，纯函数可导入）
// 预言二落地的"本机可实测部分"：崩溃容错换脑 ≠ 拜占庭容错（诚实边界）
// 本机能实测的：Ed25519 签名/验签、2/3 背书投票、D-10~D-12 死因分类——这些是密码学与协议逻辑，单机可验
// 本机不能实测的：跨机器合谋/网络分区/双花时序——这些进 byzantine-spec.md 规范，标注"待社区实测"，不冒认
import { generateKeyPairSync, sign as edSign, verify as edVerify } from 'node:crypto'

// 签名战报：report + 签名（Ed25519 私钥签 report 的规范化 JSON 摘要）
export function normalizeReport(report) {
  return JSON.stringify(report, Object.keys(report).sort())
}

export function signReport(report, privateKey) {
  const digest = normalizeReport(report)
  const sig = edSign(null, Buffer.from(digest, 'utf-8'), privateKey)
  return { report, sig: sig.toString('base64') }
}

export function verifyReport(signed, publicKey) {
  try {
    const digest = normalizeReport(signed.report)
    return edVerify(null, Buffer.from(digest, 'utf-8'), publicKey, Buffer.from(signed.sig, 'base64'))   // verify(null, data, key, signature)
  } catch { return false }
}

// 2/3 背书：N 个验证者对同一战报的验签投票（拜占庭容错的必要非充分条件——诚实边界）
export function endorsementVotes(signed, publicKeys) {
  const votes = publicKeys.map(pk => verifyReport(signed, pk))
  const yes = votes.filter(Boolean).length
  const quorum = Math.floor(publicKeys.length * 2 / 3) + 1   // 严格 2/3（进一取整）
  return { yes, total: publicKeys.length, quorum, passed: yes >= quorum, votes }
}

// D-10~D-12 死因代码分类器（预言二关键信号：autopsy-spec 新增拜占庭死因）
//   D-10 签名伪造（SIGNATURE_FORGERY）：验签失败的战报——数据被篡改或签名方非本人
//   D-11 双花战报（DOUBLE_REPORT）：同一 taskId 出现两份不同战报——拜占庭节点重复提交
//   D-12 拜占庭合谋（BYZANTINE_COLLUSION）：多验证者背书互相矛盾（部分签真部分签假且成组）
export function classifyByzantineDeath({ verifyFailures = [], duplicateTaskIds = [], endorsementVotes: endorsements = [] }) {
  const deaths = []
  for (const f of verifyFailures) deaths.push({ code: 'D-10', name: 'SIGNATURE_FORGERY', detail: `战报验签失败：${f}` })
  for (const d of duplicateTaskIds) deaths.push({ code: 'D-11', name: 'DOUBLE_REPORT', detail: `taskId 重复提交：${d}` })
  // 合谋检测：背书投票结果成组分裂（一部分全真一部分全假 = 节点间串通迹象）
  for (const e of endorsements) {
    if (e.yes > 0 && e.yes < e.total && new Set(e.votes).size <= 2) {
      deaths.push({ code: 'D-12', name: 'BYZANTINE_COLLUSION', detail: `背书分裂 ${e.yes}/${e.total}（成组投票=合谋迹象，跨机器确证需网络实测）` })
    }
  }
  return deaths
}
