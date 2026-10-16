from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import os

# 在项目根目录运行：uvicorn demo.main_SSE_DeepSeek:app --reload --port 8000

app = FastAPI()
# 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPSEEK_KEY = os.getenv("DEEPSEEK_KEY", "")

async def stream_llm(prompt:str):
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_KEY}",
        "Content-Type": "application/json"
    }
    body = {
        "model":"deepseek-chat",
        "messages":[{"role":"user","content": prompt}],
        "stream": True
    }
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, headers=headers, json=body) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                yield chunk


# 新增请求体模型
class ChatReq(BaseModel):
    prompt: str

@app.post("/chat")
async def chat(req: ChatReq):
    prompt = req.prompt
    return StreamingResponse(
        stream_llm(prompt),
        media_type="text/event-stream"
    )
