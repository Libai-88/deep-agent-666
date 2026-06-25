# Deep Agents 前端融合实施计划

> **目标：** 融合 **两个官方项目** 的最佳实践：
> - 取 `deep-agents-ui`（LangChain 官方）的 **UI 组件层**（shadcn 体系、ThreadList、ConfigDialog、TasksFilesSidebar）
> - 取 `examples/showcases/deep-agents`（CopilotKit 官方）的 **集成模式**（CopilotChat、useDefaultTool、Runtime 连接）
> - 替换当前 Codex 生成的自定义前端

> **官方参考源：**
> - `copilotkit-setup` skill — Runtime/Provider 标准配置
> - `copilotkit-develop` skill — CopilotChat/useAgent 使用规范
> - `runtime` skill (references/setup-endpoint.md) — Handler 挂载规范
> - `ui-ux-pro-max` skill — UI/UX 设计指导
> - CopilotKit docs (MCP) — CSS Customization / Slots / Headless UI

---

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                    RootLayout (layout.tsx)                    │
│  <NuqsAdapter> → <Toaster> → {children}                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                  CopilotKit Provider                         │
│  <CopilotKit runtimeUrl="/api/copilotkit"                    │
│             useSingleEndpoint={false}>                       │
│  (from @copilotkit/react-core/v2)                            │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                     HomePage (page.tsx)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                     Header                              │  │
│  │  [Logo/Title]  [Threads btn]  [Settings btn] [NewThread]│  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌───────────┬─────────────────────────┬──────────────────┐  │
│  │ ThreadList │     CopilotChat         │ TasksSidebar     │  │
│  │ (左侧面板)  │     (聊天主区)          │ (右侧面板)        │  │
│  │ Resizable  │  useDefaultTool 监听     │ 任务进度         │  │
│  │ localStorage│  工具调用 → 本地 state   │ 文件列表         │  │
│  └───────────┴─────────────────────────┴──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 任务清单

### Task 1: 安装新依赖

安装 `deep-agents-ui` 所需但当前项目缺少的包：

```bash
cd web
npm install \
  @radix-ui/react-dialog \
  @radix-ui/react-label \
  @radix-ui/react-scroll-area \
  @radix-ui/react-select \
  @radix-ui/react-slot \
  @radix-ui/react-switch \
  @radix-ui/react-tabs \
  @radix-ui/react-tooltip \
  lucide-react \
  nuqs \
  react-resizable-panels \
  react-markdown \
  remark-gfm \
  react-syntax-highlighter \
  @types/react-syntax-highlighter \
  class-variance-authority \
  clsx \
  tailwind-merge \
  sonner \
  date-fns \
  use-stick-to-bottom

npm install -D \
  @tailwindcss/typography \
  tailwindcss-animate
```

**官方依据：** `copilotkit-setup` skill → Step 1

---

### Task 2: 配置 Tailwind + 全局样式

#### 2a. 更新 `tailwind.config.ts`

添加 shadcn 所需的插件和配置：

```ts
// web/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
```

#### 2b. 替换 `globals.css`

用 `deep-agents-ui` 的 shadcn 变量体系替换当前的自定义 CSS，并覆盖 `[data-copilotkit]` 的 v2 设计 token。

**参考来源：**
- `deep-agents-ui/src/app/globals.css` — shadcn HSL 变量体系
- CopilotKit docs → CSS Customization → v2 Design Tokens

```css
/* web/src/app/globals.css — 核心结构 */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 346 100% 58%;     /* 品牌色 */
    --primary-foreground: 0 0% 100%;
    --border: 240 5.9% 90%;
    --radius: 0.625rem;
    /* ... 完整变量见 deep-agents-ui 的 globals.css */
  }

  .dark { /* 深色模式变量 */ }
}

/* CopilotKit v2 shadcn token 覆盖 */
[data-copilotkit] {
  --primary: oklch(0.55 0.22 264);
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --muted: oklch(0.97 0 0);
  --border: oklch(0.922 0 0);
  --radius: 0.625rem;
}
```

---

### Task 3: 添加 shadcn/ui 基础组件

从 `deep-agents-ui` 复制以下文件到 `web/src/components/ui/`：

```
web/src/components/ui/
├── button.tsx          ← Radix Slot + CVA, 5 variants
├── dialog.tsx          ← Radix Dialog + animations
├── input.tsx           ← styled native input
├── label.tsx           ← Radix Label
├── resizable.tsx       ← react-resizable-panels wrapper
├── scroll-area.tsx     ← Radix ScrollArea
├── select.tsx          ← Radix Select
├── skeleton.tsx        ← loading skeleton
├── switch.tsx          ← Radix Switch
├── tabs.tsx            ← Radix Tabs
├── textarea.tsx        ← styled native textarea
└── tooltip.tsx         ← Radix Tooltip
```

---

### Task 4: 重写主页面布局

用 `deep-agents-ui` 的 `page.tsx` 重新设计布局。

**布局结构：**
```
┌──────────────────────────────────────────────┐
│ Header (固定高度 64px)                        │
│  [Logo]  [Threads btn]  [Assistant ID]       │
│  [Settings btn]  [New Thread btn]            │
├──────┬───────────────────────────────────────┤
│Thread│           Chat Area                    │
│List  │  <CopilotChat>                         │
│(25%) │   messages + input                    │
│      │                                        │
│resiz-│                                        │
│able  │                                        │
└──────┴───────────────────────────────────────┘
```

**关键实现逻辑：**

```tsx
// page.tsx 核心
export default function HomePage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const [threadId, setThreadId] = useQueryState("threadId");
  const [sidebar, setSidebar] = useQueryState("sidebar");

  // 工具调用 → 本地 state（参考 CopilotKit deep-agents 示例）
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [files, setFiles] = useState<ResearchFile[]>([]);

  useDefaultTool({
    render: (props) => {
      const { name, status, args, result } = props;
      // 监听 write_todos / write_file 工具调用
      // 更新 todos/files state
      return <ToolCallCard {...props} />;
    },
  });

  return (
    <>
      <ConfigDialog ... />
      <div className="flex h-screen flex-col">
        <Header ... />
        <ResizablePanelGroup>
          {sidebar && <ResizablePanel><ThreadList ... /></ResizablePanel>}
          <ResizableHandle />
          <ResizablePanel>
            <CopilotChat
              labels={{
                welcomeMessageText: "Hi! How can I help you today?",
                chatInputPlaceholder: "Type a message...",
              }}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </>
  );
}
```

**官方依据：**
- `copilotkit-develop` skill → Workflow Step 3 → Add a Chat UI
- `CopilotChat` docs → labels / agentId props

---

### Task 5: ThreadList 组件

从 `deep-agents-ui` 复制 UI 结构，数据源改为 `thread-registry.ts`。

**核心差异：**

| deep-agents-ui (原始) | 本项目 (适配后) |
|----------------------|----------------|
| `@langchain/langgraph-sdk` useSWRInfinite | `localStorage` via `thread-registry.ts` |
| 按 `assistant_id` 过滤 | 不过滤（全部展示） |
| 时间分组 + 状态过滤 | 保留时间分组，去掉状态过滤 |
| 远程 mutate/delete | 本地 saveThreads/delete |
| 超时加载骨架屏 | 保留 skeleton 组件 |

**保留的特性：**
- 时间分组（today / yesterday / week / older）
- 线程项 UI（标题、描述、时间、状态点）
- 选中态高亮
- 关闭按钮

---

### Task 6: ConfigDialog 设置弹窗

从 `deep-agents-ui` 复制 `ConfigDialog.tsx`，字段改为当前项目的设置：

| 原始字段 | 替换为 |
|---------|--------|
| Deployment URL | 保留（可配置后端 URL） |
| Assistant ID | **预设选择（Preset selector）** |
| LangSmith API Key | 移除（不依赖 LangSmith） |

预设选择器使用 Radix Select，数据来自 `ALL_AGENT_PRESETS`。

---

### Task 7: 工具调用渲染

将 `deep-agents-ui` 的 `ToolCallBox.tsx` 样式和 `CopilotKit deep-agents` 的 `ToolCard.tsx` 逻辑合并。

**数据流：**
```
Agent 执行工具
  → CopilotKit send tool call event to frontend
  → useDefaultTool render callback fires
  → ToolCallCard (shadcn 样式) 显示工具状态
  → write_todos / write_file 时更新本地 state
  → TasksFilesSidebar 读取 state 渲染
```

---

### Task 8: layout.tsx 更新

```tsx
// web/src/app/layout.tsx
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { Providers } from "./providers";  // 保留现有 CopilotKit Provider
import "./globals.css";
import "@copilotkit/react-core/v2/styles.css";

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <NuqsAdapter>
          <Providers>
            {children}
          </Providers>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
```

---

## 文件变更总表

### 删除（6个）
```
REMOVE web/src/components/agent-workbench.tsx
REMOVE web/src/components/thread-sidebar.tsx
REMOVE web/src/components/settings-panel.tsx
REMOVE web/src/app/api/agent-presets/route.ts
REMOVE web/src/lib/runtime-state.ts
REMOVE web/src/app/page.tsx               ← 会重建
```

### 新增（15+个）
```
NEW  web/src/app/page.tsx                 ← 新布局
NEW  web/src/app/globals.css              ← shadcn 主题
NEW  web/src/app/layout.tsx               ← NuqsAdapter + Toaster
NEW  web/src/components/ui/button.tsx     ← shadcn 组件
NEW  web/src/components/ui/dialog.tsx
NEW  web/src/components/ui/input.tsx
NEW  web/src/components/ui/label.tsx
NEW  web/src/components/ui/resizable.tsx
NEW  web/src/components/ui/scroll-area.tsx
NEW  web/src/components/ui/select.tsx
NEW  web/src/components/ui/skeleton.tsx
NEW  web/src/components/ui/switch.tsx
NEW  web/src/components/ui/tabs.tsx
NEW  web/src/components/ui/textarea.tsx
NEW  web/src/components/ui/tooltip.tsx
NEW  web/src/components/ThreadList.tsx    ← 适配版
NEW  web/src/components/ConfigDialog.tsx   ← 适配版
NEW  web/src/components/TasksFilesSidebar.tsx
NEW  web/src/components/ChatMessage.tsx    ← shadcn 样式版
NEW  web/src/components/MarkdownContent.tsx
NEW  web/src/components/ToolCallCard.tsx   ← 合并版
NEW  web/src/components/FileViewDialog.tsx
NEW  web/src/hooks/useLocalThreads.ts     ← ThreadList 数据 hook
```

### 修改（2个）
```
MODIFY web/src/app/providers.tsx           ← 已修好，可能微调
MODIFY web/src/tailwind.config.ts          ← 添加 shadcn 配置
```

### 保留（6个）
```
KEEP  web/src/app/api/copilotkit/[...slug]/route.ts  ← 官方 Runtime
KEEP  web/src/lib/agent-presets.ts         ← 预置定义
KEEP  web/src/lib/copilot-runtime.ts       ← Runtime 工厂
KEEP  web/src/lib/thread-registry.ts       ← 线程存储
KEEP  web/src/lib/preset-catalog.ts        ← 预置目录
KEEP  web/src/components/interrupt-approval.tsx  ← HITL
```

---

## 执行状态

```
Task 1: 安装依赖 ───────────────→ ✅ 已完成
Task 2: Tailwind + globals.css ──→ ✅ 已完成
Task 3: shadcn UI 组件 ─────────→ ✅ 已完成（13个组件）
Task 4: 主页面布局 ─────────────→ ✅ 已完成（含 useRenderTool 监听）
Task 5: ThreadList ─────────────→ ✅ 已完成
Task 6: ConfigDialog ───────────→ ✅ 已完成（含 API Key 配置）
Task 7: 工具渲染合并 ───────────→ ✅ 已完成
Task 8: layout.tsx ─────────────→ ✅ 已完成
```

### 全部完成（8/8 Task）

```
NEW  web/src/components/MarkdownContent.tsx    ← Markdown 渲染
NEW  web/src/components/ToolCallCard.tsx       ← 工具卡片渲染
NEW  web/src/components/TasksFilesSidebar.tsx  ← 任务/文件面板
NEW  web/src/components/FileViewDialog.tsx     ← 文件查看弹窗
MOD  web/src/app/page.tsx                      ← useRenderTool 监听工具调用
```

### 清理
```
RM   web/src/components/interrupt-approval.tsx  ← 不再使用
RM   web/src/components/tool-call-renderers.tsx ← 被 ToolCallCard 替代
RM   web/src/components/__tests__/agent-workbench.test.tsx  ← 组件已删
MOD  web/src/lib/__tests__/copilot-runtime.test.ts  ← 移除已删模块的测试
```

### 改造新增（原计划外）
```
NEW  agent/app/main.py            ← POST /configure 端点
NEW  agent/app/config.py          ← ConfigStore 运行时配置
```

**验证清单：**
- [x] `npm run build` 无错误
- [x] `npm run test` 全部通过（15 passed）
- [x] `web/src/app/api/copilotkit/info` 返回 200（10 个 agent）
- [x] 页面加载无 404 错误
- [x] ThreadList 能正确显示/切换线程
- [x] CopilotChat 能正常收发消息
- [x] Settings 弹窗能切换模型预置 + 配置 API Key
- [x] useRenderTool 监听工具调用更新 state
- [x] TasksFilesSidebar 展示任务/文件
- [x] FileViewDialog 查看文件内容
