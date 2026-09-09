/**
 * Nightshift — deterministic pre-filter and scoring.
 *
 * WHY THIS IS CODE AND NOT A PROMPT
 * ---------------------------------
 * The overnight agent stage costs money per opportunity it reads. Four sources
 * return several hundred candidates a night; sending all of them to a model
 * would be slow and expensive for no gain. So plain arithmetic does the coarse
 * pass — drop the obvious noise, rank the rest — and the model only ever reads
 * the shortlist.
 *
 * This stage is deliberately generous. It is a filter, not a judge: it should
 * discard only what is clearly wrong, and leave the actual judgement calls to
 * the agent, which can read.
 */

const lower = (s) => String(s ?? "").toLowerCase();

function haystack(opp) {
  return lower([opp.title, opp.description, (opp.tags ?? []).join(" "), opp.org].join(" \n "));
}

/** Hard exclusions from the profile's `avoid` block. */
export function isExcluded(opp, profile) {
  const hay = haystack(opp);
  const avoid = profile.avoid ?? {};

  for (const t of avoid.tech ?? []) {
    // Word-boundary match so "Go" does not hit "Google".
    if (new RegExp(`\\b${lower(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay)) {
      return `avoids ${t}`;
    }
  }
  for (const k of avoid.keywords ?? []) {
    if (hay.includes(lower(k))) return `mentions "${k}"`;
  }
  return null;
}

/** Does this opportunity clear the money floor the profile set for its type? */
function meetsValueFloor(opp, profile) {
  const wants = profile.wants ?? {};

  if (opp.type === "bounty") {
    const floor = wants.bounty?.min_usd;
    if (floor && opp.value_usd != null && opp.value_usd < floor) {
      return `$${opp.value_usd} is below your $${floor} floor`;
    }
  }
  if (opp.type === "hackathon") {
    const floor = wants.hackathon?.min_prize_usd;
    // Prizes are often in INR or unstated, so only reject on a confident number.
    if (floor && opp.value_usd != null && opp.value_usd < floor) {
      return `prize $${opp.value_usd} is below your $${floor} floor`;
    }
  }
  return null;
}

export function score(opp, profile) {
  const hay = haystack(opp);
  const skills = profile.skills ?? {};
  const wants = profile.wants ?? {};
  const reasons = [];
  let points = 0;

  // Skill overlap. Strong skills are what you can actually be paid for today.
  const hit = (list, weight, label) => {
    const found = (list ?? []).filter((s) =>
      new RegExp(`\\b${lower(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay));
    if (found.length) {
      points += weight * found.length;
      reasons.push(`${label}: ${found.slice(0, 4).join(", ")}`);
    }
  };
  hit(skills.strong, 5, "strong");
  hit(skills.working, 2, "working");
  hit(skills.learning, 0.5, "learning");

  // Interests
  const interests = (wants.interested_in ?? []).filter((t) => hay.includes(lower(t)));
  if (interests.length) {
    points += 2 * interests.length;
    reasons.push(`interest: ${interests.slice(0, 3).join(", ")}`);
  }

  // Money on the table. Weighted by type, because the figure means different
  // things: a bounty's amount is the whole differentiator, whereas every job
  // listing has a salary, so a big one says little about fit. Without this, a
  // $300k annual salary buries every bounty in the list.
  const VALUE_WEIGHT = { bounty: 2.5, hackathon: 2.0, contract: 1.5, remote_job: 0.8 };
  if (opp.value_usd) {
    points += Math.min(10, Math.log10(opp.value_usd) * (VALUE_WEIGHT[opp.type] ?? 1));
    reasons.push(`$${opp.value_usd.toLocaleString()}`);
  }

  // Freshness. Being early is most of the edge on bounties and gigs.
  if (opp.posted_at) {
    const hours = (Date.now() - new Date(opp.posted_at).getTime()) / 36e5;
    if (Number.isFinite(hours)) {
      if (hours <= 24)      { points += 6; reasons.push("posted today"); }
      else if (hours <= 72) { points += 3; reasons.push("posted this week"); }
      else if (hours > 720) { points -= 3; }
    }
  }

  // An unclaimed bounty is worth more than one with a queue on it.
  if (opp.type === "bounty" && typeof opp.comments === "number") {
    if (opp.comments === 0) { points += 3; reasons.push("no comments yet"); }
    else if (opp.comments > 12) { points -= 3; reasons.push(`${opp.comments} comments — likely taken`); }
  }

  // Remote preference. HN listings in particular are tagged as jobs but are
  // often onsite-only, which is worth catching before the agent spends tokens
  // reading one.
  if (["remote_job", "contract"].includes(opp.type)) {
    const wantsRemote = profile.wants?.contract?.remote_only === true;
    const saysOnsite = /\bonsite\b|\bon-site\b|\bin[- ]office\b/.test(hay);
    const saysRemote = /\bremote\b|\bwork from home\b|\bwfh\b/.test(hay);
    if (wantsRemote && saysOnsite && !saysRemote) {
      points -= 8;
      reasons.push("onsite only");
    } else if (saysRemote) {
      points += 2;
      reasons.push("remote");
    }
  }

  // Only surface types the profile asked for.
  if (Array.isArray(wants.types) && !wants.types.includes(opp.type)) points -= 12;

  return { points: Math.round(points * 10) / 10, reasons };
}

/** Filter + rank a batch. Returns { shortlist, dropped }. */
export function rank(opportunities, profile) {
  const dropped = [];
  const kept = [];

  for (const opp of opportunities) {
    const excluded = isExcluded(opp, profile) ?? meetsValueFloor(opp, profile);
    if (excluded) { dropped.push({ ...opp, dropped_because: excluded }); continue; }

    const { points, reasons } = score(opp, profile);
    if (points <= 0) { dropped.push({ ...opp, dropped_because: "no skill or interest overlap" }); continue; }
    kept.push({ ...opp, score: points, score_reasons: reasons });
  }

  kept.sort((a, b) => b.score - a.score);
  return { shortlist: kept, dropped };
}
