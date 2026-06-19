import { loadState, saveState } from "@/lib/state";

/** GET /api/state — load persisted state */
export async function GET() {
  const state = loadState();
  return Response.json(state ?? { files: null, branches: [], activeId: null, messages: [] });
}

/** POST /api/state — save state from client */
export async function POST(request: Request) {
  const body = await request.json();
  saveState(body);
  return Response.json({ ok: true });
}
