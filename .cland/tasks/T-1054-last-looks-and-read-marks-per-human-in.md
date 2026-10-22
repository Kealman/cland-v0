---
id: T-1054
kind: task
title: Last looks and read marks per human in the hub, with Neovim moved onto them
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: topic-835
branch: t/T-1054-last-looks-and-read-marks-per-human-in
created: 2026-10-21T14:04:14.830Z
updated: 2026-10-22T07:13:11.735Z
---

## Summary

Hold the events' last look, each plan's last look and the topics' read marks in the hub per human, and move Neovim onto them with a one-time import from `ui.json`.

## Parent

E-413 (§3.6 marks; §3.3 "The last look and the read marks per human"; tracer step 3).

## What to build

The hub stores the marks per human, not per client. A mark only moves forward, and the latest from any client wins. Clients read the marks with the snapshot, set them through frames, and receive changes as deltas. Neovim reads and sets its events' last look and its plans' marks through the hub. On first start after this change, it imports the values `ui.json` holds once, never losing the human's current last look. `ui.json` keeps only interface state (filters, folds, the current release); pins and mutes stay where they are. What counts as read stays the client's act (`topic.read` up to a message number); the hub keeps the highest mark.

## Acceptance criteria

- [x] C1. A mark set by one frame client is read by a second client, and an older mark sent later does not move it back (test).
  - done: impl-1054 · 2026-10-22T07:00:46.719Z
  - verified: rev-26 [reviewer] · run rev-20261022-1054-final-1 · 2026-10-22T07:13:11.578Z · commit cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d
- [x] C2. Opening the events view in a headless Neovim workbench sets the events' last look that a frame client then reads, and a topic marked read by a frame client reads as read in Neovim (test).
  - done: impl-1054 · 2026-10-22T07:00:46.797Z
  - verified: rev-26 [reviewer] · run rev-20261022-1054-final-1 · 2026-10-22T07:13:11.578Z · commit cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d
- [x] C3. A Neovim start with the last look and plan marks present in `ui.json` and absent in the hub imports them once; a second start does not re-import, and `ui.json` no longer carries them (test).
  - done: impl-1054 · 2026-10-22T07:00:46.875Z
  - verified: rev-26 [reviewer] · run rev-20261022-1054-final-1 · 2026-10-22T07:13:11.578Z · commit cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d
- [x] C4. Marks survive a hub restart (test).
  - done: impl-1054 · 2026-10-22T07:00:47.051Z
  - verified: rev-26 [reviewer] · run rev-20261022-1054-final-1 · 2026-10-22T07:13:11.578Z · commit cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d
- [x] C5. `hub/README.md` and `nvim/README.md` describe the marks and the import.
  - done: impl-1054 · 2026-10-22T07:00:47.124Z
  - verified: rev-26 [reviewer] · run rev-20261022-1054-source-2 · 2026-10-22T07:02:08.507Z · commit cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d
  - verified: rev-26 [reviewer] · run rev-20261022-1054-final-1 · 2026-10-22T07:13:11.578Z · commit cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d

## Comments

### impl-1054 · 2026-10-22T06:35:51.684Z

Criterion-first seams confirmed by launch brief and E-413: real frame clients for C1/C4 (projectHub reopen for persistence), recorded headless Neovim plus scripted frame peer for C2/C3. Proposed model preserves events ISO timestamps and compares plan receipt IDs by the hub's publication order, never by UUID or timestamp. Legacy keys remain on disk until the durable import reply.

### impl-1054 · 2026-10-22T06:52:14.235Z

Implemented and pushed 8830d1f6/tree2f97fbe6, merged origin/dev6e797f08 before first review. C1–C5 done. A-8981 holds raw local Darwin arm64 targeted evidence: root check0, lint report-only132/59 with0refusals; 77/77 tests, zero skips across12files. Changed-consumer recordings refreshed only; native plan/restart5 and live protocol guard1 are targeted T3, not integrated suite evidence. C4 reopens projectHub in-process per persistence-test policy. Source review requested before mode-free configured-executor verification; QA is after-stage.

### rev-26 · 2026-10-22T06:58:41.458Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1054-source-1
commit: 8830d1f60599862dd87b5fe7b3902229b75225f0
scope: full
findings: [{"severity":"medium","text":"M1: Pushed-frame whitelist omits marks, dropping peer updates and in-flight marks.get journal events; connected Neovim violates shared latest-wins delta behavior.","file":"nvim/lua/cland/hub.lua","line":438},{"severity":"medium","text":"M2: Events header is not an acknowledged last-look receipt; initial readiness excludes marks.get, so immediate request sampling can race the queued visit. Arm/wait exact peer-visible mark with separate setup bound and final equality.","file":"nvim/test/human-marks-component.test.ts","line":32},{"severity":"medium","text":"M3: nvim_input acknowledges queued :qa! keys, not writer/group exit; ui.json overwrite and control-path reuse race old client shutdown. Observe bounded close/group disappearance before cold-start setup.","file":"nvim/test/human-marks-component.test.ts","line":74}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear; completed full audit A-8988. Standards: M2/M3 medium, both rule9 completion-boundary gaps. Spec: M1 medium, every incoming marks event drops before handlers/journal. Singleton store/import and forward-order merge otherwise look sound; docs C5 inspected, no runtime criteria verified on this pass. A-8981 local Darwinarm64 check+77 targeted passes are supporting evidence only, not configured Linux/full/load proof. Add live-peer and held-snapshot regressions, preserve exact visit equality and stale-copy assertions, fix three gaps; fresh pushed-head source review before mode-free verification. No additional source findings.

Criteria: C2 failed (Incoming marks deltas are dropped; Events test also samples before its exact durable visit receipt.), C3 failed (Cold-start test rewrites preferences and reuses the control path before the old editor/owned group has observably exited.).

### impl-1054 · 2026-10-22T07:01:08.109Z

Corrected source pushed cd6fdf8c/tree4bd3a500, no dev merge after first source review. A-8990 captures requested red/green peer marks.push and held-read regressions, bounded Events receipt and true editor/group exit before cold stale-copy replacement. Exact-head Darwin local root check0 and78/78targeted pass,0skips; lintreport-only132/59,0refusals. All criteria re-marked done; fresh review requested before any suite submission.

### rev-26 · 2026-10-22T07:02:08.507Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1054-source-2
commit: cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8993 incorporates A-8988 full design audit and five-file correction. M1 marks now emitted/journalled; connected-peer exact mark and held-old-read completed-callback regressions preserve final newest-mark assertions. M2 separate marks-ready setup and armed peer observer precede Events; exact outbound/peer equality retained. M3 close observer precedes Esc/quit, bounded close/group disappearance plus final exit/ESRCH complete before stale-file/control-path reuse. C5 docs verified. Standards0;Spec0. A-8990 reported exact-head local Darwinarm64 check0/78targeted passes,0skip are supporting only; native5+recorder1 are targetedT3, not integrated. C1–C4 pending same-head configured evidence. Submit mode-free droplet verify at unchanged head under cover-quiet; Coordinator owns separately required full lifecycle evidence. No final-ready/QA claim.

Criteria: C5 verified.

### rev-26 · 2026-10-22T07:13:11.578Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1054-final-1
commit: cd6fdf8c0a59f95d974285e0cd4c4a184f0d382d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final task criteria clear; A-8999 audits unchanged source-clear cd6fdf8c and original A-8998/run053c94c4 exit0. C1/C2/C3/C4 plus held-read identity each have base+5/5 actual load passes; worst0.490350/0.461346/0.730109/0.208786/0.404629s respectively. C1 cross-client monotonicity, C2 exact visit/peer-read/live marks, C3 ack/removal/stale-copy after observed editor/group exit, C4 documented in-process storage reopen, C5 current source docs established. 2414 ordinary passes,no fail/cancel/skip; T1/all fallbackT2 hub+Neovim/Web complete, Linuxx64 c8lon1 droplet,workers2(Web4),535s/$0.0372. Host check82732297 reused,not repeated remotely; original stdout retained. Generic lint/tier/duration/ratchet report-only; Web42.38s not a <40s budget claim. No T3/T4/integrated/full-lifecycle/stageQA pass claimed; Coordinator-owned separate lifecycle/stage receipts and landing freeze remain separate. Standards0;Spec0.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
