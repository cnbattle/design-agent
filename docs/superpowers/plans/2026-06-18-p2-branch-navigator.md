# P2: 版本分支对比 — 实施计划

**Goal:** 用户可以保存当前设计为"变体"，在变体间切换对比。

**架构:** 不使用 Pi SDK session 管理（太重型）。直接在浏览器端保存 `FileSnapshot` 快照作为分支点。点击"保存变体"→ 当前文件快照存入数组 → 侧边栏展示分支列表 → 点击切换恢复快照。

**零 worker 变更，零后端变更，纯前端。**

---

### Task 1: 分支管理 Hook

**Files:**
- Create: `lib/use-branches.ts`

一个 React hook 管理分支列表。

- [ ] **Step 1: 创建 use-branches.ts**

```typescript
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

  const saveBranch = useCallback(
    (name: string, files: FileSnapshot) => {
      const id = "b-" + Date.now().toString(36);
      setBranches((prev) => [
        ...prev,
        { id, name, files, timestamp: Date.now() },
      ]);
      return id;
    },
    []
  );

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
```

---

### Task 2: 分支切换 UI

**Files:**
- Create: `components/BranchBar.tsx`
- Modify: `app/page.tsx`

底部或侧边的一个简洁分支切换栏。显示所有分支名，高亮当前分支。

- [ ] **Step 1: 创建 BranchBar.tsx**

```tsx
"use client";

import React from "react";

interface Branch {
  id: string;
  name: string;
  timestamp: number;
}

interface BranchBarProps {
  branches: Branch[];
  activeId: string;
  onSwitch: (id: string) => void;
  onSave: (name: string) => void;
}

export function BranchBar({ branches, activeId, onSwitch, onSave }: BranchBarProps) {
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");

  const handleSave = () => {
    const n = name.trim() || "Variant " + (branches.length);
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
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
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
          <button type="submit" style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: "#6366f1", color: "white", fontSize: 12, cursor: "pointer" }}>Save</button>
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
```

- [ ] **Step 2: 修改 page.tsx**

集成 `useBranches` 和 `BranchBar`。当用户切换分支时，恢复文件快照到 Sandpack。

```tsx
// 在 HomePage 中
const branches = useBranches(currentFilesRef.current);

// 切换分支
const handleSwitchBranch = (id: string) => {
  const files = branches.switchBranch(id);
  if (files) setPendingFiles(files);
};

// 保存变体
const handleSaveVariant = (name: string) => {
  branches.saveBranch(name, currentFilesRef.current);
};

// 渲染
<BranchBar
  branches={branches.branches}
  activeId={branches.activeId}
  onSwitch={handleSwitchBranch}
  onSave={handleSaveVariant}
/>
```

---

### Task 3: 验证

- [ ] **Step 1: 启动并测试**

1. 输入"把标题改成红色" → 预览变红
2. 点击 "+ Save variant" → 命名为"红色版"
3. 输入"把标题改成蓝色" → 预览变蓝
4. 点击 "+ Save variant" → 命名为"蓝色版"
5. 点击"红色版"分支标签 → 预览恢复为红色
6. 点击"蓝色版"分支标签 → 预览恢复为蓝色
7. 新输入指令始终在当前分支基础上修改
