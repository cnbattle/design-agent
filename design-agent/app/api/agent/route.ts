import { fork } from "child_process";
import { join } from "path";
import type { AgentRequest } from "@/lib/types";
import { saveState } from "@/lib/state";

/**
 * POST /api/agent
 *
 * Spawns a child process to run the Pi agent.
 * Saves state to disk after each successful run.
 */
export async function POST(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as AgentRequest & {
      branches?: any[];
      activeId?: string | null;
      messages?: { role: string; text: string }[];
    };

    if (!body.message || typeof body.message !== "string") {
      return Response.json({ error: "message is required" }, { status: 400 });
    }

    if (!body.files || typeof body.files !== "object") {
      return Response.json({ error: "files is required" }, { status: 400 });
    }

    const workerPath = join(process.cwd(), "lib", "agent-worker.js");

    const result = await new Promise<any>((resolve, reject) => {
      const child = fork(workerPath, [], {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        timeout: 120_000,
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Agent worker timed out after 120s"));
      }, 120_000);

      child.on("message", (msg: any) => {
        if (msg?.type === "ready") {
          child.send({
            type: "run",
            message: body.message,
            files: body.files,
          });
        } else if (msg?.type === "result") {
          clearTimeout(timeout);
          resolve(msg);
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });

    const files = result.files ?? body.files;
    const changed = result.changed ?? [];
    const response = result.response ?? "";
    const error = result.error;

    // Persist after successful agent call
    if (!error) {
      saveState({ files, branches: body.branches, activeId: body.activeId });
    }

    console.log(
      `[agent] message="${body.message.slice(0, 60)}" ` +
        `changed=${changed.length} time=${Date.now() - startTime}ms ` +
        `${error ? "error=" + error : ""}`
    );

    return Response.json({ files, changed, response, error });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[agent] fatal:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
