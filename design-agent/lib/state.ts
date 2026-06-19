import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), ".data");
const FILE = join(DIR, "state.json");

export interface PersistedState {
  files: Record<string, string>;
  branches: { id: string; name: string; files: Record<string, string>; timestamp: number }[];
  activeId: string | null;
  messages: { role: "user" | "assistant"; text: string }[];
}

export function saveState(data: Partial<PersistedState>): void {
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    const existing = loadState();
    writeFileSync(FILE, JSON.stringify({ ...existing, ...data }, null, 2));
  } catch (err) {
    console.error("[state] save error:", err);
  }
}

export function loadState(): PersistedState | null {
  try {
    if (!existsSync(FILE)) return null;
    return JSON.parse(readFileSync(FILE, "utf-8"));
  } catch {
    return null;
  }
}
