// dsh-megamesh/meta-audit.mjs —— 元审计判定核心（E36 的判定器，纯函数可导入）
// 质疑主流现状："审计器本身无人审计"——F_1 审计人写代码，F_1 的盲区由 F_2 交叉抓
// 双独立实现（不同算法路径，非同一代码跑两遍）：
//   实现 A（正则聚合）：词表 join 成一个 RegExp 单次 exec——快路径
//   实现 B（逐词扫描）：词表逐词 indexOf——独立路径，不共享正则引擎
//   实现 C（字节流）：按字节窗口扫描 UTF-8——第三路径，供 F_3 抽查 F_2
// 分歧账本：audit-divergence.jsonl（append-only，人类复核标记）

// 实现 A：逐词正则（每词独立正则——与 B 同语义契约：报所有词的所有出现；算法路径仍不同：正则引擎 vs indexOf）
export function scanA(text, words) {
  const hits = []
  for (const w of words) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    let m
    while ((m = re.exec(text)) !== null) hits.push({ word: w, at: m.index })
  }
  return hits.sort((a, b) => a.at - b.at)
}

// 实现 B：逐词 indexOf（独立算法路径——不共享正则引擎）
export function scanB(text, words) {
  const hits = []
  for (const w of words) {
    let at = text.indexOf(w)
    while (at !== -1) { hits.push({ word: w, at }); at = text.indexOf(w, at + w.length) }
  }
  return hits.sort((a, b) => a.at - b.at)
}

// 实现 C：字节流窗口（第三路径——独立于 JS 字符串语义）
export function scanC(text, words) {
  const buf = Buffer.from(text, 'utf-8')
  const hits = []
  for (const w of words) {
    const wb = Buffer.from(w, 'utf-8')
    for (let i = 0; i + wb.length <= buf.length; i++) {
      if (buf.subarray(i, i + wb.length).equals(wb)) hits.push({ word: w, at: buf.subarray(0, i).toString('utf-8').length })
    }
  }
  return hits.sort((a, b) => a.at - b.at)
}

// 一致性判定：两实现命中集必须一致（词+位置）——分歧 = 至少一个实现有 bug 或盲区
export function crossCheck(hitsX, hitsY) {
  const norm = (hs) => JSON.stringify(hs.map(h => `${h.word}@${h.at}`).sort())
  return { consistent: norm(hitsX) === norm(hitsY), x: hitsX.length, y: hitsY.length }
}

// 元审计器：F_2 独立重扫 F_1 的审计对象，核对 F_1 的结论（audit 结果的分歧账本化）
// F_1 结论 = { file, hits }；F_2 用不同实现重扫 → 分歧进账本
export function metaAudit(f1Results, files, words, scanImpl = scanB) {
  const divergences = []
  const f1ByFile = new Map(f1Results.map(r => [r.file, r.hits]))
  for (const [file, text] of Object.entries(files)) {
    const f1Hits = f1ByFile.get(file) ?? []
    const f2Hits = scanImpl(text, words)
    const cc = crossCheck(f1Hits, f2Hits)
    if (!cc.consistent) {
      divergences.push({ file, f1: f1Hits.length, f2: f2Hits.length, f1Only: f1Hits.filter(h => !f2Hits.some(g => g.word === h.word && g.at === h.at)), f2Only: f2Hits.filter(h => !f1Hits.some(g => g.word === h.word && g.at === h.at)) })
    }
  }
  return divergences
}
