#!/usr/bin/env node
/**
 * Nightshift — the morning report.
 *
 *   node tools/report.mjs                 # newest run
 *   node tools/report.mjs --date 2026-09-09
 *
 * Renders what the night produced into one page you read over coffee. Makes no
 * model calls; it only formats what the agent already wrote.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function newestRun() {
  const runs = path.join(ROOT, "run");
  if (!fs.existsSync(runs)) return null;
  const dirs = fs.readdirSync(runs).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

const TYPE_LABEL = { bounty: "Bounty", contract: "Contract", remote_job: "Role", hackathon: "Hackathon" };

function card(o) {
  const drafted = o.draft ? `
      <div class="draft">
        <div class="draft-head">Drafted response</div>
        <pre>${esc(o.draft)}</pre>
      </div>` : "";

  const verdict = o.verdict ? `<p class="verdict">${esc(o.verdict)}</p>` : "";

  return `
    <article class="opp ${esc(o.type)}">
      <header>
        <span class="type">${esc(TYPE_LABEL[o.type] ?? o.type)}</span>
        <h3><a href="${esc(o.url)}">${esc(o.title)}</a></h3>
      </header>
      <p class="meta">${esc(o.org ?? "—")}${o.value_usd ? ` · <b>$${Number(o.value_usd).toLocaleString()}</b>` : ""}${o.value_note ? ` · ${esc(o.value_note)}` : ""}${o.posted_at ? ` · posted ${esc(String(o.posted_at).slice(0, 10))}` : ""}</p>
      ${verdict}
      ${o.score_reasons?.length ? `<p class="why">${esc(o.score_reasons.join("  ·  "))}</p>` : ""}
      ${drafted}
    </article>`;
}

function render(data, date) {
  const drafted = (data.shortlist ?? []).filter((o) => o.draft);
  const reviewed = (data.shortlist ?? []).filter((o) => o.verdict && !o.draft);
  const rest = (data.shortlist ?? []).filter((o) => !o.verdict && !o.draft).slice(0, 20);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nightshift — ${esc(date)}</title>
<style>
  :root {
    --bg:#faf9f7; --card:#fff; --ink:#161a1d; --soft:#5a625f; --faint:#8b938f;
    --line:#e2e4df; --accent:#0d6b57; --accent-bg:#e6f0ec; --gold:#8a6510;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#111517; --card:#181d1f; --ink:#e9ede9; --soft:#a5aeaa; --faint:#78817d;
            --line:#272e31; --accent:#4fb89f; --accent-bg:#15302a; --gold:#d3a74d; }
  }
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.55 ui-sans-serif,system-ui,-apple-system,sans-serif}
  .wrap{max-width:52rem;margin:0 auto;padding:2.5rem 1.25rem 5rem}
  h1{font-size:1.9rem;margin:0 0 .2rem;letter-spacing:-.02em}
  .sub{color:var(--soft);margin:0 0 2rem;font-size:.95rem}
  h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.13em;color:var(--faint);
    margin:2.5rem 0 .9rem;font-weight:600}
  .stats{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.5rem}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:3px;
    padding:.4rem .7rem;font-size:.8rem;color:var(--soft)}
  .stat b{color:var(--ink)}
  .opp{background:var(--card);border:1px solid var(--line);border-radius:4px;
    padding:1rem 1.15rem;margin-bottom:.85rem}
  .opp.bounty{border-left:3px solid var(--gold)}
  .opp.hackathon{border-left:3px solid var(--accent)}
  .opp header{display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap}
  .type{font-size:.66rem;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);
    background:var(--accent-bg);padding:.18rem .45rem;border-radius:2px;white-space:nowrap}
  h3{font-size:1.02rem;margin:0;font-weight:600;line-height:1.35}
  h3 a{color:var(--ink);text-decoration:none} h3 a:hover{text-decoration:underline}
  .meta{color:var(--soft);font-size:.85rem;margin:.4rem 0 0}
  .verdict{margin:.6rem 0 0;font-size:.94rem}
  .why{color:var(--faint);font-size:.8rem;margin:.4rem 0 0}
  .draft{margin-top:.85rem;border-top:1px solid var(--line);padding-top:.75rem}
  .draft-head{font-size:.66rem;text-transform:uppercase;letter-spacing:.1em;
    color:var(--faint);margin-bottom:.45rem}
  .draft pre{white-space:pre-wrap;font:13px/1.6 ui-monospace,Menlo,monospace;
    background:var(--bg);border:1px solid var(--line);border-radius:3px;
    padding:.8rem;margin:0;overflow-x:auto}
  footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);
    color:var(--faint);font-size:.78rem}
</style></head><body><div class="wrap">
  <h1>Nightshift</h1>
  <p class="sub">${esc(date)} · ran while you were asleep</p>

  <div class="stats">
    <span class="stat"><b>${data.counts?.unique ?? 0}</b> found</span>
    <span class="stat"><b>${data.counts?.shortlisted ?? 0}</b> shortlisted</span>
    <span class="stat"><b>${reviewed.length + drafted.length}</b> read closely</span>
    <span class="stat"><b>${drafted.length}</b> drafted</span>
  </div>

  ${drafted.length ? `<h2>Ready to send</h2>${drafted.map(card).join("")}` : ""}
  ${reviewed.length ? `<h2>Looked at, not drafted</h2>${reviewed.map(card).join("")}` : ""}
  ${rest.length ? `<h2>Also found</h2>${rest.map(card).join("")}` : ""}

  <footer>Nightshift · nothing here was sent on your behalf. You decide what goes out.</footer>
</div></body></html>`;
}

const date = arg("date", newestRun());
if (!date) { console.error("No runs yet. Run: node tools/discover.mjs"); process.exit(1); }

const file = path.join(ROOT, "run", date, "shortlist.json");
if (!fs.existsSync(file)) { console.error(`No run for ${date}.`); process.exit(1); }

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const out = path.join(ROOT, "run", date, "report.html");
fs.writeFileSync(out, render(data, date));
console.log(path.relative(ROOT, out));
