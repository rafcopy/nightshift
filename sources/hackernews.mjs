/**
 * Hacker News — the monthly "Ask HN: Who is hiring?" and "Freelancer? Seeking
 * freelancer?" threads, which are where a lot of real contract work is posted
 * and which nothing else indexes well.
 *
 * Uses the public Algolia API. Two requests: find the newest thread, then pull
 * its comment tree in one go.
 */

import { getJson, parseUsd, stripHtml } from "../tools/lib/http.mjs";

export const id = "hackernews";
export const label = "Hacker News";

// Posted monthly by the `whoishiring` account. Matching on the author rather
// than the title avoids the many imitation threads.
//
// The "Freelancer? Seeking freelancer?" series used to live here too, but the
// most recent one is from 2016 — it is discontinued. Do not add it back
// without checking the date, or the run will serve decade-old gigs as current.
const THREADS = [
  { match: /who is hiring/i, type: "remote_job" },
];

// A thread older than this is treated as "no thread" rather than used, so a
// change in HN's cadence degrades to zero results instead of stale ones.
const MAX_THREAD_AGE_DAYS = 60;

async function newestThread(match) {
  const url = "https://hn.algolia.com/api/v1/search_by_date?" + new URLSearchParams({
    tags: "story,author_whoishiring", hitsPerPage: "20",
  });
  const body = await getJson(url);
  const hit = (body.hits ?? []).find((h) => match.test(h.title ?? ""));
  if (!hit) return null;

  const ageDays = (Date.now() - new Date(hit.created_at).getTime()) / 864e5;
  if (ageDays > MAX_THREAD_AGE_DAYS) return null;

  return { id: hit.objectID, title: hit.title };
}

export async function fetch_({ maxPerThread = 120 } = {}) {
  const out = [];

  for (const { match, type } of THREADS) {
    let thread;
    try { thread = await newestThread(match); } catch { continue; }
    if (!thread) continue;

    let item;
    try { item = await getJson(`https://hn.algolia.com/api/v1/items/${thread.id}`); }
    catch { continue; }

    const posts = (item.children ?? [])
      .filter((c) => c && c.text && !c.deleted)
      .slice(0, maxPerThread);

    for (const c of posts) {
      const text = stripHtml(c.text);
      // These posts conventionally open with "Company | Role | Location", but
      // plenty do not. Only treat the first segment as a company name when it
      // actually looks like one, otherwise a whole paragraph ends up as `org`.
      const first = text.split("\n")[0]?.slice(0, 160) ?? "";
      const segment = first.includes("|") ? first.split("|")[0].trim() : null;
      const org = segment && segment.length <= 60 ? segment : null;

      out.push({
        id: `hn-${c.id}`,
        source: id,
        type,
        title: first || "Untitled post",
        org,
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        description: text.slice(0, 4000),
        tags: [],
        value_usd: parseUsd(text),
        value_note: null,
        posted_at: c.created_at ?? null,
        deadline: null,
        thread: thread.title,
      });
    }
  }

  return out;
}
