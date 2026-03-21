<template>
    <div class="mcp-ollama-container">
        <h2>🖥️ 本地 Ollama + MCP 自动工具调用</h2>

        <!-- 上下文 -->
        <div class="panel">
            <h3>📊 MCP 上下文（AI 可访问）</h3>
            <pre>{{ JSON.stringify(context, null, 2) }}</pre>
        </div>

        <!-- 工具列表 -->
        <div class="panel">
            <h3>🔧 MCP 工具</h3>
            <div v-for="tool in tools" :key="tool.name" class="tool">
                <b>{{ tool.name }}</b>：{{ tool.description }}
            </div>
        </div>

        <!-- 对话 -->
        <div class="chat-box">
            <h3>💬 对话区</h3>
            <div class="messages" ref="msgRef">
                <div v-for="(msg, i) in messages" :key="i" :class="['msg', msg.role]">
                    <div class="bubble">{{ msg.content }}</div>
                </div>
                <div v-if="loading" class="loading">AI 思考中...</div>
                <div v-if="toolRun" class="tool-run">✅ 正在调用 MCP 工具：{{ currentTool }}</div>
            </div>

            <div class="input-bar">
                <input
                    v-model="input"
                    placeholder="问我：用户信息？系统信息？刷新时间？"
                    @keydown.enter="send"
                />
                <button @click="send" :disabled="loading">发送</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, nextTick } from 'vue'

// ============== MCP 核心上下文 ==============
const context = reactive({
    userId: 'user_ollama_001',
    userName: '本地Ollama用户',
    timestamp: new Date().toISOString(),
    system: 'Vue3 MCP 本地客户端'
})

// ============== MCP 工具 ==============
type MCPTool = {
    name: string
    description: string
    execute: (ctx: any) => any
}

const tools = ref<MCPTool[]>([
    {
        name: 'getUserInfo',
        description: '获取当前登录用户信息',
        execute: (ctx) => ({
            userId: ctx.userId,
            userName: ctx.userName
        })
    },
    {
        name: 'getSystemInfo',
        description: '获取系统版本与当前时间',
        execute: (ctx) => ({
            system: ctx.system,
            time: ctx.timestamp
        })
    },
    {
        name: 'refreshTime',
        description: '刷新时间戳',
        execute: (ctx) => {
            ctx.timestamp = new Date().toISOString()
            return { newTime: ctx.timestamp }
        }
    }
])

// ============== 对话状态 ==============
const messages = ref([
    { role: 'assistant', content: '你好！我是本地 Ollama AI，已接入 MCP 工具～' }
])
const input = ref('')
const loading = ref(false)
const toolRun = ref(false)
const currentTool = ref('')
const msgRef = ref(null)

// ============== 对接本地 Ollama ==============
const OLLAMA_URL = 'http://localhost:11434/api/chat'
const MODEL_NAME = 'qwen3.5:latest' // 你本地的模型

// 发送对话
const send = async () => {
    if (!input.value) return
    const userMsg = input.value
    input.value = ''
    messages.value.push({ role: 'user', content: userMsg })
    loading.value = true

    try {
        await chatWithMCP(userMsg)
    } catch (e) {
        messages.value.push({ role: 'assistant', content: 'Ollama 连接失败，请确保本地已启动' })
    } finally {
        loading.value = false
        toolRun.value = false
    }
}

// 核心：AI + MCP 调用流程
const chatWithMCP = async (query: string) => {
    // 1. 构造提示词（告诉AI可用的MCP工具）
    const toolPrompt = `
你是一个可以调用 MCP 工具的智能助手。
可用工具：
${tools.value.map(t => `- ${t.name}：${t.description}`).join('\n')}

规则：
1. 如果需要用户信息、系统信息、时间，必须调用工具
2. 需要调用工具时，严格只返回 JSON，不要其他文字
3. 调用格式：{"tool":"工具名"}
4. 不需要工具就直接回答用户
  `.trim()

    // 2. 请求 Ollama
    const resp = await fetch(OLLAMA_URL, {
        method: 'POST',
        body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: toolPrompt },
                ...messages.value
            ],
            stream: false
        })
    })

    const data = await resp.json()
    let reply = data.message.content.trim()

    // 3. 判断是否调用 MCP 工具
    if (reply.startsWith('{') && reply.endsWith('}')) {
        const call = JSON.parse(reply)
        const tool = tools.value.find(t => t.name === call.tool)

        if (tool) {
            toolRun.value = true
            currentTool.value = tool.name

            // 执行 MCP 工具
            const toolRes = tool.execute(context)
            const toolInfo = JSON.stringify(toolRes, null, 2)

            // 把工具结果再发给 AI
            const finalResp = await fetch(OLLAMA_URL, {
                method: 'POST',
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: [
                        ...messages.value,
                        { role: 'system', content: `工具返回结果：${toolInfo}` }
                    ],
                    stream: false
                })
            })

            const finalData = await finalResp.json()
            reply = `✅ ${finalData.message.content.trim()}`
        }
    }

    messages.value.push({ role: 'assistant', content: reply })
    await nextTick()
    msgRef.value.scrollTop = msgRef.value.scrollHeight
}
</script>

<style scoped>
.mcp-ollama-container {
    max-width: 900px;
    margin: 2rem auto;
    padding: 2rem;
    font-family: system-ui, sans-serif;
}
.panel {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1rem;
}
pre {
    background: white;
    padding: 1rem;
    border-radius: 6px;
    max-height: 160px;
    overflow-y: auto;
}
.tool {
    background: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    margin-bottom: 0.4rem;
}
.chat-box {
    margin-top: 1rem;
}
.messages {
    height: 380px;
    background: white;
    border-radius: 10px;
    padding: 1rem;
    overflow-y: auto;
    margin-bottom: 1rem;
}
.msg {
    display: flex;
    margin-bottom: 0.8rem;
}
.msg.user {
    justify-content: flex-end;
}
.msg.assistant {
    justify-content: flex-start;
}
.bubble {
    max-width: 70%;
    padding: 0.7rem 1rem;
    border-radius: 12px;
    background: #e9f5ff;
}
.msg.user .bubble {
    background: #42b983;
    color: white;
}
.loading {
    color: #666;
    padding: 0.5rem;
    text-align: center;
}
.tool-run {
    color: #009e5f;
    padding: 0.5rem;
    text-align: center;
    font-weight: bold;
}
.input-bar {
    display: flex;
    gap: 0.5rem;
}
input {
    flex: 1;
    padding: 0.9rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
}
button {
    padding: 0.9rem 1.2rem;
    background: #42b983;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}
button:disabled {
    opacity: 0.6;
}
</style>