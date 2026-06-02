/**
 * translate-website command
 * Discovers and translates all translatable assets in a website directory
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { validateFilePath } from "@dialectos/security";
import type { TranslationProvider, SpanishDialect, ProviderName } from "@dialectos/types";
import { ALL_SPANISH_DIALECTS } from "@dialectos/types";
import { BulkTranslationEngine } from "@dialectos/providers";
import type { BulkTranslationItem } from "@dialectos/providers";
import { readLocaleFile, writeLocaleFile } from "@dialectos/locale-utils";
import { writeError, writeInfo, writeOutput } from "../lib/output.js";

function validateDialects(dialects: SpanishDialect[]): void {
  for (const dialect of dialects) {
    if (!ALL_SPANISH_DIALECTS.includes(dialect)) {
      throw new Error(`Invalid dialect code: ${dialect}`);
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

export interface TranslateWebsiteOptions {
  baseLocale?: string;
  concurrency?: number;
  useCache?: boolean;
  checkpointDir?: string;
  deadLetterDir?: string;
  allowPartial?: boolean;
}

interface DiscoveredAsset {
  type: "locale" | "markdown";
  sourcePath: string;
  relativePath: string;
}

function discoverAssets(siteDir: string, baseLocale: string): DiscoveredAsset[] {
  const assets: DiscoveredAsset[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        if (entry.name === `${baseLocale}.json`) {
          assets.push({
            type: "locale",
            sourcePath: fullPath,
            relativePath: path.relative(siteDir, fullPath),
          });
        } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
          assets.push({
            type: "markdown",
            sourcePath: fullPath,
            relativePath: path.relative(siteDir, fullPath),
          });
        }
      }
    }
  }

  walk(siteDir);
  return assets;
}

function toLocaleItems(
  entries: Array<{ key: string; value: string }>,
  baseLocale: string,
  targetDialect: SpanishDialect
): BulkTranslationItem[] {
  return entries.map((entry, idx) => ({
    id: `locale:${entry.key}:${idx}`,
    sourceText: entry.value,
    sourceLang: baseLocale,
    targetLang: "es",
    options: { dialect: targetDialect },
  }));
}

function toMarkdownItems(
  sections: Array<{ id: string; text: string }>,
  baseLocale: string,
  targetDialect: SpanishDialect
): BulkTranslationItem[] {
  return sections.map((section) => ({
    id: `md:${section.id}`,
    sourceText: section.text,
    sourceLang: baseLocale,
    targetLang: "es",
    options: { dialect: targetDialect, context: "markdown" },
  }));
}

function splitMarkdownIntoSections(content: string): Array<{ id: string; text: string }> {
  const lines = content.split("\n");
  const sections: Array<{ id: string; text: string }> = [];
  let currentSection: string[] = [];
  let currentId = "frontmatter";
  let sectionIdx = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      if (currentSection.length > 0) {
        sections.push({
          id: `${currentId}-${sectionIdx}`,
          text: currentSection.join("\n").trim(),
        });
        sectionIdx++;
      }
      currentId = headerMatch[2].trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
      currentSection = [line];
    } else {
      currentSection.push(line);
    }
  }

  if (currentSection.length > 0) {
    sections.push({
      id: `${currentId}-${sectionIdx}`,
      text: currentSection.join("\n").trim(),
    });
  }

  return sections;
}

export async function executeTranslateWebsite(
  siteDir: string,
  targets: SpanishDialect[],
  provider: TranslationProvider,
  options: TranslateWebsiteOptions = {}
): Promise<void> {
  const {
    baseLocale = "en",
    concurrency = 4,
    useCache = true,
    checkpointDir = path.join(siteDir, ".dialectos", "checkpoints"),
    deadLetterDir = path.join(siteDir, ".dialectos", "dead-letters"),
    allowPartial = false,
  } = options;

  validateDialects(targets);
  const validatedDir = validateFilePath(siteDir);

  writeInfo(`Scanning ${validatedDir} for translatable assets...`);
  const assets = discoverAssets(validatedDir, baseLocale);

  if (assets.length === 0) {
    writeInfo("No translatable assets found.");
    writeInfo("Looking for:");
    writeInfo(`  - Locale files: **/${baseLocale}.json`);
    writeInfo(`  - Markdown files: **/*.md, **/*.mdx`);
    return;
  }

  writeInfo(`Found ${assets.length} assets`);
  for (const asset of assets) {
    writeInfo(`  [${asset.type}] ${asset.relativePath}`);
  }

  let totalStrings = 0;
  let totalSuccess = 0;
  let totalFail = 0;
  let totalCacheHits = 0;
  let totalApiCalls = 0;

  fs.mkdirSync(checkpointDir, { recursive: true });
  fs.mkdirSync(deadLetterDir, { recursive: true });

  for (const targetDialect of targets) {
    writeInfo(`\n=== Translating to ${targetDialect} ===`);

    const allItems: BulkTranslationItem[] = [];
    const assetItemRanges: Array<{ asset: DiscoveredAsset; startIndex: number; endIndex: number }> = [];

    for (const asset of assets) {
      const startIndex = allItems.length;

      if (asset.type === "locale") {
        const entries = readLocaleFile(asset.sourcePath);
        const items = toLocaleItems(entries, baseLocale, targetDialect);
        allItems.push(...items);
      } else if (asset.type === "markdown") {
        const content = fs.readFileSync(asset.sourcePath, "utf-8");
        const sections = splitMarkdownIntoSections(content);
        const items = toMarkdownItems(sections, baseLocale, targetDialect);
        allItems.push(...items);
      }

      assetItemRanges.push({
        asset,
        startIndex,
        endIndex: allItems.length,
      });
    }

    if (allItems.length === 0) {
      writeInfo("No items to translate.");
      continue;
    }

    writeInfo(`Translating ${allItems.length} strings...`);

    const checkpointPath = path.join(checkpointDir, `website-${targetDialect}.json`);
    const dlqPath = path.join(deadLetterDir, `website-${targetDialect}.jsonl`);

    const engine = new BulkTranslationEngine({
      maxConcurrency: concurrency,
      useCache,
      checkpointPath,
      onProgress: (p) => {
        const pct = Math.round((p.completed / p.total) * 100);
        writeOutput(`[${targetDialect}] ${pct}% (${p.completed}/${p.total}) OK:${p.succeeded} Fail:${p.failed} Cache:${p.cacheHits}`);
      },
    });

    const result = await engine.translate(allItems, provider);

    totalStrings += allItems.length;
    totalSuccess += result.successes.length;
    totalFail += result.failures.length;
    totalCacheHits += result.cacheHits;
    totalApiCalls += result.apiCalls;

    if (result.failures.length > 0 && !allowPartial) {
      const dlqLines = result.failures.map((f) =>
        JSON.stringify({
          dialect: targetDialect,
          itemId: f.item.id,
          sourceText: f.item.sourceText,
          error: f.error,
          retryCount: f.retryCount,
          failedAt: f.failedAt,
        })
      );
      fs.appendFileSync(dlqPath, dlqLines.join("\n") + "\n", "utf-8");
      writeError(`  ${result.failures.length} failures written to ${path.relative(validatedDir, dlqPath)}`);
      writeError(`  Partial output discarded for ${targetDialect} (use --allow-partial to keep)`);
      continue;
    }

    // Write outputs per asset
    for (const range of assetItemRanges) {
      const assetItems = allItems.slice(range.startIndex, range.endIndex);
      const assetSuccesses = result.successes.filter((s) =>
        assetItems.some((i) => i.id === s.item.id)
      );

      if (range.asset.type === "locale") {
        const outputPath = range.asset.sourcePath.replace(
          new RegExp(`${escapeRegExp(baseLocale)}\\.json$`),
          `${targetDialect}.json`
        );

        let existing: Array<{ key: string; value: string }> = [];
        try {
          existing = readLocaleFile(outputPath);
        } catch {
          // No existing file
        }
        const existingMap = new Map(existing.map((e) => [e.key, e.value]));

        const successMap = new Map(
          assetSuccesses.map((s) => {
            const key = s.item.id.split(":")[1];
            return [key, s.result.translatedText];
          })
        );

        const originalEntries = readLocaleFile(range.asset.sourcePath);
        const mergedEntries = originalEntries.map((entry) => ({
          key: entry.key,
          value: successMap.get(entry.key) ?? existingMap.get(entry.key) ?? entry.value,
        }));

        writeLocaleFile(outputPath, mergedEntries, 2);
        writeInfo(`  Wrote ${path.relative(validatedDir, outputPath)}`);
      } else if (range.asset.type === "markdown") {
        const ext = path.extname(range.asset.sourcePath);
        const baseName = range.asset.sourcePath.slice(0, -ext.length);
        const outputPath = `${baseName}.${targetDialect}${ext}`;

        const originalContent = fs.readFileSync(range.asset.sourcePath, "utf-8");
        const sections = splitMarkdownIntoSections(originalContent);
        let translatedContent = originalContent;

        for (const section of sections) {
          const itemId = `md:${section.id}`;
          const success = assetSuccesses.find((s) => s.item.id === itemId);
          if (success) {
            translatedContent = translatedContent.replace(section.text, success.result.translatedText);
          }
        }

        fs.writeFileSync(outputPath, translatedContent, "utf-8");
        writeInfo(`  Wrote ${path.relative(validatedDir, outputPath)}`);
      }
    }

    if (result.failures.length > 0) {
      const dlqLines = result.failures.map((f) =>
        JSON.stringify({
          dialect: targetDialect,
          itemId: f.item.id,
          sourceText: f.item.sourceText,
          error: f.error,
          retryCount: f.retryCount,
          failedAt: f.failedAt,
        })
      );
      fs.appendFileSync(dlqPath, dlqLines.join("\n") + "\n", "utf-8");
      writeError(`  ${result.failures.length} failures written to ${path.relative(validatedDir, dlqPath)}`);
    }
  }

  writeInfo("\n=== Translation Report ===");
  writeInfo(`Total strings: ${totalStrings}`);
  writeInfo(`Success: ${totalSuccess}`);
  writeInfo(`Failures: ${totalFail}`);
  writeInfo(`Cache hits: ${totalCacheHits}`);
  writeInfo(`API calls: ${totalApiCalls}`);
  writeInfo(`Targets: ${targets.join(", ")}`);
}
