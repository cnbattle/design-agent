"use client";

import { useState, useCallback, useEffect } from "react";
import type { FileSnapshot } from "./types";

const LS_KEY = "da-branches";

export interface Branch {
  id: string;
  name: string;
  files: FileSnapshot;
  timestamp: number;
}

interface SavedState {
  branches: Branch[];
  activeId: string | null;
}

function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function useBranches() {
  const saved = loadState();
  const [branches, setBranches] = useState<Branch[]>(saved?.branches ?? []);
  const [activeId, setActiveId] = useState<string | null>(saved?.activeId ?? null);
  const [hydrated, setHydrated] = useState(!!saved);

  // Persist whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ branches, activeId }));
    } catch {}
  }, [branches, activeId]);

  const active = activeId ? branches.find((b) => b.id === activeId) : null;

  const initMain = useCallback((files: FileSnapshot) => {
    // Skip if already hydrated from localStorage
    if (hydrated) return;
    setBranches([{ id: "main", name: "Main", files, timestamp: Date.now() }]);
    setActiveId("main");
  }, [hydrated]);

  const saveBranch = useCallback((name: string, files: FileSnapshot) => {
    const id = "b-" + Date.now().toString(36);
    setBranches((prev) => [
      ...prev,
      { id, name, files, timestamp: Date.now() },
    ]);
    setActiveId(id);
    return id;
  }, []);

  const switchBranch = useCallback(
    (id: string) => {
      const target = branches.find((b) => b.id === id);
      if (target) {
        setActiveId(id);
        return target.files;
      }
      return null;
    },
    [branches]
  );

  const currentFiles = active?.files ?? null;

  return { branches, activeId, active, currentFiles, initMain, saveBranch, switchBranch, hydrated };
}
