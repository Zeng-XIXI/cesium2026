const deepSeekApiUrl =
  import.meta.env.VITE_DEEPSEEK_API_URL || "http://127.0.0.1:8000/chat";

function createLocalResponse(message, context) {
  const category = context.categories.find((item) =>
    message.includes(item.name),
  );

  if (/打开.*目标数据|打开.*数据列表/.test(message)) {
    return {
      reply: "已打开左侧目标数据列表。",
      actions: [{ type: "open-target-panel" }],
    };
  }

  if (/关闭.*目标数据|关闭.*数据列表/.test(message)) {
    return {
      reply: "已关闭左侧目标数据列表。",
      actions: [{ type: "close-target-panel" }],
    };
  }

  if (/清空|隐藏全部|取消全部|全部取消/.test(message)) {
    return {
      reply: "已清空地图上的全部目标。",
      actions: [{ type: "clear-all-targets" }],
    };
  }

  if (/显示全部目标|全部目标上图|全选所有目标/.test(message)) {
    return {
      reply: `已将全部 ${context.targetCount} 个目标显示到地图上。`,
      actions: [{ type: "select-all-targets" }],
    };
  }

  if (category && /取消|隐藏|移除/.test(message)) {
    return {
      reply: `已取消显示全部${category.name}。`,
      actions: [{ type: "deselect-category", categoryId: category.id }],
    };
  }

  if (category && /显示|上图|勾选|全选/.test(message)) {
    return {
      reply: `已将 ${category.count} 个${category.name}全部显示到地图上。`,
      actions: [{ type: "select-category", categoryId: category.id }],
    };
  }

  if (/多少|统计|状态|概况/.test(message)) {
    const categoryText = context.categories
      .map((item) => `${item.name}${item.count}个`)
      .join("、");
    return {
      reply: `当前共有 ${context.targetCount} 个目标，已上图 ${context.selectedCount} 个。分类包括：${categoryText}。`,
      actions: [],
    };
  }

  return {
    reply:
      "当前未配置外部大模型，我可以执行本地地图指令：打开或关闭目标数据、显示某一类目标、显示全部目标、清空地图，以及查询目标统计。",
    actions: [],
  };
}

export function askLocalAssistant(message, context) {
  return createLocalResponse(message, context);
}

function readSseData(block) {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
}

export async function streamDeepSeek(message, context, onProgress) {
  const response = await fetch(deepSeekApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: message,
      categories: context.categories,
      stage: context.stage || "answer",
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek 服务返回 HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("浏览器无法读取流式响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";
  const toolCalls = new Map();
  const actionTypeMap = {
    open_target_panel: "open-target-panel",
    close_target_panel: "close-target-panel",
    clear_all_targets: "clear-all-targets",
    select_all_targets: "select-all-targets",
    select_category: "select-category",
    deselect_category: "deselect-category",
  };

  function consumeBlock(block) {
    const data = readSseData(block);
    if (!data || data === "[DONE]") {
      return;
    }

    const json = JSON.parse(data);
    const delta = json.choices?.[0]?.delta;
    const content = delta?.content || "";
    if (content) {
      fullText += content;
      onProgress(fullText);
    }

    delta?.tool_calls?.forEach((toolCall) => {
      const index = toolCall.index ?? 0;
      const current = toolCalls.get(index) || {
        id: toolCall.id || `deepseek-tool-${index}`,
        name: "",
        arguments: "",
      };

      current.id = toolCall.id || current.id;
      current.name = toolCall.function?.name || current.name;
      current.arguments += toolCall.function?.arguments || "";
      toolCalls.set(index, current);
    });
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || "";
    chunks.forEach(consumeBlock);
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    consumeBlock(buffer);
  }

  const parsedToolCalls = [...toolCalls.values()].flatMap((toolCall) => {
    try {
      const argumentsValue = JSON.parse(toolCall.arguments || "{}");
      return [{ ...toolCall, arguments: argumentsValue }];
    } catch {
      return [];
    }
  });
  const actions = parsedToolCalls.flatMap((toolCall) => {
    const type = actionTypeMap[toolCall.name];
    return type ? [{ type, ...toolCall.arguments }] : [];
  });

  if (!fullText && !actions.length && !parsedToolCalls.length) {
    throw new Error("DeepSeek 没有返回文本内容");
  }

  return { reply: fullText, actions, toolCalls: parsedToolCalls };
}
