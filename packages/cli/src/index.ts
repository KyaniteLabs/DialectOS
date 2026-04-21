#!/usr/bin/env node
/**
 * @espanol/cli
 *
 * Spanish translation CLI — translate text, docs, i18n files with dialect awareness
 */

import { Command } from "commander";
import { executeTranslate } from "./commands/translate.js";
import { createTranslateReadmeCommand } from "./commands/translate-readme.js";
import { executeTranslateApiDocs, executeExtractTranslatable, type TranslateApiDocsOptions } from "./commands/translate-api-docs.js";
import { executeDialectsList, executeDialectsDetect } from "./commands/dialects.js";
import { executeGlossarySearch, executeGlossaryGet } from "./commands/glossary.js";
import { executeDetectMissing } from "./commands/i18n/detect-missing.js";
import { executeTranslateKeys } from "./commands/i18n/translate-keys.js";
import { executeBatchTranslate } from "./commands/i18n/batch-translate.js";
import { executeManageVariants } from "./commands/i18n/manage-variants.js";
import { executeCheckFormality } from "./commands/i18n/check-formality.js";
import { executeApplyGenderNeutral } from "./commands/i18n/apply-gender-neutral.js";
import { getDefaultProviderRegistry } from "./lib/provider-factory.js";
import { writeError, writeOutput } from "./lib/output.js";
import { SecurityError, createSafeError } from "@espanol/security";
import type { SpanishDialect } from "@espanol/types";
import { parse, format } from "node:path";
import { resolvePolicy, type PolicyProfile } from "./lib/translation-policy.js";

const program = new Command();

// CLI metadata
program
  .name("espanol")
  .description("Spanish translation CLI with dialect awareness")
  .version("0.1.0");

// Translate command
program
  .command("translate")
  .description("Translate text to Spanish with dialect awareness")
  .argument("[text]", "Text to translate (can also be provided via stdin or --input-file)")
  .option("--dialect <dialect>", "Spanish dialect (e.g., es-ES, es-MX, es-AR)", "es-ES")
  .option("--provider <provider>", "Translation provider (deepl, libre, mymemory, or auto for automatic selection)", "auto")
  .option("--formal", "Use formal language (usted)", false)
  .option("--informal", "Use informal language (tú)", false)
  .option("--auto-formality", "Auto-detect formality", false)
  .option("--input-file <path>", "Read text from file instead of argument")
  .option("--output <path>", "Write translation to file instead of stdout")
  .action(async (text, options) => {
    try {
      const registry = getDefaultProviderRegistry();

      await executeTranslate(text, options, (providerName) => {
        if (!providerName || providerName === "auto") {
          return registry.getAuto();
        }
        return registry.get(providerName);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// translate-readme command
program.addCommand(createTranslateReadmeCommand(getDefaultProviderRegistry));

// extract-translatable command
program
  .command("extract-translatable")
  .description("Extract translatable text from a markdown file")
  .argument("<input>", "Input markdown file")
  .action(async (input) => {
    try {
      const registry = getDefaultProviderRegistry();

      await executeExtractTranslatable(input, (providerName) => {
        if (!providerName || providerName === "auto") {
          return registry.getAuto();
        }
        return registry.get(providerName);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// translate-api-docs command
program
  .command("translate-api-docs")
  .description("Translate an API documentation markdown file")
  .argument("<input>", "Input markdown file")
  .option("--dialect <dialect>", "Spanish dialect (e.g., es-ES, es-MX, es-AR)", "es-ES")
  .option("--provider <provider>", "Translation provider (deepl, libre, mymemory, or auto for automatic selection)", "auto")
  .option("--output <path>", "Write translation to file instead of stdout")
  .option("--protect-tokens <file>", "JSON file with protected tokens")
  .option("--glossary-file <file>", "JSON glossary file with term mappings")
  .option("--glossary-mode <mode>", "Glossary mode: off|strict", "off")
  .option("--protect-identities", "Auto-protect handles/domains/usernames", true)
  .option("--no-protect-identities", "Disable auto identity protection")
  .option("--validate-structure", "Validate markdown structure after translation", true)
  .option("--no-validate-structure", "Disable structure validation")
  .option("--structure-mode <mode>", "Structure validation mode: warn|strict", "strict")
  .option("--checkpoint-file <path>", "Checkpoint file for resumable translation")
  .option("--resume", "Resume from checkpoint when available", true)
  .option("--no-resume", "Ignore existing checkpoint")
  .option("--failure-policy <policy>", "Section failure policy: strict|allow-partial")
  .option("--policy <profile>", "Policy profile: strict|balanced|permissive", "balanced")
  .hook("preAction", (thisCommand: Command) => {
    const policy = thisCommand.opts().failurePolicy;
    if (policy && !["strict", "allow-partial"].includes(policy)) {
      console.error(`Invalid --failure-policy '${policy}'. Must be 'strict' or 'allow-partial'.`);
      process.exit(1);
    }
  })
  .action(async (input: string, options: Record<string, unknown>) => {
    try {
      const registry = getDefaultProviderRegistry();

      // Resolve policy profile and merge with explicit overrides
      const profile = resolvePolicy(options.policy as PolicyProfile, {
        failurePolicy: options.failurePolicy as "strict" | "allow-partial" | undefined,
        validateStructure: options.validateStructure as boolean | undefined,
        structureMode: options.structureMode as "warn" | "strict" | undefined,
        glossaryMode: options.glossaryMode as "off" | "strict" | undefined,
        protectIdentities: options.protectIdentities as boolean | undefined,
        resume: options.resume as boolean | undefined,
      });
      const mergedOptions: TranslateApiDocsOptions = {
        dialect: options.dialect as SpanishDialect,
        provider: options.provider as string,
        output: options.output as string | undefined,
        protectTokens: options.protectTokens as string | undefined,
        glossaryFile: options.glossaryFile as string | undefined,
        glossaryMode: profile.glossaryMode,
        protectIdentities: profile.protectIdentities,
        validateStructure: profile.validateStructure,
        structureMode: profile.structureMode,
        checkpointFile: options.checkpointFile as string | undefined,
        resume: profile.resume,
        failurePolicy: profile.failurePolicy,
        policy: profile.profile,
      };

      await executeTranslateApiDocs(input, mergedOptions.dialect!, mergedOptions, () => registry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// dialects command group
const dialectsCommand = program
  .command("dialects")
  .description("Spanish dialect commands");

// dialects list command
dialectsCommand
  .command("list")
  .description("List all Spanish dialects")
  .option("--format <format>", "Output format (text or json)", "text")
  .action(async (options) => {
    try {
      await executeDialectsList({ format: options.format });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// dialects detect command
dialectsCommand
  .command("detect")
  .description("Detect Spanish dialect from text")
  .argument("<text>", "Text to analyze for dialect detection")
  .option("--format <format>", "Output format (text or json)", "text")
  .option("--register <register>", "Register preference: formal | slang | any", "any")
  .action(async (text, options) => {
    try {
      const register = ["formal", "slang", "any"].includes(options.register)
        ? options.register
        : "any";
      await executeDialectsDetect(text, { format: options.format, register });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// glossary command group
const glossaryCommand = program
  .command("glossary")
  .description("Glossary commands");

// glossary search command
glossaryCommand
  .command("search")
  .description("Search glossary for terms")
  .argument("<query>", "Search query")
  .option("--format <format>", "Output format (text or json)", "text")
  .action(async (query, options) => {
    try {
      await executeGlossarySearch(query, { format: options.format });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// glossary get command
glossaryCommand
  .command("get")
  .description("Get glossary entries by category")
  .option("--category <category>", "Filter by category (programming, technical, business, general)")
  .option("--format <format>", "Output format (text or json)", "text")
  .action(async (options) => {
    try {
      await executeGlossaryGet(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// i18n command group
const i18nCommand = program
  .command("i18n")
  .description("i18n locale file management commands");

// detect-missing command
i18nCommand
  .command("detect-missing")
  .description("Compare two locale files and report missing keys")
  .argument("<base>", "Base locale file (e.g., ./locales/en.json)")
  .argument("<target>", "Target locale file (e.g., ./locales/es.json)")
  .action(async (base, target) => {
    try {
      await executeDetectMissing(base, target);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// translate-keys command
i18nCommand
  .command("translate-keys")
  .description("Translate missing keys from base locale to target locale")
  .argument("<base>", "Base locale file (e.g., ./locales/en.json)")
  .argument("<target>", "Target locale file (e.g., ./locales/es.json)")
  .option("--dialect <dialect>", "Spanish dialect (e.g., es-MX, es-AR, es-CO)", "es-ES")
  .option("--provider <provider>", "Translation provider (deepl, libre, mymemory, or auto for automatic selection)", "auto")
  .action(async (base, target, options) => {
    try {
      const registry = getDefaultProviderRegistry();

      await executeTranslateKeys(base, target, options.dialect, undefined, (providerName) => {
        if (!providerName) {
          return registry.getAuto();
        }
        return registry.get(providerName);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// batch-translate command
i18nCommand
  .command("batch-translate")
  .description("Translate base locale to multiple target dialects")
  .argument("<directory>", "Directory containing locale files (e.g., ./locales)")
  .option("--base <locale>", "Base locale code (e.g., en)", "en")
  .option("--targets <dialects>", "Comma-separated target dialects (e.g., es-MX,es-AR,es-CO)", "es-ES")
  .option("--provider <provider>", "Translation provider (deepl, libre, mymemory, or auto for automatic selection)", "auto")
  .action(async (directory, options) => {
    try {
      const registry = getDefaultProviderRegistry();

      // Parse targets from comma-separated string
      const targets = options.targets.split(",").map((t: string) => t.trim()) as SpanishDialect[];

      await executeBatchTranslate(directory, options.base, targets, undefined, (providerName) => {
        if (!providerName) {
          return registry.getAuto();
        }
        return registry.get(providerName);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// manage-variants command
i18nCommand
  .command("manage-variants")
  .description("Create dialect-specific variants of locale files")
  .argument("<source>", "Source locale file (e.g., ./locales/es-ES.json)")
  .option("--variant <dialect>", "Target dialect variant (e.g., es-MX, es-AR, es-CO)", "es-MX")
  .option("--output <path>", "Output path for variant locale file")
  .action(async (source, options) => {
    try {
      const parsed = parse(source);
      const output = options.output || format({ ...parsed, name: options.variant, base: `${options.variant}.json` });
      const result = await executeManageVariants({
        source,
        variant: options.variant as SpanishDialect,
        output,
      });

      // Report results
      if (result.adapted) {
        writeOutput(`Created ${options.variant} variant with ${result.changes.length} adaptations:\n${result.changes.map(c => `  - ${c}`).join("\n")}`);
      } else {
        writeOutput(`Created ${options.variant} variant (no adaptations needed)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// check-formality command
i18nCommand
  .command("check-formality")
  .description("Check locale file for formality consistency")
  .argument("<locale>", "Locale file to check (e.g., ./locales/es.json)")
  .option("--register <register>", "Register to check against (formal or informal)", "formal")
  .action(async (locale, options) => {
    try {
      const register = options.register === "informal" ? "informal" : "formal";
      const result = await executeCheckFormality({
        locale,
        register,
      });

      // Report results
      writeOutput(`Checked ${result.totalKeys} keys for ${register} register consistency`);

      if (result.issues.length > 0) {
        writeOutput(`\nFound ${result.issues.length} formality issues:\n${result.issues.map(i => `  - ${i.key}: ${i.suggestion}`).join("\n")}`);
        process.exit(1);
      } else {
        writeOutput(`No formality issues found. Locale is consistent with ${register} register.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// apply-gender-neutral command
i18nCommand
  .command("apply-gender-neutral")
  .description("Apply gender-neutral language to locale file")
  .argument("<locale>", "Locale file to transform (e.g., ./locales/es.json)")
  .option("--strategy <strategy>", "Gender-neutral strategy (latine, elles, x, descriptive)", "latine")
  .action(async (locale, options) => {
    try {
      const strategy = ["latine", "elles", "x", "descriptive"].includes(options.strategy)
        ? options.strategy as "latine" | "elles" | "x" | "descriptive"
        : "latine";

      const result = await executeApplyGenderNeutral({
        locale,
        strategy,
      });

      // Report results
      if (result.adapted) {
        writeOutput(`Applied ${strategy} gender-neutral strategy with ${result.changes.length} changes:\n${result.changes.map(c => `  - ${c}`).join("\n")}`);
      } else {
        writeOutput(`Applied ${strategy} gender-neutral strategy (no changes needed)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeError(message);
      process.exit(1);
    }
  });

// Parse arguments
program.parseAsync(process.argv).catch((error) => {
  // Handle SecurityError with proper error classification
  if (error instanceof SecurityError) {
    const safeError = createSafeError(error);
    writeError(`Security Error [${safeError.code}]: ${safeError.error}`);
  } else {
    // Handle other errors
    const safeError = createSafeError(error);
    writeError(safeError.error);
  }
  process.exit(1);
});
