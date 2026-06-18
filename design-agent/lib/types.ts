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
