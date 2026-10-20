---
id: T-940
kind: task
title: "Version bump: the root package.json and lockfile at 0.1.4"
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-617
blocked_by: []
topic: topic-695
branch: t/T-940-version-bump-the-root-package-json-and
created: 2026-10-20T05:54:39.242Z
updated: 2026-10-20T06:06:29.078Z
---

## Summary

`cland release --item R-577` refuses a version that differs from the root `package.json` (Q-599 resolution 7), and since T-644 the root `package.json` version is cland's only version (`--version`, the spoke, the managed marks). E-617 C5 needs it at 0.1.4 on dev before the dry run.

## Acceptance criteria

- [x] C1. The root `package.json` and `package-lock.json` (both root entries) read 0.1.4, and `node hub/bin/cland.ts --version` prints 0.1.4 from the worktree.
  - verified: rev-31 [reviewer] · run rev-20261020-940-source · 2026-10-20T05:56:52.029Z · commit a48aa13afcbfd9b7082c869a77a25e04064f8d24
  - verified: rev-31 [reviewer] · run rev-20261020-940-final · 2026-10-20T06:06:10.628Z · commit a48aa13afcbfd9b7082c869a77a25e04064f8d24
  - done: impl-940 · 2026-10-20T06:06:27.783Z
- [x] C2. Any test or fixture that pins the current version reads it from package.json rather than a literal (none changed if none pins it), and a mode-free `cland verify` at the reviewed head is green.
  - verified: rev-31 [reviewer] · run rev-20261020-940-final · 2026-10-20T06:06:10.628Z · commit a48aa13afcbfd9b7082c869a77a25e04064f8d24
  - done: impl-940 · 2026-10-20T06:06:28.489Z

## Comments

### impl-940 · 2026-10-20T05:55:30.619Z

Updated only the root package version and both root lockfile version entries to 0.1.4. CLI prints 0.1.4; npm run typecheck, version-source lint and git diff --check pass. Audited 0.1.3 literals in tests/fixtures: release tests deliberately compare fixture versions, skills tests model pre-hash manifests, init/territory tests model v0.1.3 migration, and EXPLORER-003 models historical R-294. No current-version pins require changes.

### rev-31 · 2026-10-20T05:56:52.029Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-940-source
commit: a48aa13afcbfd9b7082c869a77a25e04064f8d24
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-7113 independently confirms exactly three root version substitutions, all 0.1.4; all other JSON values unchanged. CLI reads root VERSION and retained worktree stdout A-7112 prints 0.1.4, with combined-command exit attribution explicitly qualified. Old literals are historical/migration fixtures; current CLI assertion reads package.json. C1 verified; C2 pin audit established, configured mode-free green run remains pending at this exact head.

Criteria: C1 verified.

### impl-940 · 2026-10-20T06:04:14.998Z

Mode-free verification 77424d7d-8525-4534-be62-43c93e91b70d passed at reviewed head a48aa13afcbfd9b7082c869a77a25e04064f8d24: 1926/1926 passed, no failures/skips. Linux x64 droplet c-8 lon1, lifetime 393 s, cost $0.0273. Log A-7118 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7118-suite-77424d7d-8525-4534-be62-43c93e91b70d-auto-at-a48aa13.log. Reviewer received same-head result; awaiting final evidence verdict/ready. No merge enqueued.

### rev-31 · 2026-10-20T06:06:10.628Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-940-final
commit: a48aa13afcbfd9b7082c869a77a25e04064f8d24
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-7121 independently audits A-7118 / 77424d7d at unchanged reviewed head. 1926 ordinary passes; CLI --version/-v dynamic root-version assertion passes at raw line 43505. Host check/all T1/fallback all T2 green, no tier mismatch or hard budget failure; three missing file baselines are report-only. C1/C2 verified across source and same-head runtime evidence; claimant done marks remain its responsibility. No tags or merge actions.

Criteria: C1 verified, C2 verified.
