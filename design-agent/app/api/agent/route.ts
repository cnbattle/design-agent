import { fork } from "child_process";
import { join } from "path";
import type { AgentRequest } from "@/lib/types";

/**
 * POST /api/agent
 *
 * Spawns a child process to run the Pi agent (avoids webpack bundling issues).
 */
export async function POST(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as AgentRequest;

    if (!body.message || typeof body.message !== "string") {
      return Response.json({ error: "message is required" }, { status: 400 });
    }

    if (!body.files || typeof body.files !== "object") {
      return Response.json({ error: "files is required" }, { status: 400 });
    }

    // Spawn the pre-compiled worker process (avoids tsx/pi-ai bundling issues)
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
          // Worker is ready, send the request
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

    console.log(
      `[agent] message="${body.message.slice(0, 60)}" ` +
        `changed=${result.changed?.length ?? 0} ` +
        `time=${Date.now() - startTime}ms ` +
        `${result.error ? "error=" + result.error : ""}`
    );

    return Response.json({
      files: result.files ?? body.files,
      changed: result.changed ?? [],
      response: result.response ?? "",
      error: result.error,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[agent] fatal:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
