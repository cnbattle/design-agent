# Design Agent

AI-powered design tool — chat with an agent to build and iterate UI, with live preview and branch-based versioning.

## How it works

1. Describe what you want to build or change in the chat panel
2. The agent edits code, you see a live preview via Sandpack
3. Save variants as branches, switch between them anytime

## Quick start

```bash
npm install
npm run dev
# → http://localhost:3000
```

Requires a Pi AI provider configured — see [Pi docs](https://github.com/earendil-works/pi-coding-agent).

## Stack

- [Next.js](https://nextjs.org/) (App Router)
- [Sandpack](https://sandpack.codesandbox.io/) — live code preview
- [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent) — AI agent
- Tailwind CSS, TypeScript
