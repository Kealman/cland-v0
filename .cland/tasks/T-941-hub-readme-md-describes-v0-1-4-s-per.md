---
id: T-941
kind: task
title: hub/README.md describes v0.1.4's per-user state and cland role launch
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-617
blocked_by: []
topic: topic-702
branch: t/T-941-hub-readme-md-describes-v0-1-4-s-per
created: 2026-10-20T06:13:09.187Z
updated: 2026-10-20T06:13:32.317Z
---

## Summary

E-617's C4 needs the docs to describe v0.1.4 as built. A read of hub/README.md at release candidate 2 (9b2cb194) found two gaps:
- "Per-user state" (~757) still names only `~/.cland/executor/spend.json`. Since T-609, the ledger is `~/.local/state/cland/spend.json` (XDG state), with a legacy write-through to `~/.cland/executor/spend.json`.
- The CLI table (~123) lists `cland role set`, `clear` and `list` but not `cland role launch`, which saves a role's launch settings.

## Acceptance criteria

- [ ] C1. "Per-user state" lists the XDG state ledger as primary, the legacy write-through and when it retires (T-794), and the workbench Neovim's own state directory as T-830 names it.
- [ ] C2. The CLI table and the roles section document `cland role launch` with its flags, matching `cland role` usage.
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.
