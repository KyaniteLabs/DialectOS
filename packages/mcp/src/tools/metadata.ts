import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

type ToolHandler = (params: any) => unknown;

type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

type ScoredToolConfig = {
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  annotations: ToolAnnotations;
};

type RegisterableServer = McpServer & {
  registerTool?: (name: string, config: ScoredToolConfig, handler: ToolHandler) => void;
  tool?: (
    name: string,
    description: string,
    inputSchema: z.ZodRawShape,
    handler: ToolHandler
  ) => void;
};

export function registerScoredTool(
  server: McpServer,
  name: string,
  config: ScoredToolConfig,
  handler: ToolHandler
): void {
  const registerable = server as RegisterableServer;

  if (typeof registerable.registerTool === "function") {
    registerable.registerTool(name, config, handler);
    return;
  }

  registerable.tool?.(name, config.description, config.inputSchema, handler);
}
