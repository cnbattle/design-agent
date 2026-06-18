"use client";

import React from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react";
import type { FileSnapshot } from "@/lib/types";

/** Default starter project */
const DEFAULT_FILES: Record<string, string> = {
  "/App.tsx": `import "./styles.css";

export default function App() {
  return <div className="empty-state">Start designing</div>;
}`,
  "/styles.css": `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #fafafa; color: #999; }
.empty-state { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 18px; }
`,
};

/**
 * Invisible component that bridges file changes to Sandpack's updateFile.
 * This triggers HMR without full recompile.
 */
function FileApplier({
  pendingFiles,
  onApplied,
}: {
  pendingFiles: FileSnapshot | null;
  onApplied: () => void;
}) {
  const { sandpack } = useSandpack();

  React.useEffect(() => {
    if (!pendingFiles) return;
    for (const [path, content] of Object.entries(pendingFiles)) {
      sandpack.updateFile(path, content);
    }
    onApplied();
  }, [pendingFiles, sandpack, onApplied]);

  return null;
}

/** Separately-defined component for reading initial Sandpack snapshot */
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
    // Only once on mount — deps intentionally empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

interface SandpackPreviewAreaProps {
  /** Files to apply — parent sets this to push changes */
  pendingFiles: FileSnapshot | null;
  /** Called after files are applied to Sandpack */
  onApplied?: () => void;
  /** Callback to get current file snapshot from Sandpack */
  onGetFiles?: (files: FileSnapshot) => void;
}

export function SandpackPreviewArea({
  pendingFiles,
  onApplied,
  onGetFiles,
}: SandpackPreviewAreaProps) {
  const [files, setFiles] = React.useState(DEFAULT_FILES);
  const [showEditor, setShowEditor] = React.useState(false);

  const toggleEditor = React.useCallback(() => setShowEditor((v) => !v), []);

  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      options={{
        visibleFiles: ["/App.tsx", "/styles.css"],
        activeFile: "/App.tsx",
        recompileMode: "immediate",
        recompileDelay: 300,
      }}
      customSetup={{
        entry: "/App.tsx",
      }}
    >
      <SandpackLayout>
        {showEditor && (
          <SandpackCodeEditor
            showTabs
            style={{ height: "calc(100vh - 36px)" }}
          />
        )}
        <SandpackPreview
          style={{ height: "calc(100vh - 36px)" }}
        />
      </SandpackLayout>

      {/* Toggle button */}
      <button
        onClick={toggleEditor}
        title={showEditor ? "Hide code editor" : "Show code editor"}
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 60,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid #d1d5db",
          background: "rgba(255,255,255,0.9)",
          color: "#374151",
          fontSize: 12,
          cursor: "pointer",
          backdropFilter: "blur(4px)",
        }}
      >
        {showEditor ? "✕ Code" : "</> Code"}
      </button>

      <FileApplier
        pendingFiles={pendingFiles}
        onApplied={onApplied ?? (() => {})}
      />
      <SnapshotReader onGetFiles={onGetFiles} />
    </SandpackProvider>
  );
}
