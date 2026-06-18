/**
 * Minimal verification for VirtualFS.
 * Run: npx tsx lib/virtual-fs.test.ts
 */
import { VirtualFS } from "./virtual-fs";
import type { FileSnapshot } from "./types";

const initial: FileSnapshot = {
  "/App.tsx": "export default function App() { return <h1>Hi</h1>; }",
  "/styles.css": "h1 { color: red; }",
};

const fs = new VirtualFS(initial);

// readFile
const app = fs.readFile("/App.tsx");
console.assert(app !== null, "readFile should return content");
console.assert(app?.includes("Hi"), "readFile should contain expected text");

// readFile missing
const missing = fs.readFile("/nope.tsx");
console.assert(missing === null, "readFile missing returns null");

// writeFile
fs.writeFile("/Button.tsx", "export default function Button() {}");
console.assert(fs.readFile("/Button.tsx") !== null, "writeFile should create");
console.assert(fs.changed.includes("/Button.tsx"), "writeFile should track change");

// editFile
const ok = fs.editFile("/App.tsx", "Hi", "Hello");
console.assert(ok === true, "editFile should succeed");
console.assert(
  fs.readFile("/App.tsx")?.includes("Hello") === true,
  "editFile should replace content"
);
console.assert(fs.changed.includes("/App.tsx"), "editFile should track change");

// editFile non-existent oldStr
const fail = fs.editFile("/App.tsx", "Bogus", "X");
console.assert(fail === false, "editFile with no match returns false");

// ls
const rootFiles = fs.ls("/");
console.assert(rootFiles.length === 3, "ls / should return 3 files");

// snapshot
const snap = fs.snapshot();
console.assert(snap["/App.tsx"] !== undefined, "snapshot should include /App.tsx");
console.assert(snap["/Button.tsx"] !== undefined, "snapshot should include /Button.tsx");

console.log("All VirtualFS checks passed.");
