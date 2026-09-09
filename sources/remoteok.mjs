/**
 * RemoteOK — remote roles from their published public feed at /api.
 * The first element of the response is their legal notice, not a job.
 */

import { getJson, parseUsd, stripHtml } from "../tools/lib/http.mjs";

export const id = "remoteok";
export const label = "RemoteOK";

export async function fetch_() {
  const rows = await getJson("https://remoteok.com/api");
  const jobs = (Array.isArray(rows) ? rows : []).filter((r) => r && r.id && r.position);

  return jobs.map((j) => {
    const salary = j.salary_max ?? j.salary_min ?? null;
    return {
      id: `rok-${j.id}`,
      source: id,
      type: "remote_job",
      title: j.position,
      org: j.company ?? null,
      url: j.url ?? (j.slug ? `https://remoteok.com/remote-jobs/${j.slug}` : null),
      description: stripHtml(j.description ?? "").slice(0, 4000),
      tags: j.tags ?? [],
      value_usd: salary ? Number(salary) : parseUsd(j.description),
      value_note: salary ? "annual, as listed" : null,
      posted_at: j.date ?? null,
      deadline: null,
      location: j.location ?? null,
    };
  });
}
