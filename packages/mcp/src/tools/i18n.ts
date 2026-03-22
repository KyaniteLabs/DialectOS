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
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type {
  SpanishDialect,
  ProviderName,
  I18nEntry,
  LocaleDiff,
  FormalityIssue,
  GenderNeutralStrategy,
  VariantResult,
} from "@espanol/types";
import {
  readLocaleFile,
  writeLocaleFile,
  diffLocales,
} from "@espanol/locale-utils";
import {
  validateJsonPath,
  validateFilePath,
  validateContentLength,
  RateLimiter,
  SecurityError,
  ErrorCode,
  createSafeError,
  MAX_ARRAY_LENGTH,
} from "@espanol/security";
import {
  ProviderRegistry,
  DeepLProvider,
  LibreTranslateProvider,
  MyMemoryProvider,
} from "@espanol/providers";
import { ToolResult } from "../lib/types.js";
import { createProviderRegistry } from "../lib/provider-factory.js";

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
      : registry.getAuto();

    // Translate missing keys
    let translatedCount = 0;
    const updatedTargetEntries = [...targetEntries];

    for (const key of missingKeys) {
      const baseEntry = baseEntries.find((e) => e.key === key);
      if (!baseEntry) continue;

      try {
        const result = await provider.translate(
          baseEntry.value,
          "en",
          params.dialect || "es-ES",
          { dialect: params.dialect }
        );

        updatedTargetEntries.push({
          key,
          value: result.translatedText,
        });
        translatedCount++;
      } catch (error) {
        // Silently skip failed translations — provider already handles error logging
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

    // Get provider
    const provider = params.provider
      ? registry.get(params.provider)
      : registry.getAuto();

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
            const result = await provider.translate(
              entry.value,
              "en",
              targetDialect,
              { dialect: targetDialect }
            );

            targetEntries.push({
              key: entry.key,
              value: result.translatedText,
            });
            totalTranslated++;
          } catch (error) {
            errors.push(`${targetDialect}/${entry.key}: ${error}`);
          }
        }

        // Write target file
        writeLocaleFile(targetPath, targetEntries);
        targets.push(targetDialect);
      } catch (error) {
        errors.push(`${targetDialect}: ${error}`);
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
        const regex = new RegExp(`\\b${source}\\b`, "gi");
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
        const regex = new RegExp(`\\b${source}\\b`, "gi");
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
  server.tool(
    "detect_missing_keys",
    "Compare two locale files and report missing keys",
    {
      basePath: z.string().describe("Path to the base locale file"),
      targetPath: z.string().describe("Path to the target locale file"),
    },
    async (params) => {
      return handleDetectMissingKeys(params as DetectMissingKeysParams, registry, rateLimiter);
    }
  );

  // Register translate_missing_keys tool
  server.tool(
    "translate_missing_keys",
    "Translate missing keys from base locale to target locale",
    {
      basePath: z.string().describe("Path to the base locale file"),
      targetPath: z.string().describe("Path to the target locale file"),
      dialect: z.string().optional().describe("Spanish dialect code (e.g., es-ES, es-MX, es-AR)"),
      provider: z.string().optional().describe("Translation provider name (deepl, libre, mymemory)"),
    },
    async (params) => {
      return handleTranslateMissingKeys(params as TranslateMissingKeysParams, registry, rateLimiter);
    }
  );

  // Register batch_translate_locales tool
  server.tool(
    "batch_translate_locales",
    "Translate base locale to multiple target dialects",
    {
      directory: z.string().describe("Directory containing locale files"),
      baseLocale: z.string().optional().describe("Base locale name (e.g., en, es-ES)"),
      targets: z.array(z.string()).describe("Array of target Spanish dialect codes"),
      provider: z.string().optional().describe("Translation provider name (deepl, libre, mymemory)"),
    },
    async (params) => {
      return handleBatchTranslateLocales(params as BatchTranslateLocalesParams, registry, rateLimiter);
    }
  );

  // Register manage_dialect_variants tool
  server.tool(
    "manage_dialect_variants",
    "Create dialect-specific variants of a locale file",
    {
      sourcePath: z.string().describe("Path to the source locale file"),
      variant: z.string().describe("Target dialect variant (e.g., es-MX, es-AR, es-CO)"),
      outputPath: z.string().optional().describe("Output path (optional, defaults to source path)"),
    },
    async (params) => {
      return handleManageDialectVariants(params as ManageDialectVariantsParams, registry, rateLimiter);
    }
  );

  // Register check_formality tool
  server.tool(
    "check_formality",
    "Check locale file for formality consistency",
    {
      localePath: z.string().describe("Path to the locale file to check"),
      register: z.enum(["formal", "informal"]).optional().describe("Register to check for (formal or informal)"),
    },
    async (params) => {
      return handleCheckFormality(params as CheckFormalityParams, registry, rateLimiter);
    }
  );

  // Register apply_gender_neutral tool
  server.tool(
    "apply_gender_neutral",
    "Apply gender-neutral language strategies to a locale file",
    {
      localePath: z.string().describe("Path to the locale file to adapt"),
      strategy: z.enum(["latine", "elles", "x", "descriptive"]).optional().describe("Gender-neutral strategy (latine, elles, x, descriptive)"),
    },
    async (params) => {
      return handleApplyGenderNeutral(params as ApplyGenderNeutralParams, registry, rateLimiter);
    }
  );
}
