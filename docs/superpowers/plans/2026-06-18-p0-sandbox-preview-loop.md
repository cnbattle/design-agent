# P0: Sandbox Preview Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the closed-loop demo: user types in floating chat → Pi SDK agent modifies code → Sandpack hot-reloads preview.

**Architecture:** Next.js 15 App Router with a single page hosting both a floating chat input and a Sandpack preview. The BFF is a Next.js API route that creates Pi SDK agent sessions with custom file tools operating on an in-memory virtual filesystem. User messages go to the API route, the agent reads/writes the virtual FS, the API returns file diffs, and the frontend applies them to Sandpack via `updateFile()`.

**Tech Stack:** Next.js 15 (App Router), `@earendil-works/pi-coding-agent` (SDK), `@codesandbox/sandpack-react` (preview), TypeScript, Tailwind CSS.

## Global Constraints

- Pi SDK is used programmatically via `createAgentSession()` — no CLI subprocess
- Custom tools named `read`, `write`, `edit`, `ls` shadow Pi's built-in names and operate on an in-memory virtual FS
- Pi built-in tools are disabled via `noTools: "builtin"` + explicit `tools` allowlist
- The API route is a Next.js `POST /api/agent` route handler (App Router)
- Sandpack uses `template="react-ts"` with custom files
- No database, no Redis, no separate BFF process — keep it simple for P0
- All package versions pinned for reproducibility

---

## Initial File Map

```
design-agent/
├── package.json              # Dependencies: next, sandpack-react, pi-coding-agent
├── tsconfig.json             # TypeScript config
├── next.config.ts            # Next.js config (ESM-compatible)
├── postcss.config.js         # PostCSS for Tailwind
├── tailwind.config.ts        # Tailwind config
├── app/
│   ├── layout.tsx            # Root layout (Tailwind + body)
│   ├── page.tsx              # Main page: FloatingChat + SandpackPreview
│   ├── globals.css           # Tailwind directives
│   └── api/
│       └── agent/
│           └── route.ts      # POST handler: Pi SDK + Virtual FS
├── lib/
│   ├── virtual-fs.ts         # Map-based in-memory filesystem
│   ├── agent-service.ts      # createAgentSession + custom tools setup
│   └── types.ts              # Shared types (FileSnapshot, AgentRequest, AgentResponse)
└── components/
    ├── FloatingChat.tsx       # Chat input floating on the page
    └── SandpackPreview.tsx    # Sandpack preview + file sync
```

---

### Task 1: Scaffold Project

**Files:**
- Create: `design-agent/package.json`
- Create: `design-agent/tsconfig.json`
- Create: `design-agent/next.config.ts`
- Create: `design-agent/postcss.config.js`
- Create: `design-agent/tailwind.config.ts`
- Create: `design-agent/app/globals.css`
- Create: `design-agent/app/layout.tsx`

**Interfaces:**
- Consumes: nothing (scaffold)
- Produces: a runnable Next.js dev server with Tailwind

- [ ] **Step 1: Create package.json**

```json
{
  "name": "design-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@codesandbox/sandpack-react": "^2.19.0",
    "@earendil-works/pi-coding-agent": "^1.100.0",
    "typebox": "^0.34.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow larger body for file snapshots
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create postcss.config.js** (Tailwind v4 PostCSS compat)

```js
/** @type {import('postcss-load-config').Config} */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 5: Create tailwind.config.ts** (Tailwind v4 doesn't need this, but leaving for v3 compat reference)

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
} satisfies Config;
```

- [ ] **Step 6: Create app/globals.css**

```css
@import "tailwindcss";

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

/* Floating chat overlaid on top of Sandpack preview */
.chat-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 50;
  width: 400px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  background: white;
  overflow: hidden;
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  .chat-container {
    background: #1a1a2e;
    border: 1px solid #333;
  }
}
```

- [ ] **Step 7: Create app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Agent",
  description: "AI-powered design preview with Pi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Install dependencies and verify dev server starts**

```bash
cd design-agent
npm install
npx next --version
```

Expected: prints `Next.js v15.x`.

---

### Task 2: Build Virtual Filesystem

**Files:**
- Create: `design-agent/lib/virtual-fs.ts`
- Create: `design-agent/lib/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `VirtualFS` class and `FileSnapshot` type used by agent-service and API route

- [ ] **Step 1: Create lib/types.ts**

```typescript
/** FileSystem snapshot: path → content */
export type FileSnapshot = Record<string, string>;

/** Request body for /api/agent */
export interface AgentRequest {
  message: string;
  files: FileSnapshot;
  activeFile?: string;
}

/** Response from /api/agent */
export interface AgentResponse {
  files: FileSnapshot;
  /** File paths that changed */
  changed: string[];
  /** Assistant's text response */
  response: string;
  /** Error message if any */
  error?: string;
}
```

- [ ] **Step 2: Create lib/virtual-fs.ts**

```typescript
import type { FileSnapshot } from "./types";

/**
 * In-memory virtual filesystem.
 * Initialized from a FileSnapshot, tracks mutations.
 */
export class VirtualFS {
  private files: Map<string, string>;
  private _changed: Set<string> = new Set();

  constructor(snapshot: FileSnapshot) {
    this.files = new Map(Object.entries(snapshot));
  }

  readFile(path: string): string | null {
    return this.files.get(path) ?? null;
  }

  writeFile(path: string, content: string): void {
    this.files.set(path, content);
    this._changed.add(path);
  }

  /**
   * Edit file by replacing first occurrence of oldStr with newStr.
   * Returns true if replacement was made.
   */
  editFile(path: string, oldStr: string, newStr: string): boolean {
    const content = this.files.get(path);
    if (content === undefined) return false;
    const idx = content.indexOf(oldStr);
    if (idx === -1) return false;
    const updated = content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
    this.files.set(path, updated);
    this._changed.add(path);
    return true;
  }

  /** List files in a directory (shallow) */
  ls(dir: string): string[] {
    const normalized = dir.endsWith("/") ? dir : dir + "/";
    const result: string[] = [];
    for (const path of this.files.keys()) {
      if (path.startsWith(normalized)) {
        const relative = path.slice(normalized.length);
        if (relative && !relative.includes("/")) {
          result.push(path);
        }
      }
    }
    return result;
  }

  /** Get all files as a snapshot */
  snapshot(): FileSnapshot {
    return Object.fromEntries(this.files);
  }

  /** Get changed paths */
  get changed(): string[] {
    return [...this._changed];
  }
}
```

---

### Task 3: Build Agent Service

**Files:**
- Create: `design-agent/lib/agent-service.ts`

**Interfaces:**
- Consumes: `VirtualFS` (from task 2), Pi SDK types
- Produces: `runAgent(fs, message)` function used by the API route

- [ ] **Step 1: Create agent-service.ts**

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";

import type { FileSnapshot } from "./types";
import { VirtualFS } from "./virtual-fs";

export interface RunAgentResult {
  files: FileSnapshot;
  changed: string[];
  response: string;
  error?: string;
}

/**
 * Run the Pi agent against the virtual FS with the given message.
 */
export async function runAgent(
  fs: VirtualFS,
  message: string
): Promise<RunAgentResult> {
  // ── Auth & model ──────────────────────────────────────
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  // Try Claude Sonnet first, fall back to first available
  const model =
    getModel("anthropic", "claude-sonnet-4-20250514") ??
    (await modelRegistry.getAvailable())[0];

  if (!model) {
    return {
      files: fs.snapshot(),
      changed: [],
      response: "",
      error: "No AI model available. Configure ANTHROPIC_API_KEY or another provider.",
    };
  }

  // ── Custom file tools (shadow built-in names) ─────────
  const readTool = defineTool({
    name: "read",
    label: "Read",
    description: "Read a file from the project virtual filesystem",
    parameters: Type.Object({
      path: Type.String({ description: "Path to file, e.g. /App.tsx" }),
    }),
    execute: async (_toolCallId, params) => {
      const content = fs.readFile(params.path);
      if (content === null) {
        return {
          content: [{ type: "text", text: `File not found: ${params.path}` }],
          details: {},
        };
      }
      return {
        content: [{ type: "text", text: content }],
        details: {},
      };
    },
  });

  const writeTool = defineTool({
    name: "write",
    label: "Write",
    description: "Write content to a file in the project",
    parameters: Type.Object({
      path: Type.String({ description: "File path" }),
      content: Type.String({ description: "File content" }),
    }),
    execute: async (_toolCallId, params) => {
      fs.writeFile(params.path, params.content);
      return {
        content: [{ type: "text", text: `Written ${params.path}` }],
        details: {},
      };
    },
  });

  const editTool = defineTool({
    name: "edit",
    label: "Edit",
    description: "Edit a file by replacing exact text with new text",
    parameters: Type.Object({
      path: Type.String({ description: "File path" }),
      oldStr: Type.String({ description: "Exact text to replace" }),
      newStr: Type.String({ description: "Replacement text" }),
    }),
    execute: async (_toolCallId, params) => {
      const ok = fs.editFile(params.path, params.oldStr, params.newStr);
      return {
        content: [
          {
            type: "text",
            text: ok
              ? `Edited ${params.path}`
              : `Failed: could not find oldStr in ${params.path}`,
          },
        ],
        details: {},
      };
    },
  });

  const lsTool = defineTool({
    name: "ls",
    label: "List",
    description: "List files in a directory",
    parameters: Type.Object({
      path: Type.String({ description: "Directory path, e.g. /" }),
    }),
    execute: async (_toolCallId, params) => {
      const entries = fs.ls(params.path);
      return {
        content: [
          {
            type: "text",
            text:
              entries.length > 0
                ? entries.join("\n")
                : "(empty directory)",
          },
        ],
        details: {},
      };
    },
  });

  // ── System prompt ─────────────────────────────────────
  const resourceLoader = new DefaultResourceLoader({
    systemPromptOverride: () =>
      `You are a design assistant inside a web-based preview environment.

You have access to a virtual filesystem with the following tools:
- read: Read file contents
- write: Write or overwrite a file
- edit: Edit a file by replacing exact text
- ls: List files in a directory

Work with the existing project files to fulfill the user's design request.
Be concise. Make minimal, targeted changes.`,
  });
  await resourceLoader.reload();

  // ── Session ───────────────────────────────────────────
  let responseText = "";

  const { session } = await createAgentSession({
    model,
    thinkingLevel: "low",
    authStorage,
    modelRegistry,
    resourceLoader,
    // Only our custom tools — no built-in bash/write/edit
    noTools: "builtin",
    tools: ["read", "write", "edit", "ls"],
    customTools: [readTool, writeTool, editTool, lsTool],
    sessionManager: SessionManager.inMemory(),
  });

  try {
    session.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        responseText += event.assistantMessageEvent.delta;
      }
    });

    await session.prompt(message);
  } catch (err) {
    return {
      files: fs.snapshot(),
      changed: fs.changed,
      response: responseText,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    session.dispose();
  }

  return {
    files: fs.snapshot(),
    changed: fs.changed,
    response: responseText,
  };
}
```

---

### Task 4: Build API Route

**Files:**
- Create: `design-agent/app/api/agent/route.ts`

**Interfaces:**
- Consumes: `AgentRequest`, `AgentResponse` types, `VirtualFS`, `runAgent`
- Produces: POST endpoint at `/api/agent`

- [ ] **Step 1: Create route.ts**

```typescript
import type { AgentRequest, AgentResponse } from "@/lib/types";
import { VirtualFS } from "@/lib/virtual-fs";
import { runAgent } from "@/lib/agent-service";

/**
 * POST /api/agent
 *
 * Body: { message: string, files: Record<string,string>, activeFile?: string }
 * Returns: { files, changed, response, error? }
 */
export async function POST(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as AgentRequest;

    if (!body.message || typeof body.message !== "string") {
      return Response.json(
        { error: "message is required" } satisfies Partial<AgentResponse>,
        { status: 400 }
      );
    }

    if (!body.files || typeof body.files !== "object") {
      return Response.json(
        { error: "files is required" } satisfies Partial<AgentResponse>,
        { status: 400 }
      );
    }

    // Initialize virtual FS from the current sandpack state
    const fs = new VirtualFS(body.files);

    // Run the Pi agent
    const result = await runAgent(fs, body.message);

    console.log(
      `[agent] message="${body.message.slice(0, 60)}" ` +
      `changed=${result.changed.length} ` +
      `time=${Date.now() - startTime}ms ` +
      `${result.error ? "error=" + result.error : ""}`
    );

    return Response.json(result satisfies AgentResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[agent] fatal:", msg);
    return Response.json(
      { error: msg } satisfies Partial<AgentResponse>,
      { status: 500 }
    );
  }
}
```

---

### Task 5: Build Sandpack Preview Component

**Files:**
- Create: `design-agent/components/SandpackPreview.tsx`

**Interfaces:**
- Consumes: nothing directly; exposes `SandpackPreviewRef` with `getFiles()` and `applyChanges(files)`
- Produces: `<SandpackPreview>` component used by main page, with imperative ref for file sync

- [ ] **Step 1: Create SandpackPreview.tsx**

```tsx
"use client";

import React from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";
import type { FileSnapshot } from "@/lib/types";

/** Default starter project */
const DEFAULT_FILES: Record<string, string> = {
  "/App.tsx": `import "./styles.css";

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
};

/**
 * Invisible component that bridges file changes to Sandpack's updateFile.
 * This triggers HMR without full recompile.
 */
function FileApplier({
  pendingFiles,
  onApplied,
}: {
  pendingFiles: FileSnapshot | null;
  onApplied: () => void;
}) {
  const { sandpack } = useSandpack();

  React.useEffect(() => {
    if (!pendingFiles) return;
    for (const [path, content] of Object.entries(pendingFiles)) {
      sandpack.updateFile(path, content);
    }
    onApplied();
  }, [pendingFiles, sandpack, onApplied]);

  return null;
}

interface SandpackPreviewAreaProps {
  /** Files to apply — parent sets this to push changes */
  pendingFiles: FileSnapshot | null;
  /** Called after files are applied to Sandpack */
  onApplied?: () => void;
  /** Callback to get current file snapshot from Sandpack */
  onGetFiles?: (files: FileSnapshot) => void;
}

/** Separately-defined component for reading initial Sandpack snapshot */
function SnapshotReader({
  onGetFiles,
}: {
  onGetFiles?: (files: FileSnapshot) => void;
}) {
  const { sandpack } = useSandpack();

  React.useEffect(() => {
    if (!onGetFiles) return;
    const snapshot: FileSnapshot = {};
    for (const [path, f] of Object.entries(sandpack.files)) {
      snapshot[path] = f.code;
    }
    onGetFiles(snapshot);
    // Only once on mount — deps intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function SandpackPreviewArea({
  pendingFiles,
  onApplied,
  onGetFiles,
}: SandpackPreviewAreaProps) {
  const [files, setFiles] = React.useState(DEFAULT_FILES);

  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      options={{
        visibleFiles: ["/App.tsx", "/styles.css"],
        activeFile: "/App.tsx",
        recompileMode: "immediate",
        recompileDelay: 300,
      }}
      customSetup={{
        entry: "/App.tsx",
      }}
    >
      <SandpackLayout>
        <SandpackCodeEditor
          showTabs
          style={{ height: "100vh", flex: 1 }}
        />
        <SandpackPreview
          style={{ height: "100vh", flex: 1 }}
        />
      </SandpackLayout>
      <FileApplier
        pendingFiles={pendingFiles}
        onApplied={onApplied ?? (() => {})}
      />
      <SnapshotReader onGetFiles={onGetFiles} />
    </SandpackProvider>
  );
}
```

---

### Task 6: Build Floating Chat Component

**Files:**
- Create: `design-agent/components/FloatingChat.tsx`

**Interfaces:**
- Consumes: `onSend(message)` callback
- Produces: `<FloatingChat>` component

- [ ] **Step 1: Create FloatingChat.tsx**

```tsx
"use client";

import React, { useState, useRef, useEffect } from "react";

interface FloatingChatProps {
  onSend: (message: string) => void;
  loading?: boolean;
  lastResponse?: string;
}

export function FloatingChat({
  onSend,
  loading = false,
  lastResponse,
}: FloatingChatProps) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track assistant responses
  useEffect(() => {
    if (!lastResponse) return;
    setMessages((prev) => [
      ...prev,
      { role: "assistant" as const, text: lastResponse },
    ]);
  }, [lastResponse]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user" as const, text: trimmed }]);
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div
        className="chat-header"
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding: "10px 14px",
          fontWeight: 600,
          cursor: "pointer",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          userSelect: "none",
        }}
      >
        <span>Design Agent</span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>
          {expanded ? "▼" : "▲"}
        </span>
      </div>

      {/* Messages */}
      {expanded && (
        <div
          className="chat-messages"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minHeight: 0,
          }}
        >
          {messages.length === 0 && (
            <p style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>
              Ask me to change the design...
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.4,
                maxWidth: "85%",
                alignSelf:
                  msg.role === "user" ? "flex-end" : "flex-start",
                background:
                  msg.role === "user" ? "#6366f1" : "#f3f4f6",
                color: msg.role === "user" ? "white" : "#1f2937",
              }}
            >
              {msg.text}
            </div>
          ))}
          {loading && (
            <div
              style={{
                alignSelf: "flex-start",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                background: "#f3f4f6",
                color: "#999",
              }}
            >
              Thinking...
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          borderTop: "1px solid #e5e7eb",
          padding: "8px",
          gap: "6px",
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Change the button to blue..."
          rows={1}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 13,
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: loading || !input.trim() ? "#d1d5db" : "#6366f1",
            color: "white",
            fontWeight: 600,
            fontSize: 13,
            cursor: loading || !input.trim() ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

---

### Task 7: Wire the Main Page

**Files:**
- Modify: `design-agent/app/page.tsx`

**Interfaces:**
- Consumes: `FloatingChat`, `SandpackPreviewArea`
- Produces: The functional page

- [ ] **Step 1: Create app/page.tsx**

```tsx
"use client";

import React, { useCallback, useRef, useState } from "react";
import { FloatingChat } from "@/components/FloatingChat";
import { SandpackPreviewArea } from "@/components/SandpackPreview";
import type { FileSnapshot, AgentResponse } from "@/lib/types";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<FileSnapshot | null>(null);
  const currentFilesRef = useRef<FileSnapshot>({});
  const agentKeyRef = useRef(0);

  /** Called by SandpackPreviewArea when it reads the initial snapshot */
  const handleGetFiles = useCallback((files: FileSnapshot) => {
    currentFilesRef.current = files;
  }, []);

  /** Called after Sandpack applies our file changes */
  const handleApplied = useCallback(() => {
    setPendingFiles(null);
  }, []);

  /** Send user message to the agent */
  const handleSend = useCallback(
    async (message: string) => {
      setLoading(true);
      setLastResponse("");

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
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

        // Show assistant's text response
        setLastResponse(data.response);

        // Push changed files to Sandpack
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
        key={agentKeyRef.current}
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

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
cd design-agent
npm run dev
```

Expected: Next.js starts on http://localhost:3000.

- [ ] **Step 2: Open the page**

Visit http://localhost:3000. Expected:
- Sandpack preview shows the default "Hello, Design Agent" page
- Code editor shows App.tsx and styles.css
- Floating chat button/area in bottom-right corner

- [ ] **Step 3: Set up API key**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Then restart the server (or use `.env.local`):

```
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Next.js automatically loads `.env.local` into `process.env`.

- [ ] **Step 4: Send a design prompt**

In the chat, type: "Change the h1 text to 'Welcome to Design Agent' and make it blue"

Expected:
1. Chat shows "Thinking..."
2. After a few seconds, the Sandpack preview updates with the new text and blue color
3. The code editor shows the modified files
4. Chat shows the assistant's response

- [ ] **Step 5: Test chained changes**

Type: "Add a second paragraph below the h1"

Expected: App.tsx gets updated, preview reflects the change without page reload.

- [ ] **Step 6: Test file creation**

Type: "Create a new file /Button.tsx with a styled button component, and import it in App.tsx"

Expected: Both files are created/modified, Sandpack compiles and shows the button.

---

## Self-Review Checklist

- **Spec coverage**: P0 spec requires "悬浮框输入 → Pi SDK 改码 → Sandpack 热更新". Tasks 1-7 cover this end-to-end.
- **Placeholder scan**: No TBD, TODO, or vague steps. All code is concrete.
- **Type consistency**: `FileSnapshot` (Record<string,string>) flows from Sandpack → API → VirtualFS → back. Custom tools return the same shapes used by the API route and frontend.
- **Path correctness**: All file paths are relative to `design-agent/`. Import paths use `@/` alias (Next.js convention).
