# dsh-megamesh/adapters/mock-llm-server.py —— 本地 OpenAI 兼容 mock LLM 服务器（CrewAI 真库编排层的确定性大脑）
# 用途：让 CrewAI 的 crew 编排（agents/tasks/context/串行 kickoff）真执行，LLM 大脑由脚本响应（无 API Key）
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/models') or self.path == '/v1/models':
            body = json.dumps({"object": "list", "data": [{"id": "mock-model", "object": "model"}]}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if 'chat/completions' not in self.path:
            self.send_response(404)
            self.end_headers()
            return
        n = int(self.headers.get('Content-Length', 0))
        try:
            req = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            req = {}
        msgs = req.get('messages', [])
        prompt = ' '.join(str(m.get('content', '')) for m in msgs)
        if ('研判' in prompt) or ('决策' in prompt) or ('judge' in prompt):
            content = '结论：建议增援（威胁度100，蜀中盐路被断）。'
        else:
            content = '{"region":"蜀中","threat":"盐路被断","severity":100,"request":"建议增援"}'
        resp = {
            "id": "chatcmpl-mock", "object": "chat.completion", "created": 0, "model": "mock-model",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
        }
        body = json.dumps(resp).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

def run(port):
    srv = HTTPServer(('127.0.0.1', port), H)
    print(f'MOCK-LLM-READY {port}', flush=True)
    srv.serve_forever()

if __name__ == '__main__':
    run(int(sys.argv[1]))
