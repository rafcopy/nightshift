/**
 * Polite HTTP. Nightshift runs unattended every night, so it identifies itself
 * honestly, backs off on 429s, and never hammers a source.
 */

export const UA = "Nightshift/0.1 (+https://github.com/rafcopy/nightshift)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJson(url, { headers = {}, timeoutMs = 20000, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "application/json", ...headers },
      });

      if (res.status === 429 || res.status >= 500) {
        // Respect Retry-After when the server sends one.
        const wait = Number(res.headers.get("retry-after")) * 1000 || (attempt + 1) * 3000;
        if (attempt < retries) { await sleep(wait); continue; }
        throw new Error(`HTTP ${res.status} after ${retries + 1} attempts`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep((attempt + 1) * 2000);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Pull a dollar figure out of free text. Returns the largest plausible one. */
export function parseUsd(text) {
  if (!text) return null;
  const s = String(text);
  const found = [];

  // $500, $1,200, $1.5k, USD 300
  for (const m of s.matchAll(/(?:\$|USD\s*)\s?([\d,]+(?:\.\d+)?)\s*([kK])?/g)) {
    let n = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (m[2]) n *= 1000;
    // Filter out things that are obviously not a prize or bounty.
    if (n >= 10 && n <= 1_000_000) found.push(n);
  }
  return found.length ? Math.max(...found) : null;
}

/** Strip HTML down to readable text. */
export function stripHtml(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean)
    .join("\n").trim();
}
