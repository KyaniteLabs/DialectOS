/**
 * Configuration system for MCP server
 * Priority: CLI flags > env vars > config file > defaults
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const configSchema = z.object({
  rateLimit: z.object({
    maxRequests: z.number().int().min(1).default(60),
    windowMs: z.number().int().min(1000).default(60000),
  }).default({ maxRequests: 60, windowMs: 60000 }),
  security: z.object({
    maxFileSize: z.number().int().min(1024).default(512 * 1024),
    maxContentLength: z.number().int().min(1000).default(50000),
    allowedDirs: z.array(z.string()).default([]),
  }).default({ maxFileSize: 512 * 1024, maxContentLength: 50000, allowedDirs: [] }),
  logging: z.object({
    level: z.enum(["error", "warn", "info", "debug"]).default("error"),
  }).default({ level: "error" }),
});

export type MCPConfig = z.infer<typeof configSchema>;

function parsePositiveIntEnv(name: string, value: string, min: number): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`Invalid MCP config env ${name}: expected integer >= ${min}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(`Invalid MCP config env ${name}: expected integer >= ${min}`);
  }
  return parsed;
}

/**
 * Load configuration with priority: env vars > config file > defaults
 */
export function loadConfig(configPath?: string): MCPConfig {
  const config = configSchema.parse({});

  // 1. Load from config file
  if (configPath && existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const fileConfig = configSchema.parse(JSON.parse(raw));
      Object.assign(config, fileConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid MCP config at ${configPath}: ${message}`);
    }
  }

  // 2. Override from environment variables
  if (process.env.ESPANOL_RATE_LIMIT) {
    const parts = process.env.ESPANOL_RATE_LIMIT.split(",");
    if (parts.length !== 2) {
      throw new Error("Invalid MCP config env ESPANOL_RATE_LIMIT: expected <maxRequests>,<windowMs>");
    }
    config.rateLimit.maxRequests = parsePositiveIntEnv("ESPANOL_RATE_LIMIT", parts[0], 1);
    config.rateLimit.windowMs = parsePositiveIntEnv("ESPANOL_RATE_LIMIT", parts[1], 1000);
  }

  if (process.env.ESPANOL_MAX_FILE_SIZE) {
    config.security.maxFileSize = parsePositiveIntEnv("ESPANOL_MAX_FILE_SIZE", process.env.ESPANOL_MAX_FILE_SIZE, 1024);
  }

  if (process.env.ESPANOL_MAX_CONTENT_LENGTH) {
    config.security.maxContentLength = parsePositiveIntEnv("ESPANOL_MAX_CONTENT_LENGTH", process.env.ESPANOL_MAX_CONTENT_LENGTH, 1000);
  }

  if (process.env.ALLOWED_LOCALE_DIRS) {
    config.security.allowedDirs = process.env.ALLOWED_LOCALE_DIRS.split(",").map(s => s.trim()).filter(Boolean);
  }

  if (process.env.ESPANOL_LOG_LEVEL) {
    const validLevels = ["error", "warn", "info", "debug"] as const;
    const level = process.env.ESPANOL_LOG_LEVEL;
    if (validLevels.includes(level as typeof validLevels[number])) {
      config.logging.level = level as MCPConfig["logging"]["level"];
    }
  }

  return config;
}

/**
 * Get config file path from CLI args (--config <path>)
 */
export function getConfigPath(): string | undefined {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf("--config");
  if (configIndex !== -1 && configIndex + 1 < args.length) {
    return resolve(args[configIndex + 1]);
  }
  return undefined;
}
