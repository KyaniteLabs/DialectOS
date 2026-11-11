#!/usr/bin/env node
const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/smoke-pages.mjs <base-url>');
const paths = ['/', '/robots.txt', '/sitemap.xml', '/llms.txt'];

async function smoke(baseUrl) {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  for (const path of paths) {
    const url = new URL(path.replace(/^\//, ''), root);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url.href} returned ${res.status}`);
    // A redirect to another site (e.g. a custom domain that serves a different
    // page) is not a deployed DialectOS site, even when it ends in a 200.
    const finalUrl = new URL(res.url);
    if (finalUrl.host !== url.host) {
      throw new Error(`${url.href} redirected to ${finalUrl.href}`);
    }
    const text = await res.text();
    if (!text.trim()) throw new Error(`${url.href} returned empty body`);
    if (path === '/' && !text.includes('DialectOS')) {
      throw new Error(`${url.href} is not the DialectOS page`);
    }
  }
  console.log(`Pages smoke passed for ${baseUrl}`);
}

smoke(base).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
