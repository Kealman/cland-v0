---
id: T-603
kind: task
title: Unpinned Claude Code launches set CLAUDE_CONFIG_DIR=~/.claude explicitly and run on an empty profile (signed out, untrusted)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:43:33.915Z
updated: 2026-10-16T11:43:33.915Z
---

## Summary

An unpinned Claude Code launch from the hub sets `CLAUDE_CONFIG_DIR` explicitly to `~/.claude` even when the hub's own environment never had it; Claude Code 2.1.301 treats any explicit value as a separate profile (config in `$CLAUDE_CONFIG_DIR/.claude.json`, keychain item `Claude Code-credentials-<sha256(dir)[:8]>`), so the session runs signed out and without the project's trust. The explicit default must be dropped: pass the variable only when the hub inherited it or the account pins a directory.

## Facts

- `hub/src/adapters/claude-code.ts:226-227` computes `#configDir` as `env.CLAUDE_CONFIG_DIR || ~/.claude` and copies it into the adapter's env only when the hub had it, but `:418` passes `accountEnv: { CLAUDE_CONFIG_DIR: this.#configDir, ...request.accountEnv }` on every launch and `:611` does the same on resume, so the fallback `~/.claude` reaches the child as an explicit setting. Introduced by T-362 (eb32246f, 2026-10-14).
- Verified read-only on this Mac with Claude Code 2.1.301: `claude auth status` reports `loggedIn: true` with the variable unset and `loggedIn: false, authMethod: none` with `CLAUDE_CONFIG_DIR=~/.claude`. `~/.claude/.claude.json` was first created 2026-10-14T06:23Z, about an hour after the merge, and holds no project trust; the project root is trusted only in `~/.claude.json`.
- This matches D36 (docs/spec/v0.1.3.md): the Claude Code Aide launch at the trusted root stopped on the workspace-trust prompt. The trust prompt was a symptom of the empty profile, not the human's missing acceptance.

## Impact

Every Claude Code launch without `account` runs on an empty profile unless the hub's own environment carries `CLAUDE_CONFIG_DIR`. The default Aide launch (no account in roles.toml) is affected; the onboarding flow planned for v0.1.4 (map M-591) launches exactly such an Aide first.

## Fix

Pass `CLAUDE_CONFIG_DIR` to the child only when the hub inherited it (`env.CLAUDE_CONFIG_DIR`) or `request.accountEnv` carries the account's directory; keep `#configDir` for the hub's own bookkeeping (polling schedule per directory, the attach command, the signed-out remedy text), and make the remedy text print the variable only when it is actually set. A test: a launch with a clean hub environment spawns `claude` with no `CLAUDE_CONFIG_DIR`; a pinned account still gets its directory.

Found by the design session's research Q-593 (harness setup facts) under the map M-591.
