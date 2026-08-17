# dsh-megamesh

> 超级多 Agent 架构体系：**文件即消息，收养代替陪葬，任期代替单点，军法代替信任，时间线代替不可复现，人机共读代替人机界面。**
>
> A super multi-agent architecture: files are messages, adoption replaces all-hands-on-deck failure, term leases replace single points, invariants replace trust, timelines replace non-reproducibility, and one file serves both humans and machines.

[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![ci](https://github.com/Wang-Lin-Chang/dsh-megamesh/actions/workflows/ci.yml/badge.svg)](https://github.com/Wang-Lin-Chang/dsh-megamesh/actions/workflows/ci.yml)

**每个声称带实验编号**：`experiments/` 下 19 个实验装置（E01–E19），全部真进程实测，对照组说话。

## 实验编目 / Experiment index

| 编号 | 实验装置 | 内容 |
|---|---|---|
| E01 | mesh-experiment | 核心三实验：隔离 40/40 · 死循环判死 · 消息 10/10 vs RPC 0/10 |
| E02 | army-experiment | 一脑千军：压缩 98.8%，决策无损 |
| E03 | federation-experiment | 千脑联邦：杀主席换脑 1641 ms |
| E04 | tier-experiment | 分层战报：字段级展开 + δ 阈值效应 |
| E05 | law-experiment | 军法进化：假阳性 8→0，假阴性 2→0 |
| E06 | time-experiment | 时间战场：快照对账/平行宇宙/三向合并 |
| E07 | cross-experiment | 跨物种通信：人机共读双区校验 |
| E08 | fusion-experiment | 融合总验：统一入口 + 混沌自愈 |
| E09 | lifecycle-experiment | witness 五态 + EXIT 协议 |
| E10 | law-story-experiment | 叙事 14 类不变量并入军法（双引擎对照）|
| E11 | hetero-experiment | 异构混编军（模拟框架兵）|
| E12 | real-adapter-experiment | 真库适配：LangGraph v1.4.10 + CrewAI 1.15.16 |
| E13 | mesh-test | CI 核心断言（9 项）|
| E14 | forensic-sweep | 收养取证（sweep 时刻锁态）|
| E15 | preflight-experiment | 发布前总检（词检/依赖图/声称核对/清单）|
| E16 | shadow-experiment | 影子法庭：Wilson 转正判据 + promote/demote 闭环 |
| E17 | auto-publish-experiment | 自治发布判据：发布决策器影子转正 + 人工介入对照 |
| E18 | real-autopublish-experiment | 真实发布账本：判据吃真历史 + 预检单落地 |
| E19 | branch-search-experiment | 平行宇宙策略竞标：候选重演 Pareto 选优 |

## 一条命令起全军 / One command, one army

```bash
node hello-megamesh.mjs
```

30 侦察兵 + 3 联邦脑 + 90 任务 → 战报 → 军法 → 决策文书 → 人机共读战报 → 时间线快照 → 终态审计，一条命令检阅完毕。

## 三个困境，六个答案 / Three problems, six answers

| 主流多 Agent 困境 | 本项目的答案 | 实测（实验编号） |
|---|---|---|
| 大脑上下文爆炸（千军交全文，读入 O(千军×全文)）| 战报协议：小弟只交百字结构化战报，全文存档不上报 | 1838.5 KB → 22.6 KB，压缩 98.8%，决策无损（E02）|
| 细粒度信息按需获取 | 字段级展开：缺哪个字段补哪个，批量军令，digest 审计绑定 | 99.2% 削减，δ-gap 阈值效应，篡改即断裂（E04）|
| 脑进程单点，崩了全场停 | 千脑联邦：任期锁换脑，主席不是任命是抢来的 | 杀主席换脑 1641 ms，决策 90/90 零丢失（E03）|
| 崩溃/死循环传染 | 文件即消息 + O_EXCL 租约 + 三证据收养 + 死循环判死 | 隔离 40/40 · 磁盘消息 10/10 vs RPC 0/10（E01）|
| 规则腐烂、伪造战报 | 军法（规则是数据）+ 免疫系统（自动提取 + 纠错杀）| 假阳性 8→0，假阴性 2→0，3 条人类没写过的规则（E05）|
| 不可复现、不可审计 | 时间战场：checkpoint/branch/checkout/diff/merge | 重演 90/90 逐份一致，三向合并冲突留双档（E06）|

另：人机共读战报（Markdown 人读区 + JSON 机器区同一文件，双区矛盾必被抓，E07）· witness 五态生命周期 + EXIT 协议（E09）· 叙事域 14 类不变量并入同一法庭，一法通万物（E10）· 混沌引擎每日随机 kill 自己并自愈（杀兵 744 ms / 杀主席 1636 ms，E08）· 影子法庭（Wilson 统计转正判据 + promote/demote 可回退——自治军法的边界，E16）。

## 架构 / Architecture

```
battlefield/
├── intent-queue/          # 任务 = 文件（tmp+rename 原子发布）
│   ├── task-N.json
│   └── task-N.lock        # O_EXCL 租约锁（agentId:pid:startSec[:term]）
├── shared/
│   ├── reports/           # 百字战报流（脑进程唯一读入口）
│   ├── expand-reqs/       # 字段级展开军令（瞬态区，不入快照）
│   ├── expand-resps/      # 展开回执（瞬态区，不入快照）
│   ├── human/             # 人机共读战报（.md = 人读区 + JSON 区）
│   ├── consensus/
│   │   ├── term.lock      # 任期锁：心跳 touch，租约判死，O_EXCL 换脑
│   │   └── decrees/       # 决策文书 decree-<term>.json
│   ├── dead-letter/       # 崩溃现场（三证据收养）
│   ├── fulltext/          # 全文冷引用库（digest 寻址，跨宇宙可验证）
│   └── chaos/             # 混沌报告 + 历史账本
├── done/                  # 完成区（任务 + 结果成对 + EXIT 记录）
├── agents/                # 每个 Agent 的日志/全文档案/证据
└── timeline/              # 时间线快照（checkpoint/branch/diff/merge）
```

## 各大厂适配 / Framework adapters

5 函数契约（`adapter-spec.mjs`）：`claimTask`（O_EXCL 租约）/ `doWork` / `heartbeat` / `respondExpand` / `report`（战报必过军法）。**协议在文件系统层，与框架无关**——任何框架的 Agent 都只是协议的一个实现。

| 框架 | 状态 | 实测 |
|---|---|---|
| LangGraph.js | ✅ 真库实测 | v1.4.10 Pregel 图执行，10 真库兵 + 20 原生兵混编 90/90，框架兵阵亡收养照常（E12）|
| CrewAI | ✅ 真库实测 | 1.15.16 真库 crew kickoff（本地 mock LLM 当大脑），3/3 入网（E12）|
| AutoGen / OpenAI Agents SDK / MCP / Dify / Coze | ⏳ 同契约待实测 | 装库即入网，每适配一个跑标准实验套件全绿才算数 |

## 快速上手 / Quick start

```bash
node hello-megamesh.mjs                                # 一条命令起全军
node chaos-engine.mjs <ROOT>                           # 混沌演练：随机杀自己并自愈
node experiments/fusion-experiment.mjs                 # 融合总验（统一入口六实验）
```

## 诚实边界 / Honest boundaries

- **单机共享文件系统**：跨机器需共享磁盘 + 网络文件系统，未实测不声称。
- **at-least-once 派发**：崩溃窗口可能重复处理，幂等性由任务自身保证。
- **崩溃容错换脑 ≠ 拜占庭容错**：无签名、无 2/3 背书；拜占庭容错是下一个台阶，不冒认。
- **自动提取的军法规则是草案**：过画像集 + 留出集两道零误杀自检后仍需人工批准，自动提取不自动生效；影子法庭（`shadow-law.mjs`）提供统计转正路径——Wilson 判据达标自动转正，转正后误杀申诉即回退（promote/demote 闭环）。
- **快照覆盖账本层**：全文层通过 digest 冷引用主宇宙库；瞬态协议区（expand-*）不入快照，分支宇宙展开需重新请求。
- **侦察兵进程未升级 EXIT 写入**：统一入口 `finish` 必留 EXIT:0，侦察兵直连 mesh 的完成记录无 EXIT（已列为 TODO，不藏）。
- **CrewAI 实测的 LLM 是本地脚本化的**：crew 编排层（agents/tasks/context/串行 kickoff）真库真执行，LLM 大脑为脚本响应；接真实 LLM 端点未实测不声称。
- **LangGraph 实测版本 v1.4.10**：其他版本未实测不声称。
- **跨语言子进程协议**：stdio 不传数据（文件即消息），在管道受限环境同样成立。
- **实验平台**：真进程实验在 Windows 本机实测；发布前补三平台 CI（anchor 同款）跑核心断言。
- **管道输出的 exit code 假警报**：`process.exit(0)` 未冲刷 stdout 管道可能报 EPIPE，回归判定以直跑输出为准。

## 状态 / Status

总装中：七个方向已实测融合进同一架构（统一入口 `megamesh.mjs`），两个真库框架已入网。发布前完成：三平台 CI、协议文档对齐、词检清零。
