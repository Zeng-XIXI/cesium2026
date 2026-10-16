import { useEffect, useRef, useState } from "react";
import MarkdownContent from "./MarkdownContent.jsx";

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "你好，我可以查询目标数据，也可以操作地图。\n\n试试输入：\n\n- `打开目标数据`\n- `显示全部机场`\n- `清空地图`",
  },
];

export default function AssistantPanel({ onClose, onSend }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState("local");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || sending) {
      return;
    }

    const timestamp = Date.now();
    const assistantMessageId = `assistant-${timestamp}`;
    setMessages((current) => [
      ...current,
      { id: `user-${timestamp}`, role: "user", content },
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    setInput("");
    setSending(true);

    function updateAssistantMessage(nextContent) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? { ...message, content: nextContent }
            : message,
        ),
      );
    }

    try {
      const reply = await onSend(content, mode, updateAssistantMessage);
      updateAssistantMessage(reply);
    } catch (error) {
      updateAssistantMessage(
        `**请求失败：** ${error.message}\n\n请确认 DeepSeek 后端已在 \`127.0.0.1:8000\` 启动。`,
      );
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <aside className="assistant-panel" aria-label="智能助手对话框">
      <header className="assistant-header">
        <div>
          <h1>智能助手</h1>
          <p>{mode === "deepseek" ? "DeepSeek 流式问答" : "本地控制模式"}</p>
        </div>
        <button
          className="panel-close-button"
          type="button"
          aria-label="关闭智能助手"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="assistant-mode-switch" aria-label="助手模式">
        <button
          className={mode === "local" ? "is-active" : ""}
          type="button"
          aria-pressed={mode === "local"}
          disabled={sending}
          onClick={() => setMode("local")}
        >
          本地控制
        </button>
        <button
          className={mode === "deepseek" ? "is-active" : ""}
          type="button"
          aria-pressed={mode === "deepseek"}
          disabled={sending}
          onClick={() => setMode("deepseek")}
        >
          DeepSeek
        </button>
      </div>

      <div className="assistant-messages" aria-live="polite">
        {messages.map((message) => (
          <div
            className={`chat-message chat-message-${message.role}`}
            key={message.id}
          >
            <span className="chat-role">
              {message.role === "assistant" ? "助手" : "你"}
            </span>
            {message.content ? (
              <MarkdownContent content={message.content} />
            ) : (
              <div className="chat-markdown typing-indicator">正在思考…</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="assistant-suggestions">
        <button type="button" onClick={() => sendMessage("打开目标数据")}>
          打开目标数据
        </button>
        <button type="button" onClick={() => sendMessage("显示全部机场")}>
          显示全部机场
        </button>
        <button type="button" onClick={() => sendMessage("当前有多少目标？")}>
          查询目标统计
        </button>
      </div>

      <form className="assistant-input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          rows="3"
          placeholder="输入问题或软件操作指令…"
          aria-label="向智能助手发送消息"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" disabled={!input.trim() || sending}>
          发送
        </button>
      </form>
    </aside>
  );
}
