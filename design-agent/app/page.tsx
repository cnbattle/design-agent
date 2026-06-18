"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { FloatingChat } from "@/components/FloatingChat";
import { SandpackPreviewArea } from "@/components/SandpackPreview";
import { BranchBar } from "@/components/BranchBar";
import { useBranches } from "@/lib/use-branches";
import type { FileSnapshot, AgentResponse } from "@/lib/types";

interface ClickContext {
  selector: string;
  tag: string;
  text: string;
  id?: string;
}

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<FileSnapshot | null>(null);
  const currentFilesRef = useRef<FileSnapshot>({});
  const clickContextRef = useRef<ClickContext | null>(null);
  const branches = useBranches();

  // Listen for click events from the Sandpack preview iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "preview:click") {
        clickContextRef.current = {
          selector: event.data.selector,
          tag: event.data.tag,
          text: event.data.text,
          id: event.data.id,
        };
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleGetFiles = useCallback((files: FileSnapshot) => {
    currentFilesRef.current = files;
    if (branches.branches.length === 0 && Object.keys(files).length > 0) {
      branches.initMain(files);
    }
  }, [branches]);

  const handleApplied = useCallback(() => {
    setPendingFiles(null);
  }, []);

  const handleSend = useCallback(
    async (message: string) => {
      setLoading(true);
      setLastResponse("");

      // Enrich message with click context if available
      const ctx = clickContextRef.current;
      let enrichedMessage = message;
      if (ctx) {
        enrichedMessage = `[Clicked on <${ctx.tag}>${ctx.text}</${ctx.tag}> at \`${ctx.selector}\`]\n\n${message}`;
        clickContextRef.current = null; // consume
      }

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: enrichedMessage,
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

        setLastResponse(data.response);

        if (data.changed.length > 0) {
          setPendingFiles(data.files);
        }

        // Refresh current files ref after agent response
        if (data.files) {
          currentFilesRef.current = data.files;
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

  const handleSwitchBranch = useCallback(
    (id: string) => {
      const files = branches.switchBranch(id);
      if (files) {
        currentFilesRef.current = files;
        setPendingFiles(files);
      }
    },
    [branches]
  );

  const handleSaveVariant = useCallback(
    (name: string) => {
      branches.saveBranch(name, currentFilesRef.current);
    },
    [branches]
  );

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, position: "relative" }}>
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
      <BranchBar
        branches={branches.branches}
        activeId={branches.activeId}
        onSwitch={handleSwitchBranch}
        onSave={handleSaveVariant}
      />
    </div>
  );
}
