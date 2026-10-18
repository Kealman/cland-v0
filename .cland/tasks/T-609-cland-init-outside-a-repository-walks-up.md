---
id: T-609
kind: task
title: "`cland init` outside a repository walks up and takes HOME as the project root because of ~/.cland"
state: open
status: in progress
size: M
labels:
  - bug
  - hub
  - init
assignee: null
parent: E-612
blocked_by:
  - T-639
topic: topic-496
branch: t/T-609-cland-init-outside-a-repository-walks-up
created: 2026-10-16T14:15:41.938Z
updated: 2026-10-18T09:20:05.030Z
---

## Summary

On 2026-10-16 at about 12:41Z, a prototype `cland init` run in a non-empty folder with no git repository looked upward for a project root. It took the human's HOME as the project, because HOME holds `~/.cland/`, the hub's per-user state directory (executor/spend.json). It wrote cland's config, AGENTS.md, docs/agents, 44 skills, 44 symlinks and 11 hooks into HOME, and put `worktree.bgIsolation` into the global `~/.claude/settings.json`. Undoing that by hand also deleted `~/.cland/executor/spend.json`, the shared droplet spend ledger. The prototype uses the same root-finding logic as dev. Reported by the cland-design session; the human asked for this item in v0.1.4.

## Acceptance criteria

- [ ] C1. `cland init` (and `update`) works only on the current directory or `--dir`. When the root it finds differs from the cwd, it refuses and names both paths.
- [ ] C2. HOME is never accepted as a project root, and a test proves `cland init` in a non-repository folder under a HOME that holds the hub's state directory writes nothing outside that folder.
- [ ] C3. The hub's per-user state directory no longer shares its name with the project marker. For example, it moves to `~/.local/state/cland`, with a one-time migration of executor/spend.json.
