---
id: T-842
kind: task
title: Trust is granted for every installed harness without a question and reported in one line
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-613
blocked_by:
  - T-837
topic: null
branch: null
created: 2026-10-19T06:34:13.266Z
updated: 2026-10-19T06:34:13.266Z
---

## Summary

Claude Code refuses a background launch in an untrusted folder (T-24, T-58, D36), and Codex asks at its first attach (T-42). Setup records each installed harness's trust the way the harness's own dialog does, without asking, and reports it in one line, "trusted for …" (Q-593).

## What to build

- **Claude Code.** `projects["<realpath of the root>"].hasTrustDialogAccepted = true` goes into the profile's `.claude.json`.
  - The profile is the one the hub launches with (`$CLAUDE_CONFIG_DIR/.claude.json`, else `~/.claude.json`), plus each Claude Code account a role names (question 5).
  - The write happens under Claude Code's own `<file>.lock` folder, which counts as stale after 10 s.
  - The file is re-read under the lock, written through a temporary file and renamed, keeping every other key, the mode (0600 when new), a symlinked target, and the trailing newline.
  - The prototype's `grantClaudeTrust` encodes this.
- **Codex.** `projects."<folder>".trust_level = "trusted"` is written through a short-lived app-server's `config/batchWrite`, in the `CODEX_HOME` the hub launches with (plus role accounts). The folder is spelt as given, and also as its real path when the two differ. The app-server's process group is ended afterwards, so no Codex daemon is left (Q-594 risk).
- **OpenCode** has no trust gate and is named as such.
- **The line.** One `trust` line:
  - `done` "trusted for claude-code (~/.claude.json), codex (~/.codex/config.toml)";
  - `ok` when every entry is already there;
  - `fail` naming the harness and the manual way (its own dialog) when a write does not re-read as trusted.
- The line says it wrote the human's real harness configuration for this path (risk). Without a terminal and without `--yes`, the step is `open` and writes nothing (question 2).

## Acceptance criteria

- [ ] C1. On a scratch `.claude.json` with other projects and keys, the grant adds the root's real path as trusted and leaves every other key, the mode and the trailing newline as they were (T1 on a temp file).
- [ ] C2. A fresh lock folder held by another writer makes the grant wait and then succeed once it is released, while a lock older than 10 s is taken over (T1, fake clock).
- [ ] C3. With Claude Code and Codex installed, one `trust` line reports both, and the injected Codex client received one `config/batchWrite` whose edits are the root's spellings (T1).
- [ ] C4. A second run finds both entries and reports `trust ok` without writing (T1, asserting no write).
- [ ] C5. The Codex grant ends the app-server's process group when it returns or fails (T1 with an injected spawner).
- [ ] C6. Without a terminal and without `--yes`, nothing is written and the line is `open` (T1).
