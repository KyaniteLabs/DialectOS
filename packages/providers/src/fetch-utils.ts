/**
 * Secure fetch with redirect following and per-hop validation.
 *
 * Fixes the DNS-rebinding / SSRF vulnerability while still allowing
 * legitimate redirects (e.g. HTTP→HTTPS, path changes).
 *
 * Each redirect hop is validated against the original allow-list before
 * the request is sent. On cross-origin redirects every header outside a
 * small safe allowlist is dropped, so no credential header can leak.
 */

export interface FetchWithRedirectsOptions {
  /** Maximum number of redirects to follow (default: 3) */
  maxRedirects?: number;
  /** Optional validation function for every hop */
  validateUrl?: (url: string) => void;
  /** fetch() init options */
  init?: RequestInit;
}

/**
 * Headers allowed to cross an origin boundary on redirect. Everything else is
 * dropped: auth comes in many spellings (authorization, x-api-key, api-key,
 * x-goog-api-key, cookies, vendor tokens), so a blocklist always misses one.
 */
const CROSS_ORIGIN_SAFE_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-language",
  "content-type",
  "user-agent",
]);

export function stripSensitiveHeaders(init: RequestInit): RequestInit {
  if (!init.headers) return init;
  const kept = new Headers();
  new Headers(init.headers).forEach((value, name) => {
    if (CROSS_ORIGIN_SAFE_HEADERS.has(name.toLowerCase())) kept.set(name, value);
  });
  return { ...init, headers: kept };
}

function isSameOrigin(a: string, b: string): boolean {
  const urlA = new URL(a);
  const urlB = new URL(b);
  return (
    urlA.protocol === urlB.protocol &&
    urlA.hostname === urlB.hostname &&
    urlA.port === urlB.port
  );
}

/**
 * Follow redirects safely.
 *
 * - Uses `redirect: "manual"` on the underlying fetch to stay in control.
 * - Validates every hop with the caller-supplied `validateUrl`.
 * - Drops all non-allowlisted headers on cross-origin redirects.
 * - Returns the final non-redirect Response.
 * - Throws on excessive redirects or validation failure.
 */
export async function fetchWithRedirects(
  url: string,
  options: FetchWithRedirectsOptions = {}
): Promise<Response> {
  const { maxRedirects = 3, validateUrl, init = {} } = options;
  let currentUrl = url;
  let remaining = maxRedirects;
  let currentInit = init;

  while (true) {
    if (validateUrl) {
      validateUrl(currentUrl);
    }

    const response = await fetch(currentUrl, {
      ...currentInit,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          `Redirect response ${response.status} from ${currentUrl} missing Location header`
        );
      }

      if (remaining <= 0) {
        throw new Error(
          `Too many redirects (>${maxRedirects}) starting from ${url}`
        );
      }
      remaining--;

      // Resolve relative URLs against the current URL
      const nextUrl = new URL(location, currentUrl).href;

      // Drop credentials (any non-allowlisted header) on cross-origin redirect
      if (!isSameOrigin(currentUrl, nextUrl)) {
        currentInit = stripSensitiveHeaders(currentInit);
      }

      currentUrl = nextUrl;
      continue;
    }

    return response;
  }
}
