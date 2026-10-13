---
id: T-265
kind: task
title: "Claude adapter: polling claude agents --json near token expiry can log a
  config directory out (claude-code#95822)"
state: open
status: backlog
labels:
  - hub
assignee: null
parent: E-272
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:36:53.954Z
updated: 2026-10-12T11:35:23.658Z
---

## What happened

Found by the T-240 research (docs/research/account-limits.md on research/account-limits): Claude Code issue anthropics/claude-code#95822 (open) reports that short-lived `claude` commands run near the OAuth token's expiry (`auth status`, `--bg`, `agents --json`) can spend the refresh token and log a config directory out; one report involves several `CLAUDE_CONFIG_DIR`s, another `agents --json` on a timer. cland's Claude adapter polls `claude agents --json` every 5 seconds today, which is the worst case once several config directories (accounts, T-240) are in use.

## What to do

Decide and implement a safer pattern for the adapter's polling: fewer short-lived `claude` invocations (longer interval, or state from the `--bg` supervisor's own channel), never a burst of them around a refresh, and a recovery when a config directory turns out logged out (an event and a clear message to the human, no silent retries). Re-check the upstream issue first; close this if a fix shipped.

## Acceptance criteria

- [ ] The adapter's polling of `claude agents --json` is at most one call per 30 seconds per config directory, or replaced by a push source.
- [ ] A logged-out config directory produces one event and one message to the human, with the directory named, and no retry storm.
- [ ] The behaviour is covered by a fake-harness test.
