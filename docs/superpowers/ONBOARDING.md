# Deep Agent 666 — 新人上手指南

> 预计阅读时间：30 分钟

---

## 环境要求

| 工具 | 版本 | 验证命令 |
|------|------|---------|
| Python | 3.11+ | `python --version` |
| Node.js | 20+ | `node --version` |
| uv | 0.6+ | `uv --version` |
| Git | 2.40+ | `git --version` |

## 30 分钟上手流程

### 第 1 步：克隆并安装依赖（5 分钟）

```bash
# 进入工作区
cd D:\AgentBuild\.worktrees\deepagents-foundation

# 安装 Python 依赖
uv sync --project agent

# 安装前端依赖
cd web && npm install && cd ..
```

### 第 2 步：环境变量（2 分钟）

```bash
cp agent/.env.example agent/.env
```

编辑 `agent/.env`，填入必要的 API Key：
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...  # 可选
GOOGLE_API_KEY=...        # 可选
```

### 第 3 步：启动后端（3 分钟）

```bash
uv run --project agent uvicorn app.main:app --host 0.0.0.0 --port 8123
```

验证：
```bash
curl http://127.0.0.1:8123/health
# {"status":"ok","preset_count":5,...}
```

### 第 4 步：启动前端（3 分钟）

新开一个终端：

```bash
cd D:\AgentBuild\.worktrees\deepagents-foundation\web
npx next dev -p 3000
```

验证：
```bash
curl http://localhost:3000/api/copilotkit
# {"agents":{"openai-read-only":{...},"default":{...},...},...}
```

### 第 5 步：跑测试（2 分钟）

```bash
# 后端测试
uv run --project agent pytest

# 前端测试
cd web && npx vitest run

# 检查构建
npx next build
```

### 第 6 步：打开浏览器（1 分钟）

访问 http://localhost:3000

- 页面应正常加载，无控制台报错
- 左侧侧边栏显示线程列表
- 右上角有主题切换和设置按钮

### 第 7 步：了解项目结构（10 分钟）

```
agent/                         ← Python 后端
├── app/
│   ├── main.py                ← FastAPI 入口 + 端点注册
│   ├── agent_factory.py       ← V1 单 agent + V2 coordinator 构建
│   ├── state.py              ← V2AgentState 定义
│   ├── config.py             ← 配置管理
│   ├── permissions.py        ← 权限模型
│   ├── presets.py            ← Agent preset 定义
│   ├── tools/workspace.py    ← 工作区工具集
│   └── middleware/genui.py   ← GenUI 中间件
├── tests/
│   ├── test_agent_factory.py
│   ├── test_v2_*.py
│   └── test_workspace_tools.py
└── pyproject.toml

web/                           ← Next.js 前端
├── src/
│   ├── app/
│   │   ├── page.tsx           ← 主页面
│   │   ├── providers.tsx      ← CopilotKit Provider
│   │   └── api/copilotkit/[[...slug]]/route.ts  ← Runtime 路由
│   ├── components/
│   │   ├── SubAgentProgress.tsx
│   │   ├── DiffViewer.tsx
│   │   ├── FileBrowser.tsx
│   │   └── ThreadList.tsx
│   └── lib/
│       ├── copilot-runtime.ts  ← Runtime 构建
│       └── agent-presets.ts   ← Agent preset 目录
└── package.json

docs/superpowers/
├── SPEC.md                  ← 架构规格
├── STATUS.md                ← 当前状态 + 技术债
├── PLAN.md                  ← 开发方案
├── ONBOARDING.md            ← 本文件
└── ADR/                     ← 架构决策记录
```

## 常见问题

### Q: 端口被占用

```bash
# 查找并杀掉占用进程
netstat -ano | findstr ":3000"
taskkill -f -pid <PID>
```

### Q: 后端启动报错

检查 `.env` 中的 API Key 是否配置正确。

### Q: 前端加载报错 "Agent 'default' not found"

确保后端正在运行，并且 `curl /api/copilotkit` 返回的 agents 中包含 `"default"`。

### Q: 测试失败

先确认后端在运行：
```bash
curl http://127.0.0.1:8123/health
```

然后重跑测试。
