from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel, Field
import os
import logging

# 在项目根目录运行：uvicorn main_SSE_DeepSeek:app --reload --port 8000

app = FastAPI()
# 允许前端跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPSEEK_KEY = os.getenv("Main_SSE_DeepSeek_API_KEY", "")

def build_tools(categories):
    category_ids = [category["id"] for category in categories]
    category_text = "、".join(
        f'{category["name"]}({category["id"]})' for category in categories
    )
    category_schema = {
        "type": "string",
        "description": f"目标类别 ID，可选类别：{category_text}",
    }
    if category_ids:
        category_schema["enum"] = category_ids

    def function_tool(name, description, parameters=None):
        return {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": parameters
                or {"type": "object", "properties": {}, "additionalProperties": False},
            },
        }

    return [
        function_tool("open_target_panel", "打开左侧目标数据列表"),
        function_tool("close_target_panel", "关闭左侧目标数据列表"),
        function_tool("clear_all_targets", "清空地图上当前显示的全部目标"),
        function_tool("select_all_targets", "显示全部目标"),
        function_tool(
            "select_category",
            "显示某个类别的全部目标",
            {
                "type": "object",
                "properties": {"categoryId": category_schema},
                "required": ["categoryId"],
                "additionalProperties": False,
            },
        ),
        function_tool(
            "deselect_category",
            "隐藏某个类别的全部目标",
            {
                "type": "object",
                "properties": {"categoryId": category_schema},
                "required": ["categoryId"],
                "additionalProperties": False,
            },
        ),
        function_tool(
            "query_targets",
            "确定需要查询的真实目标数据范围。目标数据已在前端，前端会根据参数筛选；不要生成或修改经纬度。",
            {
                "type": "object",
                "properties": {
                    "categoryId": {
                        "type": "string",
                        "description": f"可选目标类别 ID，可选类别：{category_text}",
                        **({"enum": category_ids} if category_ids else {}),
                    }
                },
                "additionalProperties": False,
            },
        ),
    ]


async def stream_llm(prompt: str, categories, stage: str = "answer"):
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_KEY}",
        "Content-Type": "application/json"
    }
    category_text = "、".join(
        f'{category["name"]}={category["id"]}' for category in categories
    )
    if stage == "analysis":
        system_prompt = (
            "你是 Cesium 地图助手。当前阶段只负责分析用户意图。"
            "需要查询真实目标数据时必须调用 query_targets；只执行地图操作时调用对应地图工具。"
            "目标数据已经保存在前端，禁止自行生成、补全或修改经纬度。"
        )
    elif stage == "summary":
        system_prompt = (
            "你是 Cesium 地图助手。当前阶段只根据程序提供的真实统计 JSON 生成简洁总结。"
            "禁止编造或修改统计结果，也不要调用工具。"
        )
    else:
        system_prompt = "你是 Cesium 地图助手。用户要求执行地图操作时必须调用工具。"

    body = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system",
                "content": f"{system_prompt}当前目标类别映射为：{category_text or '暂无类别'}。",
            },
            {"role": "user", "content": prompt},
        ],
        "stream": True,
    }
    if stage == "analysis":
        body["tools"] = build_tools(categories)
        body["tool_choice"] = "auto"
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, headers=headers, json=body) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_bytes():
                yield chunk


# 新增请求体模型
class ChatReq(BaseModel):
    prompt: str
    categories: list[dict] = Field(default_factory=list)
    stage: str = "answer"

# 放在模块顶部，初始化一次
logging.basicConfig(
    filename="chat_requests.log",
    encoding="utf-8",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = logging.getLogger(__name__)

@app.post("/chat")
async def chat(req: ChatReq):
    logger.info("收到 chat 请求：%s", req.model_dump_json())
    prompt = req.prompt
    return StreamingResponse(
        stream_llm(prompt, req.categories, req.stage),
        media_type="text/event-stream"
    )
