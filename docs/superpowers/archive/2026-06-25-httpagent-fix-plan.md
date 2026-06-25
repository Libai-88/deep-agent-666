# 协议对齐方案：LangGraphHttpAgent → HttpAgent

## 根因（一句话）

之前错误地把 `LangGraphHttpAgent` 当作通用后端连接器，但它内部用的是 `@langchain/langgraph-sdk`（LangGraph Platform API），和我们的 Python FastAPI 自定义端点根本不是同一种协议。

## 正确方案

官方文档 Quickstart 明确写了自托管后端的连接方式：

```typescript
// https://docs.copilotkit.ai/integrations/agent-spec/quickstart
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";     // ← 用这个，不是 LangGraphHttpAgent

const runtime = new CopilotRuntime({
  agents: {
    my_agent: new HttpAgent({ url: "http://localhost:8000/" }),
  }
});
```

`HttpAgent` 就是专为自托管后端设计的通用 HTTP AG-UI 客户端。它做的事情很简单：
1. `POST` 到 `{url}` 传 `RunAgentInput`
2. 设置 `Accept: text/event-stream`
3. 把 SSE 流包装成 Observable

而我们的 `add_langgraph_fastapi_endpoint` 正好接受 `POST {path}` + `RunAgentInput` + 返回 SSE 流。**天生一对。**

## 需要改什么

只有一处：`copilot-runtime.ts`，把 `LangGraphHttpAgent` 换成 `HttpAgent`。

| 当前 | 目标 |
|------|------|
| `import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph"` | `import { HttpAgent } from "@ag-ui/client"` |
| `new LangGraphHttpAgent({ url: ... })` | `new HttpAgent({ url: ... })` |

`buildRemoteAgentUrl` 生成的 URL 格式不变（`http://127.0.0.1:8123/openai-balanced`），`HttpAgent` 直接 POST 到这个地址。

## 验证方法

改完后重启前后端，发条消息看控制台还有没有 `INCOMPLETE_STREAM`。
