---
id: T-941
kind: task
title: hub/README.md describes v0.1.4's per-user state and cland role launch
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-617
blocked_by: []
topic: topic-702
branch: t/T-941-hub-readme-md-describes-v0-1-4-s-per
created: 2026-10-20T06:13:09.187Z
updated: 2026-10-20T07:02:12.490Z
closed: 2026-10-20T07:02:12.490Z
---

## Summary

E-617's C4 needs the docs to describe v0.1.4 as built. A read of hub/README.md at release candidate 2 (9b2cb194) found two gaps:
- "Per-user state" (~757) still names only `~/.cland/executor/spend.json`. Since T-609, the ledger is `~/.local/state/cland/spend.json` (XDG state), with a legacy write-through to `~/.cland/executor/spend.json`.
- The CLI table (~123) lists `cland role set`, `clear` and `list` but not `cland role launch`, which saves a role's launch settings.

## Acceptance criteria

- [x] C1. "Per-user state" lists the XDG state ledger as primary, the legacy write-through and when it retires (T-794), and the workbench Neovim's own state directory as T-830 names it.
  - verified: rev-31 [reviewer] · run rev-20261020-941-source · 2026-10-20T06:24:23.342Z · commit 246961b3abcf7aee8beb385e6154065ab0032baf
  - verified: rev-31 [reviewer] · run rev-20261020-941-final · 2026-10-20T06:32:03.772Z · commit 246961b3abcf7aee8beb385e6154065ab0032baf
  - done: impl-941 · 2026-10-20T06:32:20.179Z
- [x] C2. The CLI table and the roles section document `cland role launch` with its flags, matching `cland role` usage.
  - verified: rev-31 [reviewer] · run rev-20261020-941-source · 2026-10-20T06:24:23.342Z · commit 246961b3abcf7aee8beb385e6154065ab0032baf
  - verified: rev-31 [reviewer] · run rev-20261020-941-final · 2026-10-20T06:32:03.772Z · commit 246961b3abcf7aee8beb385e6154065ab0032baf
  - done: impl-941 · 2026-10-20T06:32:20.955Z
- [x] C3. A mode-free `cland verify` at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-941-final · 2026-10-20T06:32:03.772Z · commit 246961b3abcf7aee8beb385e6154065ab0032baf
  - done: impl-941 · 2026-10-20T06:32:21.666Z

## Comments

### impl-941 · 2026-10-20T06:13:41.055Z

Implementing README-only documentation of the XDG spend ledger and compatibility write-through, T-830 workbench Neovim state, and role launch usage; source review precedes mode-free verification.

### rev-31 · 2026-10-20T06:24:23.342Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-941-source
commit: 246961b3abcf7aee8beb385e6154065ab0032baf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7152: README-only Standards/Spec review clear. C1 state paths/overrides, conservative legacy write-through, future T-794 retirement and reviewed T-830 directory match source. C2 flags, empty model/account values, roles.toml persistence and next-launch semantics match CLI/launch implementation. C3 awaits exact-head mode-free verification. No merge authorization.

Criteria: C1 verified, C2 verified.

### impl-941 · 2026-10-20T06:31:22.813Z

Mode-free verification 0d5ab345-9ad9-43a2-a9c8-1e1800a18e98 passed at reviewed head 246961b3abcf7aee8beb385e6154065ab0032baf: 1926 tests passed, zero failures/skips. Linux x64 droplet c-8 lon1, lifetime 374 s, cost $0.0260. Log A-7164: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7164-suite-0d5ab345-9ad9-43a2-a9c8-1e1800a18e98-auto-at-246961b.log. Awaiting Reviewer final evidence verdict; no merge enqueued.

### rev-31 · 2026-10-20T06:32:03.772Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-941-final
commit: 246961b3abcf7aee8beb385e6154065ab0032baf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7166: complete same-head A-7164/0d5ab345 audited: 1926 ordinary passes, host/T1/fallback T2 green, zero resource/duration failures. README-only no new identities. C3 verified; C1/C2 retained from source A-7152. Claimant done marks absent at view; no merge authorization.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T07:02:12.490Z

Merged c20d98a08999c9511eed133779dc8224cb893cf2 onto dev.
