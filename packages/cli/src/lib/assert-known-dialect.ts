import { ALL_SPANISH_DIALECTS, type SpanishDialect } from "@dialectos/types";

/**
 * Reject unknown dialect codes before any quality scoring.
 * Unknown codes must fail closed with an actionable retry hint — never a silent PASS.
 */
export function assertKnownDialect(dialect: string): SpanishDialect {
  if (ALL_SPANISH_DIALECTS.includes(dialect as SpanishDialect)) {
    return dialect as SpanishDialect;
  }
  throw new Error(
    `Unknown dialect '${dialect}'. DialectOS supports 25 regional Spanish variants (e.g. es-MX, es-ES, es-AR). List them with: dialectos dialects list`
  );
}
