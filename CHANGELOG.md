# Changelog

## [0.12.1] - 2026-08-17

### Fixed

- 词检数据源随仓库与随包：lab/bad-words.json 从未进 GitHub 仓库（push 脚本排除 lab 目录）与 npm 包（files 白名单缺它），CI 三平台全红（ENOENT）而本地绿——被"本地有 lab"掩盖的发布债。修复：push 只收 lab/bad-words.json（lab 内部叙事文档仍不公开）+ npm files 加 lab/bad-words.json。
- v0.12.0 宣传帖"CI 三平台绿"声明错误（发帖时 CI 实为红）——0.12.1 修复后另行发纠错帖。

## [0.12.0] - 2026-08-17

### Added

- 回归军（regression-army + regression-scout）：22 个实验装置的回归跑由侦察兵分片执行 + 联邦脑决策，真实耗时账本落盘（shared/consensus/regression-times.json）。
- regression-army-experiment（E25）：平行宇宙竞标/进化接管真实分兵参数——竞标用真实耗时重演 makespan 定分兵，进化全域探索暴露纯 makespan 模型盲区（无并行惩罚项 → 盲目收敛全并行）。

### Fixed

- mesh-core 收养判定跨来源时间比对 ±1s 容差：powershell [int] 四舍五入 vs JS floor 在进程启动于 x.7 秒时差 1 → 活进程被误判 PID 复用 → mesh-test 间歇红（回归军 N=2 实跑暴露）。
- real-deploy-experiment（E22）EXP-3 块级 ReferenceError（scan 未定义）——回归军首跑暴露，修复为块内重算 scanCriteria(expLedger)。
- 并行惩罚装置防护：22 兵全并行实测拖垮重装置（time/tier 超时），分兵可行域由实测约束定出；回归结果取证落盘 last-regression-run.json（无 pipe 环境）。

## [0.11.0] - 2026-08-17

### Added

- 部署军（deploy-army + deploy-scout）：发布三关由 3 侦察兵并行执行 + 联邦脑决策——多 Agent 系统服役于真实发布流程。
- deploy-army-experiment（E24）：并行 vs 单进程对照（结果一致 + 耗时量化）。

### Fixed

- 联邦脑 schema 兼容：无 keyNumbers 的部署域战报不再崩脑（undefined.severity 被空 catch 吞导致主循环死亡的回归修复）。
- 测试关重试：Windows Node 25.8.1 test runner 偶发 libuv 崩溃的装置防护。
- 锁 startSec 语义修正（15 处 claim/tryClaim）：锁记录的 startSec 必须是进程启动秒而非 claim 时刻——D5 三证据修复后暴露的语义错误，此前被 procStartSec 失效掩盖。

## [0.10.0] - 2026-08-17

### Fixed

- D5 平台债（技术债审计 HIGH）：procStartSec 跨平台化——ESM import（修复 require 失效导致全平台 startSec 证据失效）+ linux/darwin ps 分支（修复非 Windows 三证据退化）。
- D9 瞬态区累积债：megamesh.transientGC(maxAgeMs) 清理超龄 expand 文件。
- D3 静默吞错债（关键路径）：mesh-core release/sweep/dead-letter 的 catch 记入事件日志（agents/mesh-events.jsonl）。

### Added

- 技术债审计（tech-debt-audit，E23）：10 项债程序化债单（DRY/魔法数/静默吞错/忙等/平台/确定性/覆盖/版本/瞬态/双账本），每项带证据。
- 债单台账 lab/TECH-DEBT.md（复核清单 + 修复记录）。

## [0.9.0] - 2026-08-17

### Added

- 每日巡航（daily-cruise）：部署单自动跑 + 绿灯预检入账——自治运营的自动驾驶（发布仍由人批准）。
- publish-deploy 重构为可复用模块（runDeploy 导出，CLI 与巡航共用）。

## [0.8.0] - 2026-08-17

### Added

- 发布部署单（publish-deploy）：预检三关 + 账本资格 + 判据参数扫描（真实历史滚动重演选出最优 nMin/ε）——绿灯一键放行、黄灯人工复核、红灯 hold。
- real-deploy-experiment（E22）：五实验（预检入账 / 判据扫描 / 默认对照 / 真实部署单 / 事故演练）。

## [0.7.0] - 2026-08-17

### Added

- 策略执政官（strategy-governor）：进化创新 + 影子把关 + 转正/降级/回退（三权分立）；v2 转正判据加成本维度。
- unified-autonomy-experiment（E21）：五实验（进化产出 / 影子转正 / 上岗服务 / 事故回退 / 判据自进化）。

## [0.6.0] - 2026-08-17

### Added

- 策略进化器（strategy-evolver）：竞标 + 变异繁殖 + 精英保留 + 早停——策略池自己长出最优策略。
- evolution-experiment（E20）：五实验（世代演化 / 留出批对照 / 假阳性排除 / 早停 / 可复现）。

## [0.5.0] - 2026-08-17

### Added

- 平行宇宙策略竞标（strategy-selector）：候选决策策略池（gap/topk × 10）+ 重演度量 + Pareto 选优——大脑的军令参数不再人挑。
- branch-search-experiment（E19）：四实验（候选竞标 / 留出批对照 / 真分支宇宙交叉验证 / 门槛扫描）。

## [0.4.0] - 2026-08-17

### Added

- 发布账本（publish-ledger）：append-only 真实发布史 + Wilson 自治资格判据（可预见事故率 vs 不可预见事故的诚实区分）。
- 发布预检单（publish-preflight）：词检/测试/总检三关 + 账本资格——每次发布的第一道程序化关口。
- real-autopublish-experiment（E18）：判据吃 20 条真实发布史（含 1 条真实事故），预检单实测落地。
- 正式发布账本 seed：20 条真实发布记录（含 dsh-mesh v0.3.0 事故如实入账）。

## [0.3.0] - 2026-08-17

### Added

- 自治发布判据（auto-publish）：发布决策器 + 影子转正（复用影子法庭 Wilson 判据）——发布流水线的自治边界。
- auto-publish-experiment（E17）：五实验（影子零干预 / nMin 转正曲线 / 人工介入对照 / 事故闭环 / 终态账本）。

## [0.2.0] - 2026-08-17

### Added

- 影子法庭（shadow-law）：候选规则影子运行（只记录不拦截）+ Wilson 统计转正判据 + promote/demote 可回退闭环——自治军法的边界。
- shadow-experiment（E16）：五实验（影子零干预 / Wilson 判据扫描 / 固定影子期对照 / promote-demote 闭环 / 坏规则安全阀）。
- megamesh 统一入口挂载 shadowCourt()。

## [0.1.0] - 2026-08-17

### Added

- 统一入口 megamesh：战场（任务/租约/收养）+ 战报 + 军法 + 任期 + 时间线 + 人机共读 + 混沌，一栈式。
- 七个实测模块融合：mesh-core / war-law（+ 提取器）/ federal-brain / brain-tier / scout-worker（+ tier 版）/ time-machine / clerk-worker。
- 全文冷引用（digest 寻址 + 主宇宙回源）与瞬态协议区快照排除。
- witness 生命周期对接（五态 + EXIT 协议）；叙事 14 类不变量 kind 化并入军法（一法通万物）。
- 各大厂适配：5 函数契约 + LangGraph.js v1.4.10 真库实测 + CrewAI 1.15.16 真库实测（本地 mock LLM）。
- 15 个实验装置（E01–E15，含发布前总检 preflight）；hello-megamesh 一条命令起全军。
- 模块级单测（node --test，28 断言覆盖 6 模块）。
- 三平台 CI（windows/macos/ubuntu）。

### Fixed

- sweep 假阳性诊断链：release 5 次忙等重试 + "任务已完成的锁残留"分类 + TOCTOU 跳过（v0.3.0 发布前的自检发现，已同步 dsh-mesh v0.3.1）。
- time-machine 瞬态区排除的路径分隔符归一化（Windows 反斜杠 vs 比较用正斜杠——单测抓出）。
