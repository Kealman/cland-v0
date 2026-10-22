---
id: T-1130
kind: task
title: Area modules and their hub state for Sessions, Accounts and Artifacts
state: open
status: in progress
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1115
topic: topic-857
branch: t/T-1130-area-modules-and-their-hub-state-for
created: 2026-10-22T15:16:14.835Z
updated: 2026-10-22T16:34:11.019Z
---

## Summary

The shell renders Sessions, Accounts and Artifacts through area modules of their own, each with a list, a page and a drawer slot, and the connection keeps those areas' hub state from the snapshot and the deltas, so the slices that follow change only their own area's files.

## Parent

E-418 (prefactor for tracer steps 1 to 6; v0.2 §3.2 the shell, §3.3 the live model).

## What to build

Today the shell draws every area other than Items as one generic list of ids and titles, the connection maps sessions, accounts and artifacts to those rows, and it rereads whole lists on `account`, `artifact`, `presence` and `session.process` frames.

- **Area modules.** Sessions, Accounts and Artifacts each get a module the shell mounts in a pane, in a pane's page (the detail view, also opened in the other pane with ⌘Enter) and in the drawer, with its keyboard controls wired through the per-area tables of the keys slice. Each keeps today's list until its slice lands. The Sessions module is laid out as the Sessions board draws it: the header, the accounts strip, the verify line and the groups, each its own component, empty here, so the strip, the verify line and the groups can land in parallel lanes.
- **Hub state.** From the snapshot and the deltas the connection keeps: the merged session rows with the archived count; the roles with their launch defaults; the verification queue with the time its frame arrived; the account views in registry order with the registry error; the adapters' capability tables (read once with `session.list`); and the artifacts. An `account` frame replaces that account's view, a `verification.queue` frame replaces the queue and an `artifact` frame replaces that artifact, each without rereading a list. A resync or reconnect takes the areas' state from the fresh snapshot.

Inbox, Topics and Events stay as they are; E-417 owns them and may adopt the same seam.

## Acceptance criteria

- [ ] C1. Sessions, Accounts and Artifacts render through their own area modules in a pane, in the other pane's page and in the drawer, and Items, Inbox, Topics and Events render as before (Web test).
  - failed: rev-23 [reviewer] · 2026-10-22T16:34:11.019Z · note A-9316 T2 exits1 on enforced startup whole-test duration gates; Web not run, final runtime evidence incomplete.
- [ ] C2. A pushed `verification.queue`, `account` or `artifact` frame updates the client in place, and no `session.list`, `account.list` or `artifact.list` request follows it on the socket (Web test).
  - failed: rev-23 [reviewer] · 2026-10-22T16:34:11.019Z · note A-9316 T2 exits1 on enforced startup whole-test duration gates; Web not run, final runtime evidence incomplete.
- [ ] C3. After a hub restart the Sessions and Accounts areas show the new hub's rows without a page reload and keep none from before the drop (Web test).
  - failed: rev-23 [reviewer] · 2026-10-22T16:34:11.019Z · note A-9316 T2 exits1 on enforced startup whole-test duration gates; Web not run, final runtime evidence incomplete.
- [x] C4. `web/README.md` describes the area modules, their slots and the hub state each area reads (docs).
  - done: impl-1130 · 2026-10-22T16:18:03.680Z
  - verified: rev-23 [reviewer] · run rev-20261022-1130-source-2 · 2026-10-22T16:24:12.603Z · commit 48b6bef9771ef6997203cfa3b558ab49207e3c81

## Comments

### impl-1130 · 2026-10-22T16:14:21.543Z

Implemented area Pane/Page/Drawer modules with separate empty Sessions board components and per-area key contexts. Connection retains full Sessions/Accounts/Artifacts state and applies replacement deltas without inventory rereads. TDD evidence: slot test first failed at the missing Sessions module; callback tests failed on missing archived count, unchanged account view, stale session inventory, absent capability read and stale visibility projection before their changes. Six T1 callback cases and all three real-hub Web criterion cases now pass in the working tree on local macOS arm64; full typecheck/regression checks in progress. Full queued verification waits for clear source review.

### rev-23 · 2026-10-22T16:21:59.994Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1130-source
commit: 01f23898e6f1eb07ef100ae68587d53ed2aee174
scope: full
findings: [{"severity":"medium","text":"M1/C2: movedTo artifact deltas remain/append as top-level objects; prior Store.artifactPage inventory excluded moved children. Preserve membership on replacements/reprojections and test existing removal plus unseen moved child.","file":"web/src/connection.ts","line":348}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear at01f23898(base de965c20). Spec M1medium connection.ts:348/artifacts/state.ts:5: direct replacement maps movedTo records as top-level artifacts, whereas prior artifactPage excludes them; move child/folder publication therefore leaves stale membership. Implementer accepted callback regression/fix. No other source findings: requested Pane/Page/Drawer/lane slots, typed complete snapshots, account/queue updates, merged session deltas and stopped-writer restart proof inspected; central keyboard and shared-type conformance retained. Standards0. C1/C3 runtime and C4 docs marks left unverified on not-clear pass. A-9293 local macOS narrative qualified; no queued suite/Linux/load/QA or Reviewer execution claim. Preserve original stdout/exits/native timings; fresh corrected-head source review before verify.

Criteria: C2 failed (artifact.move delta leaves the moved child visible or appends an unseen moved child, diverging from hub inventory.).

### impl-1130 · 2026-10-22T16:22:45.599Z

Addressed review M1/C2 with a red-then-green public callback regression: a move removes an existing top-level artifact and never inserts an unseen moved child. Inventory insertion also preserves artifact.list's newest-first order, covered by another callback assertion. Existing Web C2 now performs a real scratch artifact.move and observes row removal with zero inventory rereads. Corrected working tree on local macOS arm64: 8/8 T1 cases and all 3 Web cases plus parent pass (Web parent 2.858 s). Full check is running; fresh source review will precede queued verification.

### rev-23 · 2026-10-22T16:24:12.603Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1130-source-2
commit: 48b6bef9771ef6997203cfa3b558ab49207e3c81
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at48b6bef9, continuation A-9299/01f23898; no dev merge. M1 resolved centrally: movedTo removes existing top-level child and never inserts unseen child on delta or visibility reprojection. New entries retain artifactPage descending-ID order. Two callback regressions check state/rows/no reads and ordering; WebC2 prearms row-detach observer before real scratch artifact.move and retains zero-inventory reread assertion. Other accepted source/tests unchanged; matching README C4 verified. Standards0/Spec0 remaining. C1–C3 await exact-head mode-free/load evidence; local macOS corrected-tree8T1/3Web/check claims qualified, no queued suite/Linux/QA or Reviewer execution claim. Preserve original output/exits/native timings without transcription reruns.

Criteria: C4 verified.

### impl-1130 · 2026-10-22T16:33:32.134Z

Verification 814f79d4 at reviewed 48b6bef9 (Linux x64, droplet c-8 blr1, 2 workers) exited 1: enforced duration budget for hub/test/item-summary-scale.test.ts::a thousand-item planned startup batches explorer recomputation 7.025 s > 5 s and ::a thousand-item planned hub serves within two seconds of listening before maintenance 7.413 s > 5 s. T1 exit 0; T2 duration-gate exit 1 with no assertion failures reported; Web has no executed-test receipt, so runtime evidence remains incomplete. Shared-defect candidate reported to lead T-1130 with log A-9316; holding diagnosis and retries pending Coordinator shared fix/decision. Head unchanged.

### rev-23 · 2026-10-22T16:34:11.019Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1130-duration-evidence
commit: 48b6bef9771ef6997203cfa3b558ab49207e3c81
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

814f79d4/A-9316 not clear: actual enforced `planned startup batches explorer recomputation 7.025s>5s` and `planned hub serves within two seconds...7.413s>5s` in item-summary-scale.test.ts (11800–11801). Whole-test gates, not behavioral serving-gap failures or report-only2s budgets. Parsed2073ordinary passes plus40load passes, no assertion failures; eight new callback cases each5/5. T1exit0/incompleteT2exit1/Webnotrun. Actual Linuxx64 droplet c-8blr1,workers2; host80d33a0check reused/not repeated. Otherlint/duration/ratchet report-only. Source48b6bef9/A-9303 and C4 stand; C1–C3 final evidence pending shared-defect decision/replacement. No new source findings, Reviewer execution, LinuxWeb/T3/T4/QA or retry authorization.

Criteria: C1 failed (A-9316 T2 exits1 on enforced startup whole-test duration gates; Web not run, final runtime evidence incomplete.), C2 failed (A-9316 T2 exits1 on enforced startup whole-test duration gates; Web not run, final runtime evidence incomplete.), C3 failed (A-9316 T2 exits1 on enforced startup whole-test duration gates; Web not run, final runtime evidence incomplete.).
