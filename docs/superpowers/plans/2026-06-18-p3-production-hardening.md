# P3: 生产化 — 实施计划

**Goal:** 拦截写入 Sandpack 的危险代码，防止恶意脚本执行。

---

### Task 1: 写入安全校验

**Files:**
- Modify: `lib/agent-worker.ts`

在自定义工具的 `write` 和 `edit` 执行后、返回前，检查文件内容中是否包含危险模式。

- [ ] **Step 1: 添加校验函数和调用**

```typescript
// 添加到 agent-worker.ts，在工具定义前
const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/, hint: "eval()" },
  { pattern: /document\.cookie/, hint: "document.cookie access" },
  { pattern: /new\s+Function\s*\(/, hint: "new Function()" },
  { pattern: /window\.eval/, hint: "window.eval" },
  { pattern: /setTimeout\s*\(\s*["'`]/, hint: "setTimeout with string" },
];

function checkDangerous(content: string): string | null {
  for (const { pattern, hint } of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) return hint;
  }
  return null;
}

// 在 writeTool 的 execute 中，写入后检查
execute: async (_id, params) => {
  const danger = checkDangerous(params.content);
  if (danger) {
    return {
      content: [{ type: "text", text: `BLOCKED: ${danger} detected in ${params.path}. Remove it and try again.` }],
      details: {},
    };
  }
  fs.writeFile(params.path, params.content);
  return { content: [{ type: "text", text: `Written ${params.path}` }], details: {} };
},

// 在 editTool 中也需要检查结果
// editFile 后检查新内容
```

- [ ] **Step 2: 重新编译 worker**

```bash
cd design-agent && npx tsc lib/agent-worker.ts --outDir lib --module nodenext --moduleResolution nodenext --skipLibCheck --target es2022
```

---

### Task 2: 验证

- [ ] **Step 1: 启动并测试危险代码被拦截**

```bash
# 启动 dev server
cd design-agent && npx next dev --port 3000
```

发送：`Add a script that uses eval to alert("xss")`

预期：Agent 报告被拦截，不会写入文件。

- [ ] **Step 2: 正常功能不受影响**

发送：`Make the background light gray`

预期：正常修改 styles.css，预览更新。
