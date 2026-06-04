/**
 * MCP Tools for i18n Operations
 *
 * Provides 6 MCP tools:
 * - detect_missing_keys: Compare two locale files, report missing keys
 * - translate_missing_keys: Translate missing keys from base to target locale
 * - batch_translate_locales: Translate base locale to multiple target dialects
 * - manage_dialect_variants: Create dialect-specific variants
 * - check_formality: Check locale file for formality consistency
 * - apply_gender_neutral: Apply gender-neutral language strategies
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type {
  SpanishDialect,
  ProviderName,
  I18nEntry,
  FormalityIssue,
  GenderNeutralStrategy,
} from "@dialectos/types";
import { dialectSchema, providerNameSchema, ALL_SPANISH_DIALECTS } from "@dialectos/types";
import {
  readLocaleFile,
  writeLocaleFile,
  diffLocales,
} from "@dialectos/locale-utils";
import {
  validateJsonPath,
  validateFilePath,
  validateContentLength,
  RateLimiter,
  SecurityError,
  ErrorCode,
  createSafeError,
  MAX_ARRAY_LENGTH,
} from "@dialectos/security";
import {
  ProviderRegistry,
} from "@dialectos/providers";
import { ToolResult } from "../lib/types.js";
import { createProviderRegistry } from "@dialectos/providers";
import type { TranslateOptions } from "@dialectos/types";
import { registerScoredTool } from "./metadata.js";

// ============================================================================
// Types
// ============================================================================

interface DetectMissingKeysParams {
  basePath: string;
  targetPath: string;
}

interface TranslateMissingKeysParams {
  basePath: string;
  targetPath: string;
  dialect?: SpanishDialect;
  provider?: ProviderName;
}

interface BatchTranslateLocalesParams {
  directory: string;
  baseLocale?: string;
  targets: SpanishDialect[];
  provider?: ProviderName;
}

interface ManageDialectVariantsParams {
  sourcePath: string;
  variant: SpanishDialect;
  outputPath?: string;
}

interface CheckFormalityParams {
  localePath: string;
  register?: "formal" | "informal";
}

interface ApplyGenderNeutralParams {
  localePath: string;
  strategy?: GenderNeutralStrategy;
}

// ============================================================================
// Dialect Adaptation Maps
// ============================================================================

/**
 * Region-specific vocabulary replacements for major Spanish dialects
 */
const DIALECT_ADAPTATIONS: Record<string, Record<string, string>> = {
  "es-MX": {
    "ordenador": "computadora",
    "coche": "auto",
    "aparcar": "estacionar",
    "autobús": "camión",
    "patata": "papa",
    "zumbar": "llamar",
    "pastel": "pastel",
    "piso": "departamento",
    "bañarse": "bañarse",
    "coger": "agarrar",
    "prisas": "prisas",
    "dinero": "dinero",
  },
  "es-AR": {
    "ordenador": "computadora",
    "coche": "auto",
    "aparcar": "estacionar",
    "autobús": "colectivo",
    "patata": "papa",
    "zumbar": "llamar",
    "pastel": "torta",
    "piso": "departamento",
    "bañarse": "ducharse",
    "coger": "tomar",
    "prisas": "apuro",
    "dinero": "plata",
  },
  "es-CO": {
    "ordenador": "computador",
    "coche": "carro",
    "aparcar": "parquear",
    "autobús": "bus",
    "patata": "papa",
    "zumbar": "llamar",
    "pastel": "pastel",
    "piso": "apartamento",
    "bañarse": "bañarse",
    "coger": "tomar",
    "prisas": "prisa",
    "dinero": "dinero",
  },
  "es-GQ": {
    "ordenador": "computadora",
    "coche": "carro",
    "móvil": "celular",
    "patata": "papa",
    "gafas": "lentes",
  },
  "es-US": {
    "ordenador": "computadora",
    "coche": "carro",
    "móvil": "celular",
    "patata": "papa",
    "gafas": "lentes",
  },
  "es-PH": {
    "ordenador": "computadora",
    "coche": "carro",
    "móvil": "celular",
    "patata": "papa",
    "gafas": "lentes",
  },
  "es-BZ": {
    "ordenador": "computadora",
    "coche": "carro",
    "móvil": "celular",
    "patata": "papa",
    "gafas": "lentes",
  },
  "es-AD": {
    "ordenador": "computadora",
    "coche": "carro",
    "móvil": "celular",
    "patata": "papa",
    "gafas": "lentes",
  },
};

// ============================================================================
// Formality Detection Patterns
// ============================================================================

/**
 * Informal pronouns and verb forms
 */
const INFORMAL_PATTERNS = [
  /\b(tú|vos|vosotros)\b/gi,
  /\b(estás|vais|tenéis|sois|vais)\b/gi,
  /\b(eres|tienes|vienes|sales|haces|dices|ves|oyes)\b/gi,
];

/**
 * Formal pronouns and verb forms
 */
const FORMAL_PATTERNS = [
  /\b(usted|ustedes)\b/gi,
  /\b(está|van|tienen|son|están)\b/gi,
];

// ============================================================================
// Gender Neutral Transformations
// ============================================================================

/**
 * Gender-neutral transformation patterns by strategy
 */
const GENDER_NEUTRAL_TRANSFORMS: Record<
  GenderNeutralStrategy,
  Record<string, string>
> = {
  latine: {
    "todos": "todes",
    "todas": "todes",
    "todos y todas": "todes",
    "bienvenidos": "bienvenides",
    "bienvenidas": "bienvenides",
    "usuarios": "usuaries",
    "amigos": "amigues",
    "niños": "niñes",
    "alumnos": "alumnes",
    "profesores": "docentes",
    "trabajadores": "trabajadores",
    "empleados": "empleades",
  },
  elles: {
    "todos": "elles",
    "todas": "elles",
    "todos y todas": "elles",
    "bienvenidos": "bienvenides",
    "bienvenidas": "bienvenides",
    "usuarios": "usuaris",
    "amigos": "amiguis",
    "niños": "niñis",
    "alumnos": "alumnes",
    "profesores": "profesoris",
    "trabajadores": "trabajadores",
    "empleados": "empleados",
  },
  x: {
    "todos": "todxs",
    "todas": "todxs",
    "todos y todas": "todxs",
    "bienvenidos": "bienvenidxs",
    "bienvenidas": "bienvenidxs",
    "usuarios": "usuarixs",
    "amigos": "amigxs",
    "niños": "niñxs",
    "alumnos": "alumnes",
    "profesores": "profesores",
    "trabajadores": "trabajadores",
    "empleados": "empleades",
  },
  descriptive: {
    "todos": "todas y todos",
    "todas": "todas y todos",
    "todos y todas": "todas y todos",
    "bienvenidos": "bienvenidos y bienvenidas",
    "bienvenidas": "bienvenidos y bienvenidas",
    "usuarios": "usuarios y usuarias",
    "amigos": "amigos y amigas",
    "niños": "niños y niñas",
    "alumnos": "alumnos y alumnas",
    "profesores": "profesores y profesoras",
    "trabajadores": "trabajadores y trabajadoras",
    "empleados": "empleados y empleadas",
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle detect_missing_keys tool
 */
async function handleDetectMissingKeys(
  params: DetectMissingKeysParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate paths
    const basePath = validateJsonPath(params.basePath, {
      mustExist: true,
      checkSize: true,
    });
    const targetPath = validateJsonPath(params.targetPath, {
      mustExist: true,
      checkSize: true,
    });

    // Read locale files
    const baseEntries = readLocaleFile(basePath);
    const targetEntries = readLocaleFile(targetPath);

    // Compare locales
    const diff = diffLocales(baseEntries, targetEntries);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            missingInTarget: diff.missingInTarget,
            extraInTarget: diff.extraInTarget,
            commonKeys: diff.commonKeys,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle translate_missing_keys tool
 */
async function handleTranslateMissingKeys(
  params: TranslateMissingKeysParams,
  registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate paths
    const basePath = validateJsonPath(params.basePath, {
      mustExist: true,
      checkSize: true,
    });
    const targetPath = validateJsonPath(params.targetPath, {
      mustExist: true,
      checkSize: true,
    });

    // Read locale files
    const baseEntries = readLocaleFile(basePath);
    const targetEntries = readLocaleFile(targetPath);

    // Find missing keys
    const diff = diffLocales(baseEntries, targetEntries);
    const missingKeys = diff.missingInTarget;

    if (missingKeys.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              translatedCount: 0,
              missingKeys: [],
            }),
          },
        ],
      };
    }

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto("es", { dialect: params.dialect || "es-ES" });

    // Translate missing keys
    let translatedCount = 0;
    const errors: string[] = [];
    const updatedTargetEntries = [...targetEntries];

    for (const key of missingKeys) {
      const baseEntry = baseEntries.find((e) => e.key === key);
      if (!baseEntry) continue;

      try {
        const prepared = registry.prepareRequest(
          provider.name,
          baseEntry.value,
          "en",
          params.dialect || "es-ES",
          { dialect: params.dialect }
        );
        const result = await provider.translate(
          baseEntry.value,
          prepared.sourceLang,
          prepared.targetLang,
          prepared.options
        );

        updatedTargetEntries.push({
          key,
          value: result.translatedText,
        });
        translatedCount++;
      } catch (error) {
        const safe = createSafeError(error);
        errors.push(`${key}: ${safe.error}`);
      }
    }

    // Write updated target file
    writeLocaleFile(targetPath, updatedTargetEntries);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            translatedCount,
            missingKeys,
            errors,
            skippedCount: errors.length,
          }),
        },
      ],
      isError: translatedCount === 0 && missingKeys.length > 0 && errors.length > 0,
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle batch_translate_locales tool
 */
async function handleBatchTranslateLocales(
  params: BatchTranslateLocalesParams,
  registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate targets array length
    if (params.targets.length > MAX_ARRAY_LENGTH) {
      throw new SecurityError(
        `Cannot exceed ${MAX_ARRAY_LENGTH} target dialects`,
        ErrorCode.VALIDATION_FAILED
      );
    }

    // Validate directory
    const directory = validateFilePath(params.directory);

    // Verify directory exists and is actually a directory
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      throw new SecurityError(
        `Directory does not exist or is not a directory: ${directory}`,
        ErrorCode.INVALID_PATH
      );
    }

    // Determine base locale file
    const baseLocale = params.baseLocale || "en";
    const basePath = join(directory, `${baseLocale}.json`);

    // Read base locale
    const baseEntries = readLocaleFile(basePath);
    const totalKeys = baseEntries.length;

    // Get provider — use first target dialect for dialect-aware selection
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto("es", { dialect: params.targets[0] || "es-ES" });

    let totalTranslated = 0;
    const errors: string[] = [];
    const targets: string[] = [];

    // Translate to each target dialect
    for (const targetDialect of params.targets) {
      try {
        const targetPath = join(directory, `${targetDialect}.json`);

        // Read existing target or create new
        let targetEntries: I18nEntry[] = [];
        try {
          targetEntries = readLocaleFile(targetPath);
        } catch {
          // File doesn't exist, start with empty
        }

        // Find missing keys
        const existingKeys = new Set(targetEntries.map((e) => e.key));
        const missingEntries = baseEntries.filter((e) => !existingKeys.has(e.key));

        // Translate missing keys
        for (const entry of missingEntries) {
          try {
            const prepared = registry.prepareRequest(
              provider.name,
              entry.value,
              "en",
              targetDialect,
              { dialect: targetDialect }
            );
            const result = await provider.translate(
              entry.value,
              prepared.sourceLang,
              prepared.targetLang,
              prepared.options
            );

            targetEntries.push({
              key: entry.key,
              value: result.translatedText,
            });
            totalTranslated++;
          } catch (error) {
            const safe = createSafeError(error);
            errors.push(`${targetDialect}/${entry.key}: ${safe.error}`);
          }
        }

        // Write target file
        writeLocaleFile(targetPath, targetEntries);
        targets.push(targetDialect);
      } catch (error) {
        const safe = createSafeError(error);
        errors.push(`${targetDialect}: ${safe.error}`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            totalKeys,
            totalTranslated,
            targets,
            errors,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle manage_dialect_variants tool
 */
async function handleManageDialectVariants(
  params: ManageDialectVariantsParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate source path
    const sourcePath = validateJsonPath(params.sourcePath, {
      mustExist: true,
      checkSize: true,
    });

    // Read source locale
    const sourceEntries = readLocaleFile(sourcePath);

    // Get dialect adaptations
    const adaptations = DIALECT_ADAPTATIONS[params.variant];
    if (!adaptations) {
      // No adaptations for this dialect (e.g., es-ES is base)
      const outputPath = params.outputPath || sourcePath;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              adapted: false,
              changes: [],
            }),
          },
        ],
      };
    }

    // Apply adaptations
    const changes: string[] = [];
    const adaptedEntries = sourceEntries.map((entry) => {
      let newValue = entry.value;
      for (const [source, target] of Object.entries(adaptations)) {
        const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        if (regex.test(newValue)) {
          newValue = newValue.replace(regex, target);
          changes.push(`${entry.key}: ${source} -> ${target}`);
        }
      }
      return { ...entry, value: newValue };
    });

    // Write output
    const outputPath = params.outputPath || sourcePath;
    writeLocaleFile(outputPath, adaptedEntries);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            adapted: changes.length > 0,
            changes,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle check_formality tool
 */
async function handleCheckFormality(
  params: CheckFormalityParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate path
    const localePath = validateJsonPath(params.localePath, {
      mustExist: true,
      checkSize: true,
    });

    // Read locale file
    const entries = readLocaleFile(localePath);

    // Determine register to check
    const register = params.register || "formal";

    // Check formality consistency
    const issues: FormalityIssue[] = [];

    for (const entry of entries) {
      const value = entry.value;

      if (register === "formal") {
        // Check for informal patterns in formal register
        for (const pattern of INFORMAL_PATTERNS) {
          const matches = value.match(pattern);
          if (matches) {
            issues.push({
              key: entry.key,
              value,
              suggestion: `Found informal pronoun/verb "${matches[0]}". Use formal form (usted/ustedes) instead.`,
            });
          }
        }
      } else {
        // Check for formal patterns in informal register
        for (const pattern of FORMAL_PATTERNS) {
          const matches = value.match(pattern);
          if (matches) {
            issues.push({
              key: entry.key,
              value,
              suggestion: `Found formal pronoun "${matches[0]}". Use informal form (tú/vos) instead.`,
            });
          }
        }
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            totalKeys: entries.length,
            issues,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle apply_gender_neutral tool
 */
async function handleApplyGenderNeutral(
  params: ApplyGenderNeutralParams,
  _registry: ProviderRegistry,
  rateLimiter: RateLimiter
): Promise<ToolResult> {
  try {
    // Rate limit check
    await rateLimiter.acquire();

    // Validate path
    const localePath = validateJsonPath(params.localePath, {
      mustExist: true,
      checkSize: true,
    });

    // Read locale file
    const entries = readLocaleFile(localePath);

    // Get strategy
    const strategy = params.strategy || "latine";
    const transforms = GENDER_NEUTRAL_TRANSFORMS[strategy];

    if (!transforms) {
      throw new SecurityError(
        `Invalid gender-neutral strategy: ${strategy}`,
        ErrorCode.INVALID_INPUT
      );
    }

    // Apply transformations
    const changes: string[] = [];
    const adaptedEntries = entries.map((entry) => {
      let newValue = entry.value;
      for (const [source, target] of Object.entries(transforms)) {
        const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        if (regex.test(newValue)) {
          newValue = newValue.replace(regex, target);
          changes.push(`${entry.key}: ${source} -> ${target}`);
        }
      }
      return { ...entry, value: newValue };
    });

    // Write back
    writeLocaleFile(localePath, adaptedEntries);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            adapted: changes.length > 0,
            changes,
          }),
        },
      ],
    };
  } catch (error) {
    const safeError = createSafeError(error);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: safeError.code,
            message: safeError.error,
          }),
        },
      ],
      isError: true,
    };
  }
}

// ============================================================================
// Tool Registration
// ============================================================================

/**
 * Register all i18n tools with the MCP server
 */
export function registerI18nTools(
  server: McpServer,
  options: { registry?: ProviderRegistry; rateLimiter?: RateLimiter } = {}
): void {
  // Create registry if not provided
  const registry = options.registry || createProviderRegistry();

  // Create rate limiter if not provided
  const rateLimiter = options.rateLimiter || new RateLimiter(60, 60000);

  // Register detect_missing_keys tool
  registerScoredTool(
    server,
    "detect_missing_keys",
    {
      title: "Detect missing locale keys",
      description:
        "Compare a base JSON locale file against a target JSON locale file and return keys present in the base but absent from the target. Reads both files only; it does not translate, create, or modify locale files.",
      inputSchema: {
        basePath: z.string().min(1).describe("Absolute or workspace-relative path to the complete base JSON locale file, such as locales/en.json."),
        targetPath: z.string().min(1).describe("Absolute or workspace-relative path to the target JSON locale file to audit, such as locales/es-MX.json."),
      },
      annotations: {
        title: "Detect missing locale keys",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      return handleDetectMissingKeys(params as DetectMissingKeysParams, registry, rateLimiter);
    }
  );

  // Register translate_missing_keys tool
  registerScoredTool(
    server,
    "translate_missing_keys",
    {
      title: "Translate missing locale keys",
      description:
        "Fill a target JSON locale file with translated values for keys that exist in the base locale but are missing from the target. Reads both files and writes the updated target file; existing target keys are preserved.",
      inputSchema: {
        basePath: z.string().min(1).describe("Path to the source JSON locale file that contains the canonical key set and source-language values."),
        targetPath: z.string().min(1).describe("Path to the JSON locale file to update with translated missing keys. This file may be modified in place."),
        dialect: dialectSchema.optional().describe("Target Spanish dialect code. Defaults to es-ES when omitted; examples include es-MX, es-AR, and es-CO."),
        provider: providerNameSchema.optional().describe("Translation provider to use. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
      },
      annotations: {
        title: "Translate missing locale keys",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      return handleTranslateMissingKeys(params as TranslateMissingKeysParams, registry, rateLimiter);
    }
  );

  // Register batch_translate_locales tool
  registerScoredTool(
    server,
    "batch_translate_locales",
    {
      title: "Batch translate locale files",
      description:
        "Create or update multiple Spanish JSON locale files from one base locale file in a directory. For each target dialect it writes <dialect>.json, preserves existing translated keys, translates only missing keys, and returns per-target errors without deleting files.",
      inputSchema: {
        directory: z.string().min(1).describe("Directory containing locale JSON files. The base file is read from this directory and target files are written here."),
        baseLocale: z.string().min(1).optional().describe("Base locale filename without .json. Defaults to en, so the default source file is en.json."),
        targets: z.array(z.string().refine((v) => ALL_SPANISH_DIALECTS.includes(v as SpanishDialect), {
          message: "Invalid Spanish dialect code",
        })).min(1).max(MAX_ARRAY_LENGTH).describe("One or more target Spanish dialect codes to generate or update, such as es-MX, es-AR, or es-CO."),
        provider: providerNameSchema.optional().describe("Translation provider to use for all targets. Omit for automatic provider selection; valid values include llm, deepl, libre, and mymemory."),
      },
      annotations: {
        title: "Batch translate locale files",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      return handleBatchTranslateLocales(params as BatchTranslateLocalesParams, registry, rateLimiter);
    }
  );

  // Register manage_dialect_variants tool
  registerScoredTool(
    server,
    "manage_dialect_variants",
    {
      title: "Create dialect locale variant",
      description:
        "Apply deterministic regional vocabulary substitutions to a JSON locale file for a specific Spanish dialect. Writes the adapted locale to outputPath when provided; otherwise overwrites sourcePath.",
      inputSchema: {
        sourcePath: z.string().min(1).describe("Path to the source JSON locale file whose string values should be adapted."),
        variant: z.string().refine((v) => ALL_SPANISH_DIALECTS.includes(v as SpanishDialect), {
          message: "Invalid Spanish dialect variant",
        }).describe("Target Spanish dialect variant for regional vocabulary adaptation, such as es-MX, es-AR, or es-CO."),
        outputPath: z.string().min(1).optional().describe("Destination JSON file. Omit to update the source file in place."),
      },
      annotations: {
        title: "Create dialect locale variant",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      return handleManageDialectVariants(params as ManageDialectVariantsParams, registry, rateLimiter);
    }
  );

  // Register check_formality tool
  registerScoredTool(
    server,
    "check_formality",
    {
      title: "Check locale formality",
      description:
        "Audit a JSON locale file for Spanish register consistency by flagging informal tú/vos patterns in formal copy or usted patterns in informal copy. Reads the locale file and returns issue objects; it does not rewrite text.",
      inputSchema: {
        localePath: z.string().min(1).describe("Path to the JSON locale file to inspect for formality issues."),
        register: z.enum(["formal", "informal"]).optional().describe("Expected register for the locale copy. Defaults to formal when omitted."),
      },
      annotations: {
        title: "Check locale formality",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      return handleCheckFormality(params as CheckFormalityParams, registry, rateLimiter);
    }
  );

  // Register apply_gender_neutral tool
  registerScoredTool(
    server,
    "apply_gender_neutral",
    {
      title: "Apply gender-neutral locale language",
      description:
        "Rewrite a JSON locale file using one gender-neutral Spanish strategy. This modifies the locale file in place and returns a count of changed entries; it does not call a translation provider.",
      inputSchema: {
        localePath: z.string().min(1).describe("Path to the JSON locale file to adapt in place."),
        strategy: z.enum(["latine", "elles", "x", "descriptive"]).optional().describe("Gender-neutral strategy. Defaults to latine; options are latine, elles, x, and descriptive."),
      },
      annotations: {
        title: "Apply gender-neutral locale language",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      return handleApplyGenderNeutral(params as ApplyGenderNeutralParams, registry, rateLimiter);
    }
  );
}
