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
}).default({});

export type MCPConfig = z.infer<typeof configSchema>;

const DEFAULT_CONFIG: MCPConfig = configSchema.parse({});

/**
 * Load configuration with priority: env vars > config file > defaults
 */
export function loadConfig(configPath?: string): MCPConfig {
  const config = { ...DEFAULT_CONFIG };

  // 1. Load from config file
  if (configPath && existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const fileConfig = configSchema.parse(JSON.parse(raw));
      Object.assign(config, fileConfig);
    } catch {
      // Use defaults if config file is invalid
    }
  }

  // 2. Override from environment variables
  if (process.env.ESPANOL_RATE_LIMIT) {
    const [max, window] = process.env.ESPANOL_RATE_LIMIT.split(",");
    config.rateLimit.maxRequests = parseInt(max, 10) || 60;
    config.rateLimit.windowMs = parseInt(window, 10) || 60000;
  }

  if (process.env.ESPANOL_MAX_FILE_SIZE) {
    config.security.maxFileSize = parseInt(process.env.ESPANOL_MAX_FILE_SIZE, 10) || 512 * 1024;
  }

  if (process.env.ESPANOL_MAX_CONTENT_LENGTH) {
    config.security.maxContentLength = parseInt(process.env.ESPANOL_MAX_CONTENT_LENGTH, 10) || 50000;
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
