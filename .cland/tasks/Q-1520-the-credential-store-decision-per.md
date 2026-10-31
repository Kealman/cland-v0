---
id: Q-1520
kind: question
title: The credential store decision per harness
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1511
blocked_by:
  - Q-1514
  - Q-1518
topic: null
branch: null
created: 2026-10-31T14:35:39.541Z
updated: 2026-10-31T18:01:12.553Z
closed: 2026-10-31T18:01:12.553Z
---

## Question

The credential store decision per harness (map M-1511 round-3 decisions 5–9), after the credential research and the two-host prototype: copy, long-lived token, API key or login per host for Claude Code, Codex and OpenCode; the store's format, encryption and key location; the login and re-login flows and their cards; the one-host pin for rotating archives; what doctor and status show; the boundary with spec v0.1.2 §3.13 (cland never parses credentials) written as an ADR amendment if needed. Grilling with the human.

## Comments

### human · 2026-10-31T18:01:12.421Z

## Resolution (round 8, 2026-10-31, all accepted by the human)

1. **Volume, not snapshots.** A `disk` login keeps its volume for good and only detaches at host stop (~7 s); the next bind re-attaches the same volume. Snapshots are backups taken after a sign-in and at most daily, the last two kept; they are the source for `exclusive = false` readers and for moves. A host stop never waits on a snapshot. A login belongs to a region; a pool in another region needs its own login.
2. **Per harness.** Claude Code: a sign-in per login over `ssh -t` (a new device), `exclusive = true`. Codex: the same through `--device-auth`, `exclusive = true`, one login per account by default; a second login of the same account only by the human's deliberate choice (the kick-out hint). OpenCode: the Go key as a `key` login on any number of hosts. Anthropic and OpenAI API keys as optional `key` logins (per-token billing). The Mac's logins are never snapshotted.
3. **Open points go to the first live run, not a prototype:** whether a live Claude or Codex process picks up re-signed tokens without a relaunch (if not, `login signin` relaunches that host's sessions with their worktrees); the hub reconciles login volumes with the provider at start and frees those whose host died; sessions of a destroyed host become exited (the prototype left them "running").
4. **Key store and the ADR boundary.** `.cland/auth/` holds `key` logins encrypted with the key from a known `[auth]` section of secrets.toml (the strict reader learns it). The ADR and spec v0.1.2 §3.13 are amended: cland stores keys the human entered through stdin and the metadata of `disk` logins, and never reads the contents of a login disk or keeps a harness's session tokens.
5. **Operations.** `cland login add <harness> [--name] [--pool]`, `login list` (name, harness, account, exclusive, state, host, region, last sign-in), `login signin <name>` (sign in again in place), `login remove <name>` (volume and snapshots, when not in use), `login snapshot <name>`; the same on the web's Hosts page and as cards in Telegram and Discord (phone sign-in: link and code in a card).

Note from the human: DigitalOcean Kubernetes has a cheap tier (free, non-HA control plane; the smallest node about $12/month); the cut and the shape-B cost table use that minimal DOKS instead of the $62 estimate once verified.
