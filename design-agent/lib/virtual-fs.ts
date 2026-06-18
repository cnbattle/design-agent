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
    const updated =
      content.slice(0, idx) + newStr + content.slice(idx + oldStr.length);
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
