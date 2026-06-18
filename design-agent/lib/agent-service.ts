import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { homedir } from "os";
import { join } from "path";
import type { FileSnapshot } from "./types";
import { VirtualFS } from "./virtual-fs";

export interface RunAgentResult {
  files: FileSnapshot;
  changed: string[];
  response: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are a design assistant inside a web-based preview environment.

You have access to a virtual filesystem with the following tools:
- read: Read file contents
- write: Write or overwrite a file
- edit: Edit a file by replacing exact text
- ls: List files in a directory

Work with the existing project files to fulfill the user's design request.
Be concise. Make minimal, targeted changes.`;

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
      error:
        "No AI model available. Configure ANTHROPIC_API_KEY or another provider.",
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
          content: [
            { type: "text", text: `File not found: ${params.path}` },
          ],
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

  // ── Resource loader with custom system prompt ─────────
  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: join(homedir(), ".pi", "agent"),
    systemPrompt: SYSTEM_PROMPT,
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
