# -*- coding: utf-8 -*-
"""本地 OpenAI 兼容 mock 服务，用于验证前端的 AI 分析链路（不消耗真实额度）。"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "authorization,content-type")
        self.send_header("Access-Control-Allow-Methods", "POST,GET,OPTIONS")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length) or b"{}")
        if "json" not in json.dumps(body, ensure_ascii=False).lower() and "回复" not in json.dumps(body, ensure_ascii=False):
            content = "可用"
        else:
            content = json.dumps({
                "errorType": "语境理解偏差",
                "diagnosis": "你把注意力放在了选项本身的通顺程度上，没有回到题干对「沙丘向西迁移」这一结论的限定。正确答案所在的④处前后正是观点与原因的衔接点。",
                "trap": "①处和②处读起来也很顺，因为它们是介绍性内容，和题干没有语义冲突，但与设问要求的「填入位置」不匹配。",
                "knowledge": ["语句衔接", "话题一致", "观点与论据"],
                "method": ["先看空格前后的指代词与结论句", "用题干关键词回文定位", "代入后检查前后句子是否连贯"],
                "reminder": "先找题干关键词在原文的落点。",
            }, ensure_ascii=False)
        data = {
            "id": "mock-1",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 100},
        }
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("mock llm on http://127.0.0.1:8899/v1")
    HTTPServer(("127.0.0.1", 8899), Handler).serve_forever()
