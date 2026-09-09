#!/usr/bin/env node
/**
 * Nightshift — record what the agent decided about one opportunity.
 *
 *   node tools/annotate.mjs --id gh-123 --verdict "Good fit: ..." 
 *   node tools/annotate.mjs --id gh-123 --draft-file run/2026-09-09/drafts/gh-123.md
 *   node tools/annotate.mjs --id gh-123 --skip "Requires Solidity"
 *
 * Exists so the agent never has to rewrite the whole shortlist file by hand,
 * which is slow and easy to corrupt halfway through a long unattended run.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };

function newestRun() {
  const runs = path.join(ROOT, "run");
  if (!fs.existsSync(runs)) return null;
  const dirs = fs.readdirSync(runs).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dirs.at(-1) ?? null;
}

const id = arg("id");
if (!id) { console.error("--id is required"); process.exit(1); }

const date = arg("date", newestRun());
const file = path.join(ROOT, "run", date ?? "", "shortlist.json");
if (!fs.existsSync(file)) { console.error(`No run found at ${file}`); process.exit(1); }

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const opp = (data.shortlist ?? []).find((o) => o.id === id);
if (!opp) { console.error(`No opportunity with id ${id} in this run.`); process.exit(1); }

const verdict = arg("verdict");
const skip = arg("skip");
const draftFile = arg("draft-file");

if (verdict) opp.verdict = verdict;
if (skip) { opp.verdict = skip; opp.skipped = true; }
if (draftFile) {
  const p = path.resolve(ROOT, draftFile);
  if (!fs.existsSync(p)) { console.error(`No draft at ${draftFile}`); process.exit(1); }
  opp.draft = fs.readFileSync(p, "utf8");
  opp.draft_file = path.relative(ROOT, p);
}
opp.reviewed_at = new Date().toISOString();

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log(`${id}: ${opp.draft ? "drafted" : opp.skipped ? "skipped" : "reviewed"}`);
