"use client";

import { useState, useCallback } from "react";
import type { FileSnapshot } from "./types";

export interface Branch {
  id: string;
  name: string;
  files: FileSnapshot;
  timestamp: number;
}

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = activeId ? branches.find((b) => b.id === activeId) : null;

  const initMain = useCallback((files: FileSnapshot) => {
    setBranches([{ id: "main", name: "Main", files, timestamp: Date.now() }]);
    setActiveId("main");
  }, []);

  const saveBranch = useCallback((name: string, files: FileSnapshot) => {
    const id = "b-" + Date.now().toString(36);
    setBranches((prev) => [
      ...prev,
      { id, name, files, timestamp: Date.now() },
    ]);
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

  return { branches, activeId, active, initMain, saveBranch, switchBranch };
}
