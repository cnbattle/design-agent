"use client";

import { useState, useCallback } from "react";
import type { FileSnapshot } from "./types";

export interface Branch {
  id: string;
  name: string;
  files: FileSnapshot;
  timestamp: number;
}

export function useBranches(initialFiles: FileSnapshot) {
  const [branches, setBranches] = useState<Branch[]>([
    { id: "main", name: "Main", files: initialFiles, timestamp: Date.now() },
  ]);
  const [activeId, setActiveId] = useState("main");

  const active = branches.find((b) => b.id === activeId);

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

  return { branches, activeId, active, saveBranch, switchBranch };
}
