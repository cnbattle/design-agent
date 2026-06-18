"use client";

import React, { useCallback, useRef, useState } from "react";
import { FloatingChat } from "@/components/FloatingChat";
import { SandpackPreviewArea } from "@/components/SandpackPreview";
import type { FileSnapshot, AgentResponse } from "@/lib/types";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<FileSnapshot | null>(null);
  const currentFilesRef = useRef<FileSnapshot>({});

  /** Called by SandpackPreviewArea when it reads the initial snapshot */
  const handleGetFiles = useCallback((files: FileSnapshot) => {
    currentFilesRef.current = files;
  }, []);

  /** Called after Sandpack applies our file changes */
  const handleApplied = useCallback(() => {
    setPendingFiles(null);
  }, []);

  /** Send user message to the agent */
  const handleSend = useCallback(
    async (message: string) => {
      setLoading(true);
      setLastResponse("");

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            files: currentFilesRef.current,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setLastResponse(`Error: ${err.error ?? res.statusText}`);
          return;
        }

        const data: AgentResponse = await res.json();

        if (data.error) {
          setLastResponse(`Agent error: ${data.error}`);
          return;
        }

        // Show assistant's text response
        setLastResponse(data.response);

        // Push changed files to Sandpack
        if (data.changed.length > 0) {
          setPendingFiles(data.files);
        }
      } catch (err) {
        setLastResponse(
          `Request failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <SandpackPreviewArea
        pendingFiles={pendingFiles}
        onApplied={handleApplied}
        onGetFiles={handleGetFiles}
      />
      <FloatingChat
        onSend={handleSend}
        loading={loading}
        lastResponse={lastResponse}
      />
    </div>
  );
}
