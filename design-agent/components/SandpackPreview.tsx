"use client";

import React from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";
import type { FileSnapshot } from "@/lib/types";

/** Default starter project */
const LS_KEY = "da-files";

function loadFiles(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

const DEFAULT_FILES: Record<string, string> = {
  "/App.tsx": `import "./styles.css";
import "./click-tracker";

export default function App() {
  return <div className="empty-state">Start designing</div>;
}`,
  "/styles.css": `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #fafafa; color: #999; }
.empty-state { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 18px; }
`,
  "/click-tracker.ts": `// Sends click info to parent window for AI context
document.addEventListener("click", (e: MouseEvent) => {
  const el = e.target as HTMLElement;
  if (!el) return;

  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    let sel = cur.tagName.toLowerCase();
    if (cur.id) {
      sel = "#" + cur.id;
      parts.unshift(sel);
      break;
    }
    if (cur.className && typeof cur.className === "string") {
      const cls = cur.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (cls) sel += "." + cls;
    }
    parts.unshift(sel);
    cur = cur.parentElement;
  }

  window.parent.postMessage({
    type: "preview:click",
    selector: parts.join(" > ") || el.tagName.toLowerCase(),
    tag: el.tagName.toLowerCase(),
    text: (el.textContent || "").trim().slice(0, 100),
    id: el.id || undefined,
  }, "*");
}, true);
`,
};

/** Read initial file snapshot from Sandpack */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

interface SandpackPreviewAreaProps {
  /** Server-provided initial files (from persistence) */
  initialFiles?: FileSnapshot;
  /** Files to apply — parent sets this to push changes */
  pendingFiles: FileSnapshot | null;
  /** Called after files are applied to Sandpack */
  onApplied?: () => void;
  /** Callback to get current file snapshot from Sandpack */
  onGetFiles?: (files: FileSnapshot) => void;
}

export function SandpackPreviewArea({
  initialFiles,
  pendingFiles,
  onApplied,
  onGetFiles,
}: SandpackPreviewAreaProps) {
  const [files, setFiles] = React.useState(() =>
    initialFiles && Object.keys(initialFiles).length > 0
      ? initialFiles
      : DEFAULT_FILES
  );

  // Merge pending files into sandpack files when they arrive
  React.useEffect(() => {
    if (!pendingFiles) return;
    setFiles((prev) => ({ ...prev, ...pendingFiles }));
    onApplied?.();
  }, [pendingFiles, onApplied]);

  // Persist files to localStorage
  React.useEffect(() => {
    if (Object.keys(files).length > 0) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(files)); } catch {}
    }
  }, [files]);

  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      options={{
        visibleFiles: [],
        activeFile: "/App.tsx",
        recompileMode: "immediate",
        recompileDelay: 300,
      }}
      customSetup={{
        entry: "/App.tsx",
      }}
    >
      <SandpackLayout>
        <SandpackPreview
          style={{ height: "100vh", width: "100vw" }}
        />
      </SandpackLayout>

      <SnapshotReader onGetFiles={onGetFiles} />
    </SandpackProvider>
  );
}
