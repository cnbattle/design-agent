# Design Agent

AI 驱动的设计工具 — 通过聊天与 AI 代理交互，快速构建和迭代 UI，支持实时预览和分支版本管理。

## 工作原理

1. 在聊天面板中描述你想构建或修改的内容
2. AI 代理自动编辑代码，通过 Sandpack 实时预览效果
3. 将不同方案保存为分支，随时切换对比

## 快速开始

```bash
npm install
npm run dev
# → http://localhost:3000
```

需要配置 Pi AI 提供方 — 参考 [Pi 文档](https://github.com/earendil-works/pi-coding-agent)。

## 技术栈

- [Next.js](https://nextjs.org/)（App Router）
- [Sandpack](https://sandpack.codesandbox.io/) — 实时代码预览
- [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) — AI 代理
- Tailwind CSS、TypeScript
