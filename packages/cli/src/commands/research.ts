import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { writeOutput } from "../lib/output.js";
import { parseDialectList, researchRegionalTerm, type RegionalResearchSource } from "../lib/regional-research.js";
import { validateFilePath } from "@dialectos/security";

export interface ResearchCommandOptions {
  concept: string;
  dialects: string;
  semanticField?: string;
  out?: string;
}

async function serperSearch(query: string): Promise<RegionalResearchSource[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    // A fixed API endpoint never needs a redirect; following one would carry x-api-key along.
    redirect: "error",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });
  if (!response.ok) throw new Error(`Serper search failed: ${response.status}`);
  const data = await response.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
  return (data.organic || []).filter((item) => item.title && item.link).map((item) => ({
    title: item.title!,
    link: item.link!,
    snippet: item.snippet,
  }));
}

export async function executeResearchRegionalTerm(options: ResearchCommandOptions): Promise<void> {
  const dialects = parseDialectList(options.dialects);
  const result = await researchRegionalTerm({
    concept: options.concept,
    dialects,
    semanticField: options.semanticField,
    search: process.env.SERPER_API_KEY ? serperSearch : undefined,
  });

  const out = options.out || `audits/research/${new Date().toISOString().slice(0, 10)}-${result.concept.replace(/[^a-z0-9]+/g, "-")}.json`;
  const validatedOut = validateFilePath(out);
  mkdirSync(dirname(validatedOut), { recursive: true });
  writeFileSync(validatedOut, `${JSON.stringify(result, null, 2)}\n`);
  writeOutput(JSON.stringify({ out: validatedOut, concept: result.concept, proposals: result.proposals.length, warnings: result.warnings }, null, 2));
}
