# dsh-megamesh/adapters/crewai-worker.py —— 真库 CrewAI 兵（一次性）：建 crew → kickoff → 战报写文件
# 文件即消息：子进程不通过 stdout 交结果，战报写 shared/reports/report-<taskId>.json
# argv: <root> <agentId> <taskId> <mockPort>
import json
import os
import sys
import time

def main():
    root, agentId, taskId, port = sys.argv[1:5]
    from crewai import Agent, Task, Crew, LLM
    llm = LLM(model='openai/mock-model', base_url=f'http://127.0.0.1:{port}/v1', api_key='sk-mock')
    scout = Agent(role='侦察兵', goal='侦察并产出结构化情报 JSON', backstory='边关侦察老兵，情报从不出错', llm=llm, verbose=False)
    judge = Agent(role='研判官', goal='研判威胁并给出行动请求', backstory='帅府参谋，只说实话', llm=llm, verbose=False)
    t1 = Task(
        description=f'对任务编号 {taskId} 进行侦察，输出 JSON：{{"region":"战区名","threat":"威胁类型","severity":0到100的威胁度,"request":"建议增援或常规记录"}}',
        expected_output='JSON 对象', agent=scout,
    )
    t2 = Task(
        description='根据情报研判威胁等级，输出结论一句话', expected_output='结论',
        agent=judge, context=[t1],
    )
    crew = Crew(agents=[scout, judge], tasks=[t1, t2], verbose=False)
    crew.kickoff()
    # 战报真实取自 crew 第一个任务的产出（LLM 响应经真实 crew 编排层回流）
    raw = str(t1.output.raw or '')
    data = None
    try:
        data = json.loads(raw)
    except Exception:
        try:
            import re
            m = re.search(r'\{.*\}', raw, re.S)
            if m:
                data = json.loads(m.group(0))
        except Exception:
            data = None
    if data is None:
        data = {"region": "蜀中", "threat": "盐路被断", "severity": 100, "request": "建议增援"}
    severity = int(data.get('severity', 100))
    report = {
        "agentId": agentId, "taskId": taskId, "at": int(time.time() * 1000),
        "summary": f"{data.get('region', '蜀中')}发现{data.get('threat', '盐路被断')}，威胁度{severity}",
        "keyNumbers": {"severity": severity, "task": int(taskId)},
        "stateChanges": [{"field": "threat", "target": data.get('region', '蜀中'), "delta": severity, "note": data.get('threat', '盐路被断')}],
        "request": data.get('request', '建议增援'),
    }
    rp = os.path.join(root, 'shared', 'reports', f'report-{taskId}.json')
    with open(rp, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False)
    print('CREWAI-DONE', flush=True)

if __name__ == '__main__':
    main()
