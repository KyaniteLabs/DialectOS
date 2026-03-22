import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/types",
  "packages/security",
  "packages/providers",
  "packages/markdown-parser",
  "packages/locale-utils",
  "packages/cli",
  "packages/mcp",
]);
