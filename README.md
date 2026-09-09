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

## Hosting it on a Bluehost VPS

This is where it belongs — an agent that only works when your laptop is open
isn't doing the thing it was built for. The whole setup is about fifteen minutes.

Nightshift is deliberately light: **one npm dependency, no browser, no build
step, no database.** That matters for what you need to rent.

### 1. Pick a plan

**The 2GB NVMe plan is enough.** Node plus a nightly agent run is a small
workload — there's no Chromium to install and nothing to compile. Take a bigger
plan if you intend to run other things on the same box, not for this.

Provision it with **Ubuntu** (22.04 or 24.04 LTS) and grab the server IP and
root password from your Bluehost control panel. Bluehost VPS is self-managed
with full root, which is exactly what this needs — you're configuring the
environment yourself.

### 2. Connect and make a working user

Don't run the agent as root.

```bash
ssh root@YOUR_SERVER_IP

adduser nightshift
usermod -aG sudo nightshift

# Copy your SSH key over so you can log in without the root password
rsync --archive --chown=nightshift:nightshift ~/.ssh /home/nightshift/

exit
ssh nightshift@YOUR_SERVER_IP
```

While you're here, basic hygiene:

```bash
sudo apt update && sudo apt upgrade -y
sudo ufw allow OpenSSH && sudo ufw --force enable
```

### 3. Install Node and Claude Code

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
node --version                       # expect v20.x

sudo npm install -g @anthropic-ai/claude-code
claude --version
```

### 4. Get Nightshift onto the box

```bash
sudo mkdir -p /srv && sudo chown nightshift:nightshift /srv
git clone https://github.com/rafcopy/nightshift.git /srv/nightshift
cd /srv/nightshift
npm install
```

### 5. Keys and spend limit

**Set a spend limit before the first unattended night**, at
[console.anthropic.com](https://console.anthropic.com/settings/limits). An
unattended job is the one place a runaway loop goes unnoticed until the bill
arrives.

```bash
cp .env.example .env
nano .env
```

```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...        # optional: 60 -> 5000 GitHub requests/hour
```

```bash
chmod 600 .env              # readable only by you
```

### 6. Build your profile

```bash
cd /srv/nightshift && claude
```

Run `/setup` and answer the questions, then exit. Or copy the example and edit
it by hand:

```bash
cp profile.example.yaml profile.yaml && nano profile.yaml
```

### 7. Prove it works before trusting it to cron

```bash
node tools/discover.mjs      # free — no model calls. Should print a shortlist.
./bin/night.sh               # the real thing, once, while you watch
```

If discovery returns nothing, the profile's `skills` or `avoid` lists are too
narrow — fix that before scheduling. If `night.sh` fails, it tells you which of
the API key or profile is missing.

### 8. Schedule it

```bash
crontab -e
```

```cron
0 23 * * *  /srv/nightshift/bin/night.sh >> /srv/nightshift/run/night.log 2>&1
```

Cron runs in UTC unless the server says otherwise — set the box to your timezone
so "23:00" means what you think:

```bash
sudo timedatectl set-timezone Asia/Kolkata
```

**`bin/night.sh` exists precisely because cron does not inherit your shell
environment.** Calling `claude` straight from a crontab works when you test it
by hand and then silently does nothing at 3am, because `ANTHROPIC_API_KEY`
isn't set. The runner sources `.env` explicitly.

### 9. Read it in the morning

Simplest — pull the report to your laptop:

```bash
scp nightshift@YOUR_SERVER_IP:/srv/nightshift/run/*/report.html ~/Desktop/
```

Or, since you're already paying for a machine that serves web pages, let it
serve the report:

```bash
sudo apt install -y nginx apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd you        # don't leave this public
```

Point an nginx site at `/srv/nightshift/run`, put it behind that basic-auth
file, and your morning read is a bookmark instead of an scp. **Add the password
file** — the report contains what you're applying for.

### Checking on it

```bash
tail -50 /srv/nightshift/run/night.log      # what happened last night
ls -la /srv/nightshift/run/                 # one directory per night
```

If a morning comes and there's no new directory, the log says why. The usual
causes are a missing `.env`, an exhausted spend limit, or a source API being
down — and the run is built to survive that last one.

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
