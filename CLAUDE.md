# Nightshift — working notes for Claude

An overnight agent that finds developer opportunities, judges which are worth
doing, and drafts the applications. Runs unattended on a schedule.

## The shape

```
sources/*.mjs        one file per source; export `id`, `label`, `fetch_()`
tools/score.mjs      deterministic filter + ranking. NO model calls
tools/discover.mjs   runs all sources -> run/<date>/shortlist.json. NO model calls
tools/annotate.mjs   agent writes verdicts/drafts back into the run
tools/report.mjs     renders the morning page. NO model calls
.claude/commands/    setup, nightshift (the run), review (the morning)
bin/night.sh         cron entrypoint; sources .env then calls `claude -p`
```

**Only the agent stage costs money.** Discovery, scoring and reporting are plain
code so they can run as often as anyone likes. Keep it that way — if you find
yourself wanting a model call in `discover.mjs`, that logic belongs in
`/nightshift` instead.

## Non-negotiables

**Never send anything.** No posting comments, no submitting applications, no
emails. Drafts land in `run/<date>/drafts/` and a human decides. There is no
flag to change this.

**Never invent experience.** Every claim in a draft traces to `work` or `skills`
in `profile.yaml`. Drafts are read by engineers who can tell.

**Never work around a site's robots.txt.** Check before adding a source, and put
the finding in the PR. Verified September 2026: Unstop explicitly allows AI
agents; GitHub, HN Algolia and RemoteOK all publish the endpoints used here.

**The run must survive a dead source.** `discover.mjs` catches per-source
failures. One API being down at 3am must never lose the night.

## Unattended runs

`bin/night.sh` is what cron calls. It exists because cron does not inherit the
shell environment — calling `claude` straight from a crontab works by hand and
then silently does nothing overnight, with no error, because the API key is not
set. Any change to how the night run is invoked goes in that script.

Tool approvals come from `.claude/settings.json`, which allowlists exactly what
the run needs, plus `--permission-mode acceptEdits` so nothing blocks on a
prompt at 3am. **Do not switch this to `--dangerously-skip-permissions`** — the
box has internet access and holds an API key, which is the exact situation that
flag warns against.

## Staleness is the quiet failure

The Hacker News adapter refuses any thread older than 60 days, because the
"Freelancer? Seeking freelancer?" series was discontinued in 2016 and a naive
title search happily returns decade-old gigs as current. Any source that could
serve stale data needs a guard like that. Serving old opportunities as new is
worse than serving none.

## Scoring notes

`score.mjs` is a coarse filter, deliberately generous — it should discard only
what is clearly wrong and leave real judgement to the agent, which can read.

Value is weighted per type (`VALUE_WEIGHT`) because the figures are not
comparable: a bounty's amount is the whole differentiator, while every job
listing has a salary, so a big one says little. Without that weighting a $300k
salary buries every bounty in the list.

## Style

Drafts are short, specific, and admit uncertainty. No "excited about the
opportunity", no adjectives the user would not say out loud. A bounty comment is
three or four sentences from someone who has clearly read the code.
