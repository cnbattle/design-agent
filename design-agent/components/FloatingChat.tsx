"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { FileSnapshot } from "@/lib/types";

interface FloatingChatProps {
  onSend: (message: string) => void;
  loading?: boolean;
  lastResponse?: string;
  files?: FileSnapshot;
}

export function FloatingChat({
  onSend,
  loading = false,
  lastResponse,
  files = {},
}: FloatingChatProps) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"chat" | "code">("chat");
  const [messages, setMessages] =
    useState<{ role: "user" | "assistant"; text: string }[]>(() => {
      try {
        const raw = localStorage.getItem("da-msgs");
        if (raw) return JSON.parse(raw);
      } catch {}
      return [];
    });
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, sx: 0, sy: 0, l: 0, t: 0 });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist messages
  useEffect(() => {
    try { localStorage.setItem("da-msgs", JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    if (!lastResponse) return;
    setMessages((prev) => [
      ...prev,
      { role: "assistant" as const, text: lastResponse },
    ]);
  }, [lastResponse]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [
      ...prev,
      { role: "user" as const, text: trimmed },
    ]);
    onSend(trimmed);
    setInput("");
  };

  const onMd = (e: React.MouseEvent) => {
    const d = drag.current;
    d.active = true;
    d.sx = e.clientX;
    d.sy = e.clientY;
    const r = containerRef.current?.getBoundingClientRect();
    if (r) { d.l = r.left; d.t = r.top; }
    const mm = (ev: MouseEvent) => {
      if (!d.active || !containerRef.current) return;
      containerRef.current.style.left = (d.l + ev.clientX - d.sx) + "px";
      containerRef.current.style.top = (d.t + ev.clientY - d.sy) + "px";
      containerRef.current.style.right = "auto";
      containerRef.current.style.bottom = "auto";
    };
    const mu = () => {
      d.active = false;
      document.removeEventListener("mousemove", mm);
      document.removeEventListener("mouseup", mu);
    };
    document.addEventListener("mousemove", mm);
    document.addEventListener("mouseup", mu);
  };

  const codeFiles = Object.entries(files).filter(
    ([p]) => p.endsWith(".tsx") || p.endsWith(".css") || p.endsWith(".ts")
  );

  return (
    <div ref={containerRef} className="chat-container">
      {/* Header */}
      <div
        onMouseDown={onMd}
        style={{
          padding: "6px 10px", fontWeight: 600, cursor: "grab",
          borderBottom: "1px solid #e5e7eb", userSelect: "none",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 13,
        }}
      >
        <span
          onClick={() => setExpanded((e) => !e)}
          style={{ flex: 1, cursor: "pointer" }}
        >
          Design Agent {expanded ? "▼" : "▲"}
        </span>
        {expanded && (
          <div style={{ display: "flex", gap: 3 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setTab("chat"); }}
              style={{
                padding: "2px 8px", borderRadius: 4, border: "none", fontSize: 11,
                background: tab === "chat" ? "#6366f1" : "#e5e7eb",
                color: tab === "chat" ? "white" : "#374151", cursor: "pointer",
              }}
            >
              Chat
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setTab("code"); }}
              style={{
                padding: "2px 8px", borderRadius: 4, border: "none", fontSize: 11,
                background: tab === "code" ? "#6366f1" : "#e5e7eb",
                color: tab === "code" ? "white" : "#374151", cursor: "pointer",
              }}
            >
              Code
            </button>
          </div>
        )}
      </div>

      {/* Chat tab */}
      {expanded && tab === "chat" && (
        <div
          style={{
            flex: 1, overflowY: "auto", padding: "8px 10px",
            display: "flex", flexDirection: "column", gap: "6px", minHeight: 0,
          }}
        >
          {messages.length === 0 && (
            <p style={{ color: "#999", fontSize: 12, textAlign: "center", marginTop: 16 }}>
              Ask me to change the design...
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                padding: "6px 10px", borderRadius: 8, fontSize: 12, lineHeight: 1.4,
                maxWidth: "90%",
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                background: msg.role === "user" ? "#6366f1" : "#f3f4f6",
                color: msg.role === "user" ? "white" : "#1f2937",
              }}
            >
              {msg.text}
            </div>
          ))}
          {loading && <LoadingIndicator />}
          <div ref={endRef} />
        </div>
      )}

      {/* Code tab */}
      {expanded && tab === "code" && (
        <div
          style={{
            flex: 1, overflowY: "auto", padding: "8px 10px",
            fontSize: 11, fontFamily: "monospace",
            background: "#1e1e2e", color: "#cdd6f4",
            whiteSpace: "pre-wrap", minHeight: 0,
          }}
        >
          {codeFiles.length === 0 ? (
            <p style={{ color: "#6c7086", textAlign: "center", marginTop: 20 }}>
              No files yet
            </p>
          ) : (
            codeFiles.map(([path, content]) => (
              <div key={path} style={{ marginBottom: 12 }}>
                <div style={{ color: "#89b4fa", marginBottom: 4, fontSize: 10 }}>
                  // {path}
                </div>
                <pre style={{ margin: 0, lineHeight: 1.5 }}>{content}</pre>
              </div>
            ))
          )}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex", borderTop: "1px solid #e5e7eb",
          padding: "6px", gap: "4px",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Change the button to blue..."
          rows={1}
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          style={{
            flex: 1, padding: "6px 8px", borderRadius: 6,
            border: "1px solid #d1d5db", fontSize: 12,
            resize: "none", outline: "none", fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "6px 12px", borderRadius: 6, border: "none",
            background: loading || !input.trim() ? "#d1d5db" : "#6366f1",
            color: "white", fontWeight: 600, fontSize: 12,
            cursor: loading || !input.trim() ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function LoadingIndicator() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setSec(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      style={{
        alignSelf: "flex-start", padding: "6px 10px", borderRadius: 8,
        fontSize: 12, background: "#f3f4f6", color: "#999",
      }}
    >
      Thinking{sec >= 2 ? ` (${sec}s)` : "..."}
    </div>
  );
}
