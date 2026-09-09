#!/usr/bin/env node
/**
 * Nightshift — discovery stage.
 *
 *   node tools/discover.mjs                # all sources
 *   node tools/discover.mjs --only github
 *   node tools/discover.mjs --json         # machine-readable, for the agent
 *
 * Makes NO model calls. Fetches every source, drops what the profile rules out,
 * ranks what is left, and writes a shortlist for the agent stage to read.
 * Free to run as often as you like.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { rank } from "./score.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const AS_JSON = process.argv.includes("--json");

const SOURCES = ["github-bounties", "hackernews", "remoteok", "unstop"];

function runDir() {
  const stamp = new Date().toISOString().slice(0, 10);
  return path.join(ROOT, "run", stamp);
}

async function main() {
  const profilePath = path.resolve(ROOT, arg("profile", "profile.yaml"));
  if (!fs.existsSync(profilePath)) {
    console.error("No profile.yaml. Copy profile.example.yaml, or run /setup.");
    process.exit(1);
  }
  const profile = yaml.load(fs.readFileSync(profilePath, "utf8"));

  const only = arg("only", null);
  const names = only ? SOURCES.filter((s) => s.includes(only)) : SOURCES;

  const all = [];
  const stats = [];

  for (const name of names) {
    const t0 = Date.now();
    try {
      const mod = await import(`../sources/${name}.mjs`);
      const items = await mod.fetch_();
      all.push(...items);
      stats.push({ source: mod.label ?? name, count: items.length, ms: Date.now() - t0, ok: true });
    } catch (e) {
      // One dead source must never kill the night's run.
      stats.push({ source: name, count: 0, ms: Date.now() - t0, ok: false, error: e.message });
    }
  }

  // De-duplicate across sources by URL.
  const byUrl = new Map();
  for (const o of all) if (o.url && !byUrl.has(o.url)) byUrl.set(o.url, o);
  const unique = [...byUrl.values()];

  const { shortlist, dropped } = rank(unique, profile);

  const dir = runDir();
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, "shortlist.json");
  fs.writeFileSync(outFile, JSON.stringify({
    generated_at: new Date().toISOString(),
    stats,
    counts: { fetched: all.length, unique: unique.length, shortlisted: shortlist.length, dropped: dropped.length },
    shortlist,
  }, null, 2));

  if (AS_JSON) {
    console.log(JSON.stringify({ file: outFile, counts: { shortlisted: shortlist.length }, shortlist: shortlist.slice(0, 40) }, null, 2));
    return;
  }

  console.log("");
  for (const s of stats) {
    console.log(s.ok
      ? `  ${String(s.count).padStart(4)}  ${s.source.padEnd(20)} ${s.ms}ms`
      : `     -  ${s.source.padEnd(20)} FAILED: ${s.error}`);
  }
  console.log(`\n  ${unique.length} unique  →  ${shortlist.length} shortlisted, ${dropped.length} dropped\n`);

  for (const o of shortlist.slice(0, 15)) {
    console.log(`  ${String(o.score).padStart(5)}  [${o.type}] ${String(o.title).slice(0, 62)}`);
    console.log(`         ${o.org ?? "—"}  ·  ${o.score_reasons.slice(0, 3).join("  ·  ")}`);
    console.log(`         ${o.url}`);
    console.log("");
  }

  console.log(`  Full shortlist: ${path.relative(ROOT, outFile)}`);
  console.log(`  Next: /nightshift to have the agent read and draft.\n`);
}

main();
