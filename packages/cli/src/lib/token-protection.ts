import { promises as fs } from "node:fs";

export interface TokenProtectionFile {
  tokens: string[];
}

export interface ProtectedTextResult {
  text: string;
  replacements: Map<string, string>;
}

export async function loadProtectedTokens(filePath?: string): Promise<string[]> {
  if (!filePath) {
    return [];
  }

  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as TokenProtectionFile | string[];

  const tokens = Array.isArray(parsed) ? parsed : parsed.tokens;
  if (!Array.isArray(tokens)) {
    throw new Error("Invalid protect-tokens file format: expected array or { tokens: [] }");
  }

  return tokens
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

export function protectTokensInText(text: string, tokens: string[]): ProtectedTextResult {
  let protectedText = text;
  const replacements = new Map<string, string>();

  tokens.forEach((token, idx) => {
    if (!token || !protectedText.includes(token)) {
      return;
    }
    const placeholder = `__ESPANOL_TOKEN_${idx}__`;
    replacements.set(placeholder, token);
    protectedText = protectedText.split(token).join(placeholder);
  });

  return { text: protectedText, replacements };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function restoreProtectedTokens(text: string, replacements: Map<string, string>): string {
  let restored = text;
  replacements.forEach((token, placeholder) => {
    restored = restored.split(placeholder).join(token);
    // Some providers normalize placeholders (e.g. "__ESPANOL_GLOSS_6__" -> "ESPANOL GLOSS 6")
    const base = escapeRegExp(placeholder.replace(/^_+|_+$/g, ""));
    const normalized = base.replace(/_/g, "[_\\s]*");
    const regex = new RegExp(`\\b${normalized}\\b`, "g");
    restored = restored.replace(regex, token);
  });
  return restored;
}

export function detectIdentityTokens(text: string): string[] {
  const tokens = new Set<string>();

  const patterns: RegExp[] = [
    /@[a-zA-Z0-9_.-]{3,}/g, // handles
    /\b[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}\b/g, // domains
    /\b[a-zA-Z0-9_-]{3,}\/[a-zA-Z0-9_.-]{2,}\b/g, // repo-like owner/name
    /(?:^|[^\w])([a-zA-Z0-9_-]{6,}\d{2,})(?:$|[^\w])/g, // usernames with numeric suffixes
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    matches.forEach((match) => tokens.add(match.trim()));
  }

  return Array.from(tokens).sort((a, b) => b.length - a.length);
}
