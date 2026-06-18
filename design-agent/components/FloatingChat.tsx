"use client";

import React, { useState, useRef, useEffect } from "react";

interface FloatingChatProps {
  onSend: (message: string) => void;
  loading?: boolean;
  lastResponse?: string;
}

export function FloatingChat({
  onSend,
  loading = false,
  lastResponse,
}: FloatingChatProps) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track assistant responses
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

  return (
    <div className="chat-container">
      {/* Header */}
      <div
        className="chat-header"
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding: "10px 14px",
          fontWeight: 600,
          cursor: "pointer",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          userSelect: "none",
        }}
      >
        <span>Design Agent</span>
        <span style={{ fontSize: 12, opacity: 0.5 }}>
          {expanded ? "▼" : "▲"}
        </span>
      </div>

      {/* Messages */}
      {expanded && (
        <div
          className="chat-messages"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minHeight: 0,
          }}
        >
          {messages.length === 0 && (
            <p
              style={{
                color: "#999",
                fontSize: 13,
                textAlign: "center",
                marginTop: 20,
              }}
            >
              Ask me to change the design...
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.4,
                maxWidth: "85%",
                alignSelf:
                  msg.role === "user" ? "flex-end" : "flex-start",
                background:
                  msg.role === "user" ? "#6366f1" : "#f3f4f6",
                color: msg.role === "user" ? "white" : "#1f2937",
              }}
            >
              {msg.text}
            </div>
          ))}
          {loading && (
            <div
              style={{
                alignSelf: "flex-start",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                background: "#f3f4f6",
                color: "#999",
              }}
            >
              Thinking...
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          borderTop: "1px solid #e5e7eb",
          padding: "8px",
          gap: "6px",
        }}
      >
        <textarea
          ref={inputRef}
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
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 13,
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background:
              loading || !input.trim() ? "#d1d5db" : "#6366f1",
            color: "white",
            fontWeight: 600,
            fontSize: 13,
            cursor:
              loading || !input.trim() ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
