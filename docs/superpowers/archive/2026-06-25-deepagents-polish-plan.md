# Deep Agents 前端精修计划

> **目标：** 在现有融合前端基础上，补齐视觉品质、交互体验、HITL 集成和深色模式，达到"好用"级别。

> **官方参考源：**
> - `impeccable` skill — 色彩系统（`color-and-contrast.md`）、空间设计（`spatial-design.md`）、动效设计（`motion-design.md`）
> - `frontend-design` skill — 美学方向选择
> - `copilotkit-develop` skill → `useInterrupt` / `useHumanInTheLoop` — HITL 集成
> - `copilotkit-develop` skill → `CopilotChat` labels / slots — UI 定制
> - CopilotKit CSS Customization 文档 → v2 shadcn token 覆盖 / `.copilotKit*` class
> - Maxma 品牌设计规范 → `docs/superpowers/specs/2026-06-24-maxma-branding-design.md`

---

## 当前问题清单

| 问题 | 严重度 | 官方依据 |
|------|--------|---------|
| 颜色用默认 shadcn 值，无品牌感 | 🔴 视觉 | `impeccable` → 色彩系统 |
| 面板切换无动画/过渡 | 🟡 体验 | `impeccable` → motion-design |
| ThreadList 无骨架屏加载态 | 🟡 体验 | `impeccable` → spatial-design |
| TasksFilesSidebar 空状态简陋 | 🟡 体验 | — |
| 深色模式变量定义了但无切换 | 🔴 缺失 | CopilotKit docs → `dark` class |
| HITL 审批未集成 | 🟡 缺失 | `copilotkit-develop` → `useInterrupt` |
| CopilotChat 无 starter suggestions | 🟢 锦上添花 | `copilotkit-develop` → `useConfigureSuggestions` |

---

## 设计上下文

**依据：** `impeccable` skill → 设计上下文必读

| 维度 | 定义 |
|------|------|
| **Target audience** | 个人开发者 / 技术工作者，需要一个本地优先的 AI agent 工具 |
| **Use cases** | 代码编写、文件管理、终端命令、文档研究、任务规划 |
| **Brand personality** | Maxma — 全息彩虹骏马，科技感 + 轻奢，克制但不冷淡 |
| **Tone** | 精致的现代科技感（refined modern tech） |
| **Differentiation** | 全息渐变细节 + 紫色品牌调性，与 Claude/Codex 的冷淡风格区分 |

---

## 架构

```
page.tsx 新增/修改的内容：
├── ThemeToggle → 深色/浅色切换（新增组件）
├── useInterrupt → HITL 审批弹窗（添加 hook）
├── useConfigureSuggestions → 欢迎建议（添加 hook）
├── 面板动画 → ResizablePanel 过渡效果
└── TasksFilesSidebar → 骨架屏 + 更好的空状态

globals.css 修改：
├── 品牌色 token — 基于 Maxma 品牌规范（oklch 紫色系）
├── 字体栈 — Space Grotesk（标题）+ Spline Sans Mono（代码）
├── 间距体系 — 4pt 基准（impeccable → spatial-design）
├── 动效体系 — 100/300/500 规则（impeccable → motion-design）
├── 面板动画 @keyframes
└── 深色模式切换 class
```

---

## 任务清单

### Task A1: 品牌设计系统

**官方依据：**
- `impeccable` skill → `color-and-contrast.md`（OKLCH 色彩空间、tinted neutrals、60-30-10 规则）
- Maxma 品牌规范（`docs/superpowers/specs/2026-06-24-maxma-branding-design.md`）
- `frontend-design` skill → 大胆的美学方向

**设计原则（来自 `impeccable`）：**
1. 使用 **OKLCH** 色彩空间，不用 HSL — 感知均匀，色相偏移可控
2. 中性色加入**微量品牌色相**（chroma 0.005-0.01）— 不显眼但有凝聚力
3. 60-30-10 规则 — 主色仅占 10%，不要过度使用
4. 永不使用纯灰或纯黑 — 所有灰色带微量色偏

#### 颜色 token

基于 Maxma 品牌规范，按 `impeccable` 的色彩原则优化：

```css
:root {
  /* === 品牌主色（紫 — 全息核心色）=== */
  --primary: oklch(0.72 0.12 280);           /* Maxma 淡紫 */
  --primary-foreground: oklch(0.99 0 0);

  /* === 中性色（带 280° 紫色微量色偏）=== */
  --background: oklch(0.98 0.005 280);        /* 近白带紫 tint */
  --foreground: oklch(0.15 0.01 280);         /* 深文字带紫 tint */
  --muted: oklch(0.96 0.005 280);             /* 柔和底 */
  --muted-foreground: oklch(0.55 0.01 280);
  --border: oklch(0.92 0.008 280);            /* 边框带紫 tint */
  --input: oklch(0.92 0.008 280);
  --ring: oklch(0.72 0.12 280);              /* focus ring = primary */

  /* === 表面层次 === */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0.01 280);
  --secondary: oklch(0.96 0.005 280);
  --secondary-foreground: oklch(0.20 0.02 280);

  /* === 强调色（青色 accent — 全息渐变中的青色元素）=== */
  --accent: oklch(0.90 0.04 280);
  --accent-foreground: oklch(0.20 0.02 280);

  /* === 语义色 === */
  --destructive: oklch(0.60 0.20 25);
  --destructive-foreground: oklch(0.99 0 0);

  /* === 全息渐变（品牌性装饰元素，非 token）=== */
  --holo-gradient: linear-gradient(135deg, #c4b5fd, #93c5fd, #67e8f9);
  --holo-gradient-hover: linear-gradient(135deg, #a78bfa, #60a5fa, #22d3ee);
}

.dark {
  --background: oklch(0.11 0.015 280);
  --foreground: oklch(0.93 0.01 280);
  --primary: oklch(0.78 0.10 280);
  --primary-foreground: oklch(0.11 0.015 280);
  --muted: oklch(0.18 0.015 280);
  --muted-foreground: oklch(0.65 0.01 280);
  --border: oklch(0.22 0.02 280);
  --card: oklch(0.14 0.015 280);
  --card-foreground: oklch(0.93 0.01 280);
}
```

**60-30-10 应用：**
- 60% — `--background` / `--muted` / `--card` 等中性色大面积使用
- 30% — `--foreground` / `--border` / `--muted-foreground` 文字和边界
- 10% — `--primary` / `--ring` 品牌色仅在按钮、焦点环、关键操作使用

#### 间距体系

**依据：** `impeccable` skill → `spatial-design.md` — 4pt 基准

```css
:root {
  --space-xs: 0.25rem;    /* 4px */
  --space-sm: 0.5rem;     /* 8px */
  --space-md: 0.75rem;    /* 12px */
  --space-lg: 1rem;       /* 16px */
  --space-xl: 1.5rem;     /* 24px */
  --space-2xl: 2rem;      /* 32px */
  --space-3xl: 3rem;      /* 48px */
  --space-4xl: 4rem;      /* 64px */
}
```

#### 字体

**依据：** Maxma 品牌规范 + `frontend-design` skill

| 用途 | 字体 | 来源 |
|------|------|------|
| **标题/UI** | Space Grotesk | Maxma 品牌规范 |
| **正文** | Space Grotesk | Maxma 品牌规范 |
| **代码** | Spline Sans Mono | Maxma 品牌规范 |
| **中文回退** | "Noto Sans SC", "PingFang SC" | Maxma 品牌规范 |

**文件：** `web/src/app/globals.css`

---

### Task A2: 深色模式切换

**官方依据：** CopilotKit CSS Customization → `.dark` class

同原方案不变。

**文件：**
- `NEW  web/src/components/ThemeToggle.tsx`
- `MOD  web/src/app/page.tsx`
- `MOD  web/src/app/layout.tsx`

---

### Task A3: 面板动画 & 动效体系

**官方依据：** `impeccable` skill → `motion-design.md`

#### 动效 token（`globals.css`）

```css
:root {
  /* 100/300/500 规则 */
  --duration-instant: 100ms;
  --duration-state: 250ms;
  --duration-layout: 400ms;
  --duration-entrance: 600ms;

  /* 缓动 — 使用 ease-out-quart 作为默认（来自 impeccable motion-design） */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

#### 面板动画

```css
/* 退出动画比进入快 ~75%（impeccable 规范） */
@keyframes panelEnter {
  from { transform: translateX(-8px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes panelExit {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-8px); opacity: 0; }
}

.panel-enter {
  animation: panelEnter var(--duration-layout) var(--ease-out-quart);
}
```

**仅动画 `transform` 和 `opacity`** — 其他属性触发重排（impeccable 规范）。

**文件：**
- `MOD  web/src/app/globals.css`
- `MOD  web/src/components/ThreadList.tsx`
- `MOD  web/src/components/TasksFilesSidebar.tsx`

---

### Task A4: 加载态 & 空状态优化

**官方依据：** `impeccable` skill → `spatial-design.md`（视觉层次）

#### ThreadList 骨架屏

用间距和透明度创建视觉层次，而非嵌套卡片（impeccable: "Cards Are Not Required"）。

```tsx
function ThreadListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
```

#### TasksFilesSidebar 空状态

```tsx
{isEmpty && (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/30" />
    <p className="text-sm font-medium text-foreground">No tasks or files yet</p>
    <p className="mt-1 text-xs text-muted-foreground/60 max-w-[200px]">
      Ask the agent to create todos or write files — they'll appear here automatically
    </p>
  </div>
)}
```

**文件：**
- `MOD  web/src/components/ThreadList.tsx`
- `MOD  web/src/components/TasksFilesSidebar.tsx`

---

### Task A5: HITL 审批集成

**官方依据：** `copilotkit-develop` skill → Step 6 `useInterrupt`

同原方案不变。

**文件：**
- `MOD  web/src/app/page.tsx`

---

### Task A6: CopilotChat 个性化

**官方依据：** `copilotkit-develop` skill → `CopilotChat` labels + `useConfigureSuggestions`

同原方案不变，labels 改为 Maxma 品牌文案。

**文件：**
- `MOD  web/src/app/page.tsx`

---

## 文件变更总表

### 新增（1个）
```
NEW  web/src/components/ThemeToggle.tsx     ← 深色模式切换
```

### 修改（5个）
```
MOD  web/src/app/globals.css                ← Maxma 品牌色 + 4pt 间距 + 动效 token + 动画
MOD  web/src/app/layout.tsx                 ← 深色模式 initial + Google Fonts
MOD  web/src/app/page.tsx                   ← ThemeToggle + useInterrupt + useConfigureSuggestions
MOD  web/src/components/ThreadList.tsx      ← 骨架屏 + 动画
MOD  web/src/components/TasksFilesSidebar.tsx ← 空状态 + 动画
```

---

## 执行顺序与验收标准

```
Task A1: 品牌设计系统 ───────→ 视觉基础
  AC: npm run build 通过，Maxma 紫色主题生效，全息渐变可见
Task A2: 深色模式切换 ───────→ 功能
  AC: 点击切换深色/浅色，刷新后保持（localStorage）
Task A3: 面板动画 ───────────→ 体验
  AC: 面板展开有 ease-out-quart 过渡，仅 animate transform + opacity
Task A4: 加载态 & 空状态 ────→ 体验
  AC: ThreadList 骨架屏、TasksFilesSidebar 有教育性空状态
Task A5: HITL 审批 ──────────→ 功能
  AC: agent 发起审批时弹窗可用 approve/reject
Task A6: CopilotChat 个性化 ──→ 体验
  AC: 建议卡片 / 自定义 labels
```

**最终验证清单：**
- [ ] `npm run build` 无错误
- [ ] `npm run test` 全部通过
- [ ] Maxma 紫色品牌色生效，中性色带紫 tint
- [ ] 深色模式切换正常，刷新保持
- [ ] 面板展开有 ease-out-quart 动画
- [ ] ThreadList 有骨架屏
- [ ] TasksFilesSidebar 有空状态指引
- [ ] HITL 审批弹窗正常工作
- [ ] CopilotChat 显示建议卡片
- [ ] 全息渐变在按钮/focus ring 等位置可见
