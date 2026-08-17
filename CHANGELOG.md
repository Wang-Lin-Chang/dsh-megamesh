# Changelog

## [0.20.0] - 2026-08-17

### Added

- 拜占庭签名验证（E38，预言二本机可实测部分）：Ed25519 签名/验签（篡改/伪造/错误公钥全拦截）、2/3 背书严格 quorum（N=5 需 4 票）、D-10~D-12 死因分类器（签名伪造/双花战报/拜占庭合谋）、对照组量化无签名现状对篡改零感知。
- byzantine-spec.md（拜占庭协议规范 v0.1）：签名+背书+死因代码规范；跨机器合谋/网络分区/加权系数校准标注"待社区实测"（不冒认）。
- federation-spec.md（跨机器联邦规范 v0.1）：CRDT 战场图 + Raft 任期锁映射 + 战报带宽协议草案；全部跨机器内容标注未实测。
- autopsy-spec v0.2.0：D-10~D-12 拜占庭死因代码（语义来源 E38，跨机器确证标注待实测）。

## [0.19.0] - 2026-08-17

### Added

- 框架自动适配进化器（E37，预言三落地）：质疑"每个框架雇一个人手写 adapter"的主流现状——adapter-evolver 自动扫描框架 npm 包（package.json 入口 + 动态 import 导出面）→ 元契约 PRIMITIVE_MAP（框架自述语言 → 协议语言）识别等价原语 → 生成 5 函数契约骨架（识别接线 + 未识别诚实标记"待人工确认"，不冒充可执行）→ 影子法庭 Wilson 转正判据复用（20 次影子运行零误杀才转正，E16/E17 判据）。E12 真库数据喂料：LangGraph 扫描 94 导出识别 Graph/StateGraph 原语，CrewAI 未安装诚实降级报告。

## [0.18.0] - 2026-08-17

### Added

- 元审计军（E36，预言五落地）：质疑"审计器本身无人审计"的主流现状——三独立实现（逐词正则/逐词 indexOf/字节流窗口）交叉审计；盲区注入实测（F_1 漏配扩展名 → F_2 独立实现抓到 → 分歧进 append-only 账本 + humanReview 标记）；对照组量化单审计器漏报 = 盲区大小；F_3 抽查 F_2 递归两层。审计军词检关接 F_2 独立实现交叉（零命中时逐词扫描抽查——审计器盲区由第二实现抓）。哥德尔残余 = 账本里的 humanReview 标记（写分歧，不写公式）。

### Fixed

- 装置事实：正则聚合（join('|')）与逐词扫描在重叠词（前缀/子串词）时语义分歧——单测抓出后统一为逐词语义契约（三实现算法路径不同、语义契约一致）。

## [0.17.0] - 2026-08-17

### Added

- 叙事-对话融合引擎（E35，预言四落地）：dsh-anchor 锚点对账 × dsh-story 14 不变量 = 长程对话因果一致性——20 回合对话锚点链跑偏当场 DIVERGED + 叙事修复 rewind 生效；3 类叙事违规 100% 召回 + 干净账本零误杀；对照组量化"无锚点对话对跑偏零感知"（主流现状）；对话战报压缩 95%（侦察兵交百字摘要不交全文）。跨仓库真进程实测（本地两仓库源码 import，CI 无外部仓库故不入回归军清单——诚实标注）。

## [0.16.0] - 2026-08-17

### Added

- α 账本滑动更新（E33）：第三轮实测 α₃=0.076——α 随负载漂移被证实（三轮 0.081→0.045→0.076）；账本化（penalty-history.jsonl）+ 三策略留一验证（固定/滑动/EMA）——N=3 判别力不足，固定与滑动并列，策略如实标注 indeterminate，生产取最近一轮实测（不冻结、不冒充定论）。
- D3 空 catch 复核（E34）：程序化分类器把 20 处空 catch 拆成 9 豁免 + 11 债——债全部改记日志（吞错显性化），豁免注释标记；债单 D3 从 18 处待复核变 0 处（全部定性）。

### Fixed

- 装置事实反打："污染轮 α₁=0.081"标签被第三轮实测质疑（α₃=0.076 接近 α₁）——α₁ 更可能是当时真实负载；标签与数据分开存，历史定性可纠正。
- D6 确定性债清零：branch-search 无种子 Math.random 改种子定序（判决可复现）。

## [0.15.0] - 2026-08-17

### Added

- 超时惩罚建模（E31）：超时率 vs 兵数真实采集（含 22 兵全并行档）——本次实测 0% 超时率，诚实结论：E25 首跑 776s 拖垮是当时负载+未修 bug 的产物，非兵数确定性函数。风险项机制就绪（riskAware = penalizedMakespan × (1+γ·r(N))，γ 由最坏档实测锚定），当前 γ=0（选快=选稳），拖垮数据再现时自动激活。
- 质证复核轮（E32）：否决后重采样再投票，两次一致才定案——噪声被复核翻转（EXP-2 实测）、稳定假阳性两次一致定案（EXP-3 实测）、正常决策零开销（EXP-4）。reviewCourt 提升为生产函数，联邦脑接复核轮（REVIEW_GAP_MS 重采样窗口）。
- D7 覆盖债清偿：penalty-scheduler/crosscheck 补直接单测（MAD 样本同值分支死代码 bug 被新单测抓出修复）。

### Fixed

- crosscheckOutlier：`mad || 1` 使 MAD=0 分支不可达（单测抓出）——全体一致样本不靠统计误拦，交复核轮。

## [0.14.0] - 2026-08-17

### Added

- 调度器接管回归军（E29）：penalty-scheduler 读账本拟合 α 定 N，`regression-army --auto` 成为生产路径——三档真实跑对照（α 调度 N=2 145.3s vs 竞标 N=3 146.9s vs 固定 N=3 146.3s）全绿，N 由数据唯一定出。
- 发布双军联动（E30）：审计军复核轮——失败项由不同侦察兵独立重查，偶发失败翻转（陷阱实测）、真债双败定案（禁词注入实测）；发布 = deploy-army（本仓库三关）+ audit-army（12 仓库四关）双军背书，单军对照量化。
- 审计域质证语义：战报补 keyNumbers.severity（失败=90），MAD 样本同值时离群质证不误拦（交复核轮）。

### Fixed

- E26/E27/E28/E29/E30 驱动器递归防护（EXPERIMENTS 排除清单扩展至 5 项）。
- crosscheckOutlier 样本同值（MAD=0）时离群检测无统计基线——不再误拦，移交复核轮。

## [0.13.0] - 2026-08-17

### Added

- 并行惩罚感知调度（E26）：惩罚系数 α 由 6 档兵数真实采集拟合（中位数，非拍脑袋）——老模型 N=2..8 makespan 全部平局（对并行惩罚零感知的盲区实测），新模型惩罚项让代价单调可见、选择唯一有据。
- 审计军（audit-army + audit-scout，E27）：多 Agent 并行跨仓库体检（12 仓库 × 4 关 = 48 任务），接替手写串行审计——上岗即拦截真实信号（CI 红 + 推送后本地再改的漂移）+ 埋雷真拦截验证。
- 联邦脑多方质证（crosscheck-brain，E28）：chair 提议（max severity）+ 自洽/离群双质证独立表决——取最优模式两次被假阳性劫持，质证全部拦截；真阳性不被误杀（MAD 稳健检测受控）。vetoed/contested-high-risk 时 decree 不放行，分歧记录落盘。

### Fixed

- 联邦脑质证升级后 schema 兼容回归：部署域战报无 keyNumbers 时质证跳过矛盾/离群检查，全票放行。
- 审计军口径修正：词检/漂移跳过运行时账本目录（shared）；npm scoped 包名映射（dsh-story/schedule-core 查 scoped 包）；平台后端库无 npm 包 = 设计事实不误报。

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
