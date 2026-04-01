import type { ProviderRegistry } from "@espanol/providers";
import type { TranslateOptions, TranslationResult } from "@espanol/types";

export interface AdaptivePacingState {
  delayMs: number;
}

const THROTTLE_PATTERN = /(too many requests|rate limit|429)/i;

export function isThrottleError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return THROTTLE_PATTERN.test(msg);
}

export async function waitAdaptive(state: AdaptivePacingState): Promise<void> {
  if (state.delayMs <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, state.delayMs));
}

function nextDelay(current: number, throttled: boolean): number {
  if (throttled) {
    return Math.min(current + 1500, 15000);
  }
  return Math.max(current - 250, 0);
}

export async function translateWithFallback(
  registry: ProviderRegistry,
  preferredProvider: string | undefined,
  text: string,
  sourceLang: string,
  targetLang: string,
  options: TranslateOptions,
  pacing: AdaptivePacingState
): Promise<TranslationResult> {
  const chain = buildProviderChain(registry, preferredProvider);
  const errors: string[] = [];

  for (const name of chain) {
    await waitAdaptive(pacing);
    try {
      const provider = registry.get(name);
      const result = await provider.translate(text, sourceLang, targetLang, options);
      pacing.delayMs = nextDelay(pacing.delayMs, false);
      registry.recordSuccess(name);
      return result;
    } catch (error) {
      const throttled = isThrottleError(error);
      pacing.delayMs = nextDelay(pacing.delayMs, throttled);
      registry.recordFailure(name);
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${name}: ${msg}`);
    }
  }

  throw new Error(`All providers failed (${chain.join(" -> ")}): ${errors.join(" | ")}`);
}

function buildProviderChain(
  registry: ProviderRegistry,
  preferredProvider?: string
): string[] {
  const envPriority = (process.env.PROVIDER_CHAIN || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const priority =
    envPriority.length > 0
      ? envPriority
      : ["libre", "deepl", "deepl-free", "mymemory"];
  const available = registry.listProviders().filter((name) => registry.isAvailable(name));
  const ordered = priority.filter((name) => available.includes(name));
  const remainder = available.filter((name) => !ordered.includes(name));
  const base = [...ordered, ...remainder];

  if (preferredProvider && preferredProvider !== "auto") {
    const rest = base.filter((name) => name !== preferredProvider);
    return [preferredProvider, ...rest];
  }

  return base;
}
