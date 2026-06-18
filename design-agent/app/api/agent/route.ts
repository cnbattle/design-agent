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
