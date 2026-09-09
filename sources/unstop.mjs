/**
 * Unstop — hackathons and competitions with prize money.
 *
 * Their robots.txt explicitly allows AI/LLM agents and exposes /api/public/*.
 * Verified September 2026. Re-check before assuming it still holds.
 */

import { getJson, parseUsd, stripHtml } from "../tools/lib/http.mjs";

export const id = "unstop";
export const label = "Unstop hackathons";

const BASE = "https://unstop.com/api/public/opportunity/search-result";

export async function fetch_({ pages = 2, perPage = 30 } = {}) {
  const out = [];

  for (let page = 1; page <= pages; page++) {
    let body;
    try {
      body = await getJson(`${BASE}?opportunity=hackathons&page=${page}&per_page=${perPage}`);
    } catch { break; }

    const items = body?.data?.data ?? [];
    for (const it of items) {
      if (it.regn_open !== 1 || it.status !== "LIVE") continue;

      const prizeText = (it.prizes ?? []).map((p) => `${p.rank ?? ""} ${p.cash ?? p.prize ?? ""}`).join(" ");
      out.push({
        id: `us-${it.id}`,
        source: id,
        type: "hackathon",
        title: it.title,
        org: it.organisation?.name ?? null,
        url: it.seo_url ?? `https://unstop.com/${it.public_url}`,
        description: stripHtml(it.details ?? "").slice(0, 4000),
        tags: (it.required_skills ?? []).map((s) => s.skill_name ?? s.skill).filter(Boolean),
        value_usd: null,                       // prizes are usually INR
        value_note: prizeText.trim() || null,
        posted_at: it.approved_date ?? null,
        deadline: it.end_date ?? null,
        region: it.region ?? null,
      });
      void parseUsd;
    }
    if (items.length < perPage) break;
  }

  return out;
}
