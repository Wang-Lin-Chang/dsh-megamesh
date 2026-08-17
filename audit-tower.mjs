// dsh-megamesh/audit-tower.mjs —— 审计塔模拟核心（E39 判定器，纯函数可导入）
// 命题（AIGS 自指方程映射）：𝓡²=𝓡+𝓘 的谱特征值 φ——审计塔逐层残余分歧率是否按 1/φ 衰减？
// 实验纪律：结构可验证（三级自指=审计塔三层），系数必须实测——不因数学美而免测
// 模型：每层审计器对每个缺陷独立检出概率 p（独立同分布假设）
//   残余率 r_n = (1-p)^n；衰减比 r_{n+1}/r_n = 1-p（恒定）
//   → φ 衰减（衰减比 1/φ≈0.618）⟺ 1-p = 1/φ ⟺ p = 1 - 1/φ = 1/φ² ≈ 0.382
//   → φ 衰减不是自指结构的必然性质，是"检出率恰为 38.2%"的等价条件（解析边界，可证伪）

export const PHI = (1 + Math.sqrt(5)) / 2
export const INVERSE_PHI = 1 / PHI            // ≈0.618
export const PHI_DETECTION = 1 / (PHI * PHI)  // ≈0.382——φ 衰减对应的检出率

// 确定性 RNG（D6 纪律：无种子 Math.random 的判决不可复现）
export function makeRng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
}

// 单层审计：缺陷集上以检出率 p 独立检出（真值缺陷集，p 固定）
export function auditLayer(defects, p, rng) {
  const detected = []
  const missed = []
  for (const d of defects) (rng() < p ? detected : missed).push(d)
  return { detected, missed }
}

// 审计塔三层模拟：每层独立同检出率 p，逐层残余率与衰减比
// 口径统一：r_n = 第 n 层漏报数 / 原始缺陷集（r_n = (1-p)^n）——跨层同分母才可比值
// 衰减比 r_{n+1}/r_n = 1-p（恒定）——φ 衰减 ⟺ 1-p = 1/φ ⟺ p = 1/φ²
export function auditTower(defects, p, rng) {
  const f1 = auditLayer(defects, p, rng)
  const f2 = auditLayer(f1.missed, p, rng)
  const f3 = auditLayer(f2.missed, p, rng)
  const n = defects.length
  const r1 = f1.missed.length / n
  const r2 = f2.missed.length / n
  const r3 = f3.missed.length / n
  const ratio21 = r1 > 0 ? r2 / r1 : null
  const ratio32 = r2 > 0 ? r3 / r2 : null
  return { layers: [f1, f2, f3], residuals: [r1, r2, r3], ratios: [ratio21, ratio32], finalMissed: f3.missed.length }
}

// 多轮统计：固定 p，多个种子跑塔，取衰减比均值（对照 1/φ 与解析值 1-p）
export function towerStatistics(defects, p, seeds) {
  const ratios = []
  const residuals = []
  for (const seed of seeds) {
    const t = auditTower(defects, p, makeRng(seed))
    residuals.push(t.residuals)
    if (t.ratios[0] !== null) ratios.push(t.ratios[0])
    if (t.ratios[1] !== null) ratios.push(t.ratios[1])
  }
  const mean = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1)
  return { meanRatio: mean, ratiosCount: ratios.length, analytical: 1 - p, phiMatch: Math.abs(mean - INVERSE_PHI) < 0.05 }
}
