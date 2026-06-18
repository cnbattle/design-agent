"use client";

import React from "react";

interface BranchItem {
  id: string;
  name: string;
  timestamp: number;
}

interface BranchBarProps {
  branches: BranchItem[];
  activeId: string;
  onSwitch: (id: string) => void;
  onSave: (name: string) => void;
}

export function BranchBar({
  branches,
  activeId,
  onSwitch,
  onSave,
}: BranchBarProps) {
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");

  const handleSave = () => {
    const n = name.trim() || "Variant " + branches.length;
    onSave(n);
    setName("");
    setSaving(false);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderTop: "1px solid #e5e7eb",
        background: "#f9fafb",
        fontSize: 12,
        overflowX: "auto",
        whiteSpace: "nowrap",
      }}
    >
      {branches.map((b) => (
        <button
          key={b.id}
          onClick={() => onSwitch(b.id)}
          style={{
            padding: "3px 10px",
            borderRadius: 12,
            border: "none",
            background: b.id === activeId ? "#6366f1" : "#e5e7eb",
            color: b.id === activeId ? "white" : "#374151",
            fontWeight: b.id === activeId ? 600 : 400,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {b.name}
        </button>
      ))}
      {saving ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          style={{ display: "inline-flex", gap: 4 }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Variant name..."
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid #d1d5db",
              fontSize: 12,
              width: 100,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              border: "none",
              background: "#6366f1",
              color: "white",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </form>
      ) : (
        <button
          onClick={() => setSaving(true)}
          style={{
            padding: "3px 10px",
            borderRadius: 12,
            border: "1px dashed #d1d5db",
            background: "transparent",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          + Save variant
        </button>
      )}
    </div>
  );
}
