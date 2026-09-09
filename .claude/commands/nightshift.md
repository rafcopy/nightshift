---
description: The overnight run — read the shortlist, judge fit, draft responses
allowed-tools: Read, Write, Bash(node tools/discover.mjs*), Bash(node tools/report.mjs*), Bash(node tools/annotate.mjs*), Bash(mkdir -p run/*), WebFetch, WebSearch
---

# /nightshift — do the night's work

This is the run that happens while nobody is watching. It has to finish on its
own, stay inside a budget, and leave behind something worth waking up to.

## 1. Discover — free

```
node tools/discover.mjs
```

Writes `run/<today>/shortlist.json`. No model calls; this costs nothing. Read
the file. Note `counts` and which sources failed — a source being down is
normal and is not a reason to stop.

## 2. Read the shortlist properly

Take the top `run.max_deep_reviews` from `profile.yaml` (default 12) and work
down the list. For each one:

**Read the actual opportunity.** The description in the shortlist is truncated.
Fetch the real page when you need more — the GitHub issue, the job post, the
hackathon brief.

**Judge it against the profile, honestly.** The score that got it here is
keyword arithmetic and it is often wrong. You can read. Ask:

- Is this genuinely doable with the `skills.strong` list, or does it only look
  that way because a keyword matched?
- For a bounty: is the issue actually *specified*, or is it a vague wish? Has
  someone already opened a PR? Is the repo alive?
- Is the money real and stated, or implied?
- Does the effort match `wants.bounty.max_effort_hours`?

**Record the verdict either way:**

```
node tools/annotate.mjs --id <id> --verdict "Worth it: the failing test is included and it is a one-file fix in the Node client."
node tools/annotate.mjs --id <id> --skip "Issue is a feature request with no spec; the 'bounty' label has no amount attached."
```

Skipping with a stated reason is a real result. A morning report that says
*"I read twelve, eleven were not worth your time, here is the one that was"*
is more useful than three mediocre drafts.

## 3. Draft for the best few

For at most `run.max_drafts` (default 3), write the actual thing that gets sent:

- **Bounty** → a comment claiming the issue: what you understand the problem to
  be, your proposed approach, and a realistic timeframe. If you can see the fix,
  say what it is specifically. Maintainers assign to whoever sounds like they
  have already read the code.
- **Contract / role** → a short application. Name the specific thing about the
  posting you are responding to, and the one piece of prior work that earns a
  reply.
- **Hackathon** → what to build, given the theme and what the profile can
  actually ship in the time available.

Write each to `run/<today>/drafts/<id>.md`, then attach it:

```
node tools/annotate.mjs --id <id> --draft-file run/<today>/drafts/<id>.md
```

### Rules for drafts

- **Every claim traces to `work` or `skills` in the profile.** No invented
  experience, no borrowed credentials, no "I have extensive experience with"
  unless the profile says so.
- **Short.** A bounty comment is three or four sentences. Nobody reads a wall.
- **No flattery and no filler.** Not "I am excited about the opportunity". Say
  what you would do and how long it would take.
- **Flag your own uncertainty.** If you are 60% sure the fix is what you think,
  the draft should say "looks like X, would confirm by running the failing test"
  rather than promising a result. It is being read by an engineer.

## 4. Build the report

```
node tools/report.mjs
```

## 5. Leave a note

Write two or three sentences to `run/<today>/summary.md`: what you found, what
you skipped and why, and anything that needs a human decision. This is the first
thing read in the morning.

## Budget

`max_deep_reviews` and `max_drafts` are a spend cap, not a target. Stop when the
list stops being worth reading — if opportunity nine is clearly weak, the ones
below it are too. **Never send anything.** Drafts sit in the folder until a
person decides.
