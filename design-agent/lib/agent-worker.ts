/**
 * Agent worker — runs as a detached child process.
 * Communicates via JSON messages on stdin/stdout.
 *
 * Usage (from parent):
 *   const child = fork("lib/agent-worker.ts", [], { execArgv: ["--import", "tsx"] });
 *   child.send({ type: "run", message: "...", files: {...} });
 *   child.on("message", (result) => { ... });
 *   child.on("exit", ...);
 */
import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

interface FileSnapshot {
  [path: string]: string;
}

class VirtualFS {
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

  editFile(path: string, oldStr: string, newStr: string): boolean {
    const content = this.files.get(path);
    if (content === undefined) return false;
    const idx = content.indexOf(oldStr);
    if (idx === -1) return false;
    this.files.set(path, content.slice(0, idx) + newStr + content.slice(idx + oldStr.length));
    this._changed.add(path);
    return true;
  }

  ls(dir: string): string[] {
    const normalized = dir.endsWith("/") ? dir : dir + "/";
    const result: string[] = [];
    for (const path of this.files.keys()) {
      if (path.startsWith(normalized)) {
        const relative = path.slice(normalized.length);
        if (relative && !relative.includes("/")) result.push(path);
      }
    }
    return result;
  }

  snapshot(): FileSnapshot {
    return Object.fromEntries(this.files);
  }

  get changed(): string[] {
    return [...this._changed];
  }
}

const SYSTEM_PROMPT = `You are a design assistant inside a web-based preview environment.

You have access to a virtual filesystem with the following tools:
- read: Read file contents
- write: Write or overwrite a file
- edit: Edit a file by replacing exact text
- ls: List files in a directory

IMPORTANT: The virtual filesystem uses paths like /App.tsx, /styles.css — NOT absolute filesystem paths. Always use paths starting with /. Do not prepend any directory path.

Work with the existing project files to fulfill the user's design request.
Be concise. Make minimal, targeted changes.`;

interface RunRequest {
  type: "run";
  message: string;
  files: FileSnapshot;
}

interface RunResponse {
  type: "result";
  files: FileSnapshot;
  changed: string[];
  response: string;
  error?: string;
}

async function handleRun(req: RunRequest): Promise<RunResponse> {
  if (!process.env.DEEPSEEK_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return {
      type: "result",
      files: req.files,
      changed: [],
      response: "",
      error:
        "No API key set. Add DEEPSEEK_API_KEY or ANTHROPIC_API_KEY to .env.local",
    };
  }

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  const fs = new VirtualFS(req.files);

  // Try DeepSeek first if its key is set, fall back to Anthropic
  const model =
    (process.env.DEEPSEEK_API_KEY
      ? getModel("deepseek", "deepseek-v4-flash")
      : undefined) ??
    getModel("anthropic", "claude-sonnet-4-20250514") ??
    (await modelRegistry.getAvailable())[0];

  if (!model) {
    return {
      type: "result",
      files: fs.snapshot(),
      changed: [],
      response: "",
      error: "No AI model available. Check your API key configuration.",
    };
  }

  const readTool = defineTool({
    name: "read", label: "Read",
    description: "Read a file from the project virtual filesystem",
    parameters: Type.Object({ path: Type.String({ description: "File path" }) }),
    execute: async (_id, params) => {
      const content = fs.readFile(params.path);
      return {
        content: [{ type: "text", text: content ?? `File not found: ${params.path}` }],
        details: {},
      };
    },
  });

  const writeTool = defineTool({
    name: "write", label: "Write",
    description: "Write content to a file in the project",
    parameters: Type.Object({
      path: Type.String({ description: "File path" }),
      content: Type.String({ description: "File content" }),
    }),
    execute: async (_id, params) => {
      fs.writeFile(params.path, params.content);
      return { content: [{ type: "text", text: `Written ${params.path}` }], details: {} };
    },
  });

  const editTool = defineTool({
    name: "edit", label: "Edit",
    description: "Edit a file by replacing exact text with new text",
    parameters: Type.Object({
      path: Type.String({ description: "File path" }),
      oldStr: Type.String({ description: "Exact text to replace" }),
      newStr: Type.String({ description: "Replacement text" }),
    }),
    execute: async (_id, params) => {
      const ok = fs.editFile(params.path, params.oldStr, params.newStr);
      return {
        content: [{ type: "text", text: ok ? `Edited ${params.path}` : `Failed: oldStr not found in ${params.path}` }],
        details: {},
      };
    },
  });

  const lsTool = defineTool({
    name: "ls", label: "List",
    description: "List files in a directory",
    parameters: Type.Object({ path: Type.String({ description: "Directory path" }) }),
    execute: async (_id, params) => {
      const entries = fs.ls(params.path);
      return { content: [{ type: "text", text: entries.length ? entries.join("\n") : "(empty)" }], details: {} };
    },
  });

  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    systemPrompt: SYSTEM_PROMPT,
    noContextFiles: true,
  });
  await resourceLoader.reload();

  let responseText = "";

  const { session } = await createAgentSession({
    model,
    thinkingLevel: "low",
    authStorage,
    modelRegistry,
    resourceLoader,
    noTools: "builtin",
    tools: ["read", "write", "edit", "ls"],
    customTools: [readTool, writeTool, editTool, lsTool],
    sessionManager: SessionManager.inMemory(),
  });

  try {
    session.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        responseText += event.assistantMessageEvent.delta;
      }
    });
    await session.prompt(req.message);
  } catch (err) {
    return {
      type: "result",
      files: fs.snapshot(),
      changed: fs.changed,
      response: responseText,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    session.dispose();
  }

  return {
    type: "result",
    files: fs.snapshot(),
    changed: fs.changed,
    response: responseText,
  };
}

// ── IPC listener ────────────────────────────────────────
process.on("message", async (msg: unknown) => {
  const req = msg as RunRequest;
  if (req?.type === "run") {
    try {
      const result = await handleRun(req);
      process.send?.(result);
    } catch (err) {
      process.send?.({
        type: "result",
        files: req.files,
        changed: [],
        response: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
});

// Signal readiness
process.send?.({ type: "ready" });
