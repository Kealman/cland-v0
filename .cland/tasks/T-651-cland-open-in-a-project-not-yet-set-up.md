---
id: T-651
kind: task
title: 'cland open in a project not yet set up prints "next: cland setup" and opens the workbench as usual'
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-650
topic: topic-536
branch: t/T-651-cland-open-in-a-project-not-yet-set-up
created: 2026-10-16T16:24:00.577Z
updated: 2026-10-18T23:50:28.259Z
closed: 2026-10-18T23:50:28.259Z
---

## Summary

A project initialised but not set up opens as usual, with one line before the workbench: `next: cland setup` (Q-599 resolution 6). What marks a project as set up is one exported predicate, which E-613's `cland setup` writes against.

## What to build

- **The predicate** `projectSetUp(root)`, exported from one module of the hub, true when `.cland/roles.toml`'s `[aide.launch] harness` line carries setup's mark of the human's choice (the setup prototype's `CHOSEN` comment, `# the human's favourite, chosen in cland setup`; the mark itself is an open question in the README). The mark is one exported constant, which E-613 writes.
- **The line.** In `hub/src/cli/open.ts`, after ticket T-650's check and before the hub starts: when `projectSetUp` is false, `next: cland setup` on stderr; then the hub and the workbench start as today, and the exit code is the launcher's.
- A malformed `roles.toml` counts as not set up and does not stop the open (the hub reports the file as it does today).
- The hub README's open section names the line and the mark.

## Acceptance criteria

- [x] C1. `cland open` in a project fresh from `cland init` prints exactly one line, `next: cland setup`, then runs the stand-in launcher on the root with its exit code returned (open.test.ts).
  - verified: rev-30 [reviewer] · run rev-20261018-651-final · 2026-10-18T23:50:17.036Z · commit 9f6d69a6481a05f3c6929b6217ac4eec3ecfd3bf
  - done: impl-651 · 2026-10-18T23:50:22.796Z
- [x] C2. With the mark on `[aide.launch] harness`, `cland open` prints no such line.
  - done: impl-651 · 2026-10-18T22:15:55.433Z
  - verified: rev-30 [reviewer] · run rev-20261018-651-final · 2026-10-18T23:50:17.036Z · commit 9f6d69a6481a05f3c6929b6217ac4eec3ecfd3bf
- [x] C3. `projectSetUp` returns false for a missing, an unmarked and a malformed `roles.toml`, and true for a marked one (unit test).
  - done: impl-651 · 2026-10-18T22:15:55.873Z
  - verified: rev-30 [reviewer] · run rev-20261018-651-final · 2026-10-18T23:50:17.036Z · commit 9f6d69a6481a05f3c6929b6217ac4eec3ecfd3bf

## Comments

### impl-651 · 2026-10-18T22:14:53.615Z

Implementation seams follow the assignment: T1 projectSetUp(root) in roles/editor.ts, using the existing logical TOML scanner; T2 open CLI against projectHub with scratch HOME/XDG and provider/account isolation. First red/green: missing export failed roles-editor.test.ts; predicate now passes missing/unmarked/malformed/marked cases.

### rev-30 · 2026-10-18T22:17:05.397Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-651-source
commit: eee54107a578e065aec9f8d80d581f5444becb74
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at eee54107. Shared projectSetUp/CHOSEN uses validated logical TOML and exact trailing aide.launch harness mark; malformed/missing/unmarked files return false without writes. Hint follows T-650 guard and precedes startup, preserving launch behavior. T1 table, T2 exact hint/marker suppression and existing malformed real-startup case retain coverage/isolation. A-5603 records both axes and claimant-reported host checks with limits. C1–C3 await accepted exact-head runtime; no findings or per-item QA.

### impl-651 · 2026-10-18T22:43:55.417Z

Exact reviewed-head mode-free droplet run 14efbf8b-3c14-448a-9c3a-0f1044552180 failed in executor-droplet.test.ts::restart discovers an interrupted create by name and retries an unconfirmed release (A-5622). Reviewer reported same identity in T-711 A-5620. Shared-defect candidate reported to lead T-651; no Coordinator holder at delivery. Holding diagnosis/retry and unchanged head pending Coordinator disposition/shared fix. Source is clear; runtime readiness remains blocked.

### rev-30 · 2026-10-18T22:44:22.801Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-651-runtime
commit: eee54107a578e065aec9f8d80d581f5444becb74
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Runtime not clear at unchanged eee54107: A-5622 / 14efbf8b exits 1 on executor-droplet.test.ts:287 (creating vs releasing), matching T-711 A-5620. Owned open 5/5 and roles-editor 11/11 ordinary cases passed; both new groups 5/5. Four inherited report-only trips disclosed. No new source findings; no criteria verified in this failed pass. A-5623 records both axes, positive evidence and shared-defect candidate Bugs/S. Await primary classification/shared fix or explicit retry authorization; no rerun authorized here.

Criteria: C1 failed (Accepted exact-head gate missing: A-5622 exits 1 at executor-droplet.test.ts:287 (creating vs releasing); owned hint and predicate checks passed.).

### rev-30 · 2026-10-18T23:26:26.692Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-651-shared-fix-delta
commit: 9f6d69a6481a05f3c6929b6217ac4eec3ecfd3bf
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear: exact Coordinator-authorized f311335d patch only, no dev merge. Bounded observation retains releasing condition, fault barrier and downstream complete release assertions; T-651 source/tests unchanged. A-5636 records both axes and primary112b27ed authorization. C1–C3 remain unverified until accepted exact-head runtime; one mode-free replacement gate is now authorized by that primary decision.

### rev-30 · 2026-10-18T23:50:17.036Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-651-final
commit: 9f6d69a6481a05f3c6929b6217ac4eec3ecfd3bf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged 9f6d69a6. A-5645/caf18bde accepted exit0: 2310 pass, zero failures/cancellations, five skips; hub plus Neovim smoke. Hint/marked suppression and predicate checks pass ordinary plus10/10 task repetitions; whole open5/5 and roles-editor11/11. Shared executor recovery now passes. A-5646 maps C1–C3, both axes and inherited report-only trips. Verified all; no findings. Restore claimant C1 done against this replacement receipt; prior failed evidence remains history.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-18T23:50:28.259Z

Merged 9d17f8d1a4db6f85ebdcf98cc15bd1550a00bd63 onto dev.
