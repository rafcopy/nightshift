#!/usr/bin/env bash
#
# Nightshift — the nightly entrypoint. This is what cron calls.
#
# Exists because cron does NOT inherit your shell environment. Running
# `claude` directly from a crontab works by hand and then silently does
# nothing at 3am, because ANTHROPIC_API_KEY isn't set. This sources .env
# explicitly so that can't happen.
#
#   0 23 * * *  /srv/nightshift/bin/night.sh >> /srv/nightshift/run/night.log 2>&1

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

echo "───────────────────────────────────────────────"
echo "nightshift start  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# Load .env without echoing secrets.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
else
  echo "warning: no .env found at $REPO/.env"
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "error: ANTHROPIC_API_KEY is not set. Add it to $REPO/.env"
  exit 1
fi

if [ ! -f profile.yaml ]; then
  echo "error: no profile.yaml. Run /setup, or copy profile.example.yaml."
  exit 1
fi

# Tool approvals come from .claude/settings.json, which allowlists exactly what
# the night run needs. acceptEdits keeps it from blocking on a prompt nobody is
# awake to answer. Deliberately NOT --dangerously-skip-permissions: this box has
# internet access and holds an API key.
claude -p "/nightshift" --permission-mode acceptEdits

echo "nightshift done   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
