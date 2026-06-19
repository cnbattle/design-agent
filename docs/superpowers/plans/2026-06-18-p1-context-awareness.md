# P1: 上下文感知 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** 用户在 Sandpack 预览中点击元素，Agent 自动知道用户点了什么组件，精准修改对应代码。

**架构:** 在 Sandpack 的 App.tsx 中注入一个全局 click 监听器，通过 `window.parent.postMessage` 将点击元素的选择器、标签名、文本内容发送到宿主页面。宿主页面捕获后存入 ref，发送 API 请求时自动附加上下文。

**核心原则:** 不加新依赖，不创建 Extension Tool（P0 不需要），直接通过 postMessage + context 注入到用户消息。

---

## 初始文件变更

| 文件 | 变更 |
|------|------|
| `components/SandpackPreview.tsx` | DEFAULT_FILES 添加 click-tracker，App.tsx 导入它 |
| `app/page.tsx` | 添加 message 监听器，API 请求携带上下文 |

---

### Task 1: 注入 Click Tracker

**Files:**
- Modify: `components/SandpackPreview.tsx`

在 DEFAULT_FILES 中添加 `/click-tracker.ts`，并在 `/App.tsx` 中导入它。

- [ ] **Step 1: 创建 click-tracker.ts 文件内容，更新 DEFAULT_FILES**

```typescript
// Add to DEFAULT_FILES in SandpackPreview.tsx
const DEFAULT_FILES: Record<string, string> = {
  "/App.tsx": `import "./styles.css";
import "./click-tracker";

export default function App() {
  return (
    <div className="app">
      <h1>Hello, Design Agent</h1>
      <p>Ask the AI to change this design!</p>
    </div>
  );
}`,
  "/styles.css": `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
.app { padding: 2rem; text-align: center; }
h1 { color: #333; }
`,
  "/click-tracker.ts": `// Sends click information to the parent window for AI context
document.addEventListener("click", (e: MouseEvent) => {
  const el = e.target as HTMLElement;
  if (!el) return;

  // Build CSS selector path
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = "#" + current.id;
      parts.unshift(selector);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const cls = current.className.trim().split(/\\s+/).slice(0, 2).join(".");
      if (cls) selector += "." + cls;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }

  const info = {
    type: "preview:click",
    selector: parts.join(" > ") || el.tagName.toLowerCase(),
    tag: el.tagName.toLowerCase(),
    text: (el.textContent || "").trim().slice(0, 100),
    id: el.id || undefined,
  };

  window.parent.postMessage(info, "*");
}, true);
`,
};
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd design-agent && npx tsc --noEmit
```

Expected: no errors (the `.ts` extension in import is handled by webpack).

---

### Task 2: 宿主页面监听点击事件

**Files:**
- Modify: `app/page.tsx`

添加 message 监听器，存储最新点击上下文。

- [ ] **Step 1: 更新 page.tsx**

```tsx
"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { FloatingChat } from "@/components/FloatingChat";
import { SandpackPreviewArea } from "@/components/SandpackPreview";
import type { FileSnapshot, AgentResponse } from "@/lib/types";

interface ClickContext {
  selector: string;
  tag: string;
  text: string;
  id?: string;
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<FileSnapshot | null>(null);
  const currentFilesRef = useRef<FileSnapshot>({});
  const clickContextRef = useRef<ClickContext | null>(null);

  // Listen for click events from the Sandpack preview iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "preview:click") {
        clickContextRef.current = {
          selector: event.data.selector,
          tag: event.data.tag,
          text: event.data.text,
          id: event.data.id,
        };
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleGetFiles = useCallback((files: FileSnapshot) => {
    currentFilesRef.current = files;
  }, []);

  const handleApplied = useCallback(() => {
    setPendingFiles(null);
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      setLoading(true);
      setLastResponse("");

      // Build enriched message with click context
      const ctx = clickContextRef.current;
      let enrichedMessage = message;
      if (ctx) {
        enrichedMessage = `[User clicked on <${ctx.tag}>${ctx.text}</${ctx.tag}> at ${ctx.selector}]\n\n${message}`;
        // Clear context so subsequent messages don't reuse stale click
        clickContextRef.current = null;
      }

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: enrichedMessage,
            files: currentFilesRef.current,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setLastResponse(`Error: ${err.error ?? res.statusText}`);
          return;
        }

        const data: AgentResponse = await res.json();
        if (data.error) {
          setLastResponse(`Agent error: ${data.error}`);
          return;
        }

        setLastResponse(data.response);
        if (data.changed.length > 0) {
          setPendingFiles(data.files);
        }
      } catch (err) {
        setLastResponse(
          `Request failed: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <SandpackPreviewArea
        pendingFiles={pendingFiles}
        onApplied={handleApplied}
        onGetFiles={handleGetFiles}
      />
      <FloatingChat
        onSend={handleSend}
        loading={loading}
        lastResponse={lastResponse}
      />
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd design-agent && npx tsc --noEmit
```

Expected: no errors.

---

### Task 3: 端到端验证

- [ ] **Step 1: 重启 dev server**

```bash
pkill -f next; sleep 2; cd design-agent && rm -rf .next && npx next dev --port 3000
```

- [ ] **Step 2: 打开页面 http://localhost:3000**

- [ ] **Step 3: 点击预览中的 "Hello, Design Agent" 标题**

然后右键查看浏览器控制台，确认页面收到了 postMessage。如果没问题，继续。

- [ ] **Step 4: 点击后发送指令**

在聊天框中输入："把颜色改成蓝色"

预期: Agent 响应中自动知道用户指的是 h1 元素，修改 App.tsx 或 styles.css 中的颜色。

---

## Self-Review

- Task 1 和 Task 2 互不冲突
- postMessage 通信不需要额外的包（零依赖）
- Click context 用完后立即清空，避免污染后续请求
- 选择器生成逻辑覆盖了 id、class、标签名三级
