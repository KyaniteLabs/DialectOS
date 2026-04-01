import { promises as fs } from "node:fs";

export interface TranslationCheckpoint {
  sourcePath: string;
  totalSections: number;
  translatedByIndex: Record<number, string>;
}

export async function loadCheckpoint(path: string): Promise<TranslationCheckpoint | null> {
  try {
    const raw = await fs.readFile(path, "utf-8");
    return JSON.parse(raw) as TranslationCheckpoint;
  } catch {
    return null;
  }
}

export async function saveCheckpoint(path: string, data: TranslationCheckpoint): Promise<void> {
  await fs.writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}
