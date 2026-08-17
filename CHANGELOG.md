# Changelog

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
