/**
 * GitHub — open issues carrying a bounty label.
 *
 * Uses the documented public Search API. A GITHUB_TOKEN is optional but lifts
 * the rate limit from 60/hour to 5000/hour; a token with no scopes is enough,
 * since we only read public data.
 */

import { getJson, parseUsd } from "../tools/lib/http.mjs";

export const id = "github";
export const label = "GitHub bounties";

const LABELS = ["bounty", "💎 Bounty", "bounty-eligible", "has-bounty"];

export async function fetch_({ sinceDays = 14, perLabel = 40 } = {}) {
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString().slice(0, 10);
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const seen = new Map();

  for (const label of LABELS) {
    const q = `label:"${label}" state:open created:>${since}`;
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}` +
                `&sort=created&order=desc&per_page=${perLabel}`;
    let body;
    try { body = await getJson(url, { headers }); }
    catch { continue; }   // one label failing should not kill the run

    for (const it of body.items ?? []) {
      if (seen.has(it.html_url)) continue;
      const repo = (it.repository_url ?? "").split("/repos/")[1] ?? null;
      const text = `${it.title}\n${it.body ?? ""}`;

      seen.set(it.html_url, {
        id: `gh-${it.id}`,
        source: id,
        type: "bounty",
        title: it.title,
        org: repo,
        url: it.html_url,
        description: (it.body ?? "").slice(0, 4000),
        tags: (it.labels ?? []).map((l) => l.name),
        value_usd: parseUsd(text),
        value_note: null,
        posted_at: it.created_at,
        deadline: null,
        comments: it.comments ?? 0,
      });
    }
  }

  return [...seen.values()];
}
