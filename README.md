# Nightshift

**An agent that job-hunts while you sleep.**

Every night it checks GitHub bounties, the Hacker News hiring thread, RemoteOK
and Unstop hackathons. It reads what it finds, works out which few are actually
worth your time, and drafts the applications. You wake up, read one page, and
decide what to send.

The good opportunities go to whoever answers first. That is usually not the
person who checks in the morning.

## The loop

```
  23:00   discover    four sources, deduped, filtered, ranked      free
  23:01   read        the agent opens the top ~12 and judges fit   costs tokens
  23:20   draft       writes the 3 best applications properly      costs tokens
  23:40   report      one page, waiting for you                    free
  08:00   /review     you decide what actually gets sent           you
```

Nothing is ever sent on your behalf. Drafts sit in a folder until you say so.

## What makes it worth running overnight

Two honest reasons, and neither is that your laptop can't do it — it can, if you
leave it awake:

**Being early is the edge.** A bounty posted at 2am with no comments is worth
more than the same bounty at noon with eight people in the thread. The scoring
weights unclaimed and recently-posted work accordingly.

**It takes real time.** Reading a dozen opportunities properly — opening the
repo, checking whether the issue is specified, looking at whether anyone already
started — is twenty to forty minutes of actual work. That is not something you
want to sit and watch, and it is not something you want to remember to start.

## Quick start

Needs [Node 18+](https://nodejs.org) and an agent runtime (Claude Code,
OpenClaw or Hermes).

```bash
git clone https://github.com/rafcopy/nightshift.git
cd nightshift
npm install
cp .env.example .env          # optional: a GitHub token raises the rate limit
```

Then open the folder in your agent and run `/setup`. When it's done:

```bash
node tools/discover.mjs       # free — see what's out there right now
```

Discovery makes **no model calls at all**, so run it as often as you like. Only
the reading and drafting stage costs anything.

## Running it unattended

This is the part that wants an always-on box rather than a laptop. The pattern
is the same anywhere you can run a scheduled job:

```cron
# every night at 23:00
0 23 * * *  cd /srv/nightshift && /path/to/agent run /nightshift >> run/night.log 2>&1
```

Point `<agent>` at whichever runtime you're using. Two things to get right:

- **`.env` needs to be readable by the scheduled job.** Cron does not inherit
  your shell's environment — this is the single most common reason a nightly run
  works by hand and silently does nothing at 3am.
- **Set a spend limit** on your API key before the first unattended night. A run
  that loops unnoticed is the one expensive failure mode here.

Check it worked: `run/<date>/report.html` should exist in the morning, and
`run/night.log` will tell you what happened if it doesn't.

## Sources

| Source | What it finds | Access |
|---|---|---|
| **GitHub** | Open issues with bounty labels | Public Search API; a token lifts the limit from 60 to 5000/hour |
| **Hacker News** | The monthly *Who is hiring?* thread | Public Algolia API |
| **RemoteOK** | Remote roles | Their published `/api` feed |
| **Unstop** | Hackathons and competitions | Public API; their robots.txt explicitly allows AI agents |

All four were verified working in September 2026. Adding one is a single file in
`sources/` — **check the site's `robots.txt` first and put the result in the PR.**
An adapter for a site that disallows automated access won't be merged.

## What it will not do

- **Send anything.** It drafts; you send. There is no "auto-apply" mode and there
  won't be.
- **Invent experience.** Every claim in a draft traces to your `profile.yaml`.
  Drafts say "would confirm by running the failing test" rather than promising a
  fix it isn't sure of, because a maintainer can tell the difference.
- **Replace judgement.** It shortlists and drafts. Whether a gig is worth taking
  is yours.

## Honest limits

The nightly shortlist is only as good as `profile.yaml`. The first few mornings
will surface things you don't want — that's what `/review` is for: every rejection
tunes `avoid` and `wants`, and the run gets sharper over about a week.

MIT licensed.
