// dsh-megamesh/adapters/langgraph-adapter.mjs —— LangGraph.js 真库适配器（5 函数契约实现 + 优雅降级）
// 动态 import：发布包零硬依赖；框架未安装时 probe() 报告 installed:false，兵拒绝入网但不崩
// doWork 内部跑真实 LangGraph 图（gather_intel → judge → compose_report，Pregel 运行时执行节点）
import { ADAPTER_CONTRACT } from '../adapter-spec.mjs'

export async function probeLangGraph() {
  try {
    const lg = await import('@langchain/langgraph')
    let version = 'unknown'
    try {
      const pkg = await import('@langchain/langgraph/package.json', { with: { type: 'json' } })
      version = pkg.default?.version ?? 'unknown'
    } catch {}
    const has = (k) => typeof lg[k] !== 'undefined'
    return {
      installed: true, version,
      api: { StateGraph: has('StateGraph'), Annotation: has('Annotation'), START: has('START'), END: has('END') },
      contract: ADAPTER_CONTRACT.name,
    }
  } catch {
    return { installed: false, hint: 'npm i -D @langchain/langgraph @langchain/core' }
  }
}

// 侦察兵图：真实 LangGraph 状态图——节点干活、Pregel 调度、状态迁移（框架语言：graph/node/state）
export async function buildScoutGraph(log) {
  const { StateGraph, Annotation, START, END } = await import('@langchain/langgraph')
  const State = Annotation.Root({
    taskId: Annotation(),
    region: Annotation(),
    threat: Annotation(),
    severity: Annotation(),
    request: Annotation(),
    report: Annotation(),
  })
  const threats = ['魔教探子', '边关急报', '粮价飞涨', '瘟疫谣言', '盗匪出没', '灵石矿枯竭', '天象异常', '盐路被断', '流民聚集', '妖兽袭村']
  const regions = ['北境', '江南', '蜀中', '东海', '西域']
  return new StateGraph(State)
    .addNode('gather_intel', (s) => {
      const n = Number(s.taskId)
      return { region: regions[n % 5], threat: threats[n % 10], severity: 1 + (n * 7) % 100 }
    })
    .addNode('judge', (s) => ({ request: s.severity > 80 ? '建议增援' : '常规记录' }))
    .addNode('compose_report', (s) => ({
      report: {
        taskId: s.taskId,
        summary: `${s.region}发现${s.threat}，威胁度${s.severity}`,
        keyNumbers: { severity: s.severity, task: Number(s.taskId) },
        stateChanges: [{ field: 'threat', target: s.region, delta: s.severity, note: s.threat }],
        request: s.request,
      },
    }))
    .addEdge(START, 'gather_intel')
    .addEdge('gather_intel', 'judge')
    .addEdge('judge', 'compose_report')
    .addEdge('compose_report', END)
    .compile()
}
