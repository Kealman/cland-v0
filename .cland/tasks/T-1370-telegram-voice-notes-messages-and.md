---
id: T-1370
kind: task
title: Telegram voice notes, messages and approvals read with their marks in both workbenches
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - E-1311
topic: topic-1165
branch: t/T-1370-telegram-voice-notes-messages-and
created: 2026-10-27T05:46:51.211Z
updated: 2026-10-28T23:33:10.389Z
closed: 2026-10-28T23:33:10.389Z
---

## Summary

A voice note's transcript message shows its 🎤 marker, "via Telegram" and its audio artifact in Neovim and the web. A text message and a card approval made on the fake Bot API read with "via Telegram" in both workbenches.

## What to build

Spec §3.11 (source and voice marks), §3.1 (`via`) and §3.6 (the transcript message). T-1322 renders `via` through the test messenger. This ticket checks the whole path from the fake Bot API, and it makes the 🎤 marker, "🎤 not transcribed" and "nothing recognised" read as a distinct mark in a message row, not as body text, in both workbenches. This needs the transcript message's shape as E-1311 builds it.

**External wait and shared files:** E-1311 (voice notes; this also implies E-1310's cards, which E-1311 follows) · **Shared files:** web/src/MessageBlock.tsx, nvim/lua/cland/thread.lua, web/src/provenance.ts, nvim/lua/cland/provenance.lua

## Acceptance criteria

- [x] C1. A voice note on the fake Bot API, transcribed by the fake speech provider, reads in headless Neovim and headless Chromium with its 🎤 mark, "via Telegram" and its audio artifact, and an untranscribed note reads "🎤 not transcribed" (test).
  - done: impl-1370 · 2026-10-28T22:27:37.871Z
  - verified: rev-26 [reviewer] · run rev-20261028-1370-evidence-2 · 2026-10-28T23:24:27.984Z · commit ce5ddf854cac1b426072b908cbdce87b80454269
- [x] C2. A text message and a card approval made on the fake Bot API read "via Telegram" on the thread row and on the approval's inbox outcome in both workbenches (test).
  - done: impl-1370 · 2026-10-28T22:27:38.002Z
  - verified: rev-26 [reviewer] · run rev-20261028-1370-evidence-2 · 2026-10-28T23:24:27.984Z · commit ce5ddf854cac1b426072b908cbdce87b80454269

## Comments

### impl-1370 · 2026-10-28T22:23:59.345Z

Implementation plan: preserve the existing TopicMessage wire shape and persisted 🎤-prefixed text. Client-only provenance helpers will derive a distinct header mark/body from remote human messages with audio artifacts; ordinary text, non-audio attachments and previous-wire outcomes stay unchanged. Consumers inspected: voice.ts producer; Telegram media upload; shared/wire TopicMessage; web MessageBlock/provenance; Neovim thread/provenance; remote-via legacy tests; voice, approval and inbound native fixtures; web/nvim per-test guides. No shared contract is changed. Agreed seams: production frames + fake Bot API/speech, isolated headless web and native Neovim. Native approvals use fake harness adapters.

### rev-26 · 2026-10-28T22:31:40.729Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1370-source-1
commit: 8f783ec271647cd9db9abcf4693d70581a7a0d05
scope: full
findings: [{"severity":"medium","text":"M1: New Neovim and Web telegram-marks entries are not lexically sorted; move only owning rows preserving phases and retain unchanged guard outputs. Subsequent shared closed-owner failure remains separate.","file":"hub/test/tiers.json","line":709},{"severity":"medium","text":"M2: Both clients treat any attachment as recording evidence, stripping ordinary native photo/document 🎤 captions into a voice header. Restrict to supported recording metadata and retain native non-audio body controls in both workbenches.","file":"web/src/provenance.ts","line":12},{"severity":"medium","text":"M3: Pre-registered cleanup reads uninitialized speech after setup failure; sequential stop failure skips Store cleanup, and hub owner attaches only during exercise after workbench acquisition. Pre-own nullable resources, bound/cancel/join setup/disposal, gate root removal on drain and test omitted/aborted setup.","file":"hub/test/telegram-marks-fixture.ts","line":21},{"severity":"low","text":"M4: Native text's via Telegram is not asserted on its exact thread row; existing regex covers voice and archive only. Bind native text header and assert its source, preserving other assertions.","file":"nvim/test/telegram-marks.test.ts","line":18}]
finding_counts: {"high":0,"medium":3,"low":1}

A-13489 full source1 consolidated not clear, M1–M4 only. All12files/consumers audited. Prepared working corrections and authorized shared-fix merge need successor review. Sorting green claim was corrected by lead: owning lint then hit shared closed E-1311 duration owner, retained as separate failure. No reviewer workload, runtime marks or fabricated criterion failure. Fresh exact-head source review before mode-free verification; no extra full run/QA.

### rev-26 · 2026-10-28T22:33:59.424Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1370-source-2
commit: ddbbb96bdd434db99c7bf3d54e506e02c82b0c83
scope: full
findings: [{"severity":"medium","text":"M3 remains partial: beforeDirectories orders disposal but process-cleanup catches its rejection and still removes tempProject roots, whose original ownDirectory has no beforeRemove gate. Attach successful owner drain to first actual root-removal registration for both consumers; held/incomplete drain must retain root/Store until real settlement. A duplicate later owner does not protect earlier inode-matched remover.","file":"hub/test/telegram-marks-fixture.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13493 consolidated source2 not clear, sole remaining M3 removal gate. M1 sorted registration, M2 recording-only inference/native caption controls, M4 exact Neovim source assertion resolved. Existing pacingOwner fixes acquisition/TDZ and omitted/aborted successful drainage; rejected drain/root retention remains untested/unprotected. Optional Web factory default unchanged. Authorized95b367c9 merge only owner strings+tracker, values preserved. No runtime marks or reviewer workloads; fresh source after root gate fix before mode-free verify.

### rev-26 · 2026-10-28T22:36:14.324Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1370-source-3
commit: e9b423785c7edcea6b76f0d0fe1db08e8523600e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13495 source3 clear resolves remaining M3 first/only owned-root beforeRemove gate. Fixture allocator used by Web/Neovim/setup, default Web allocation unchanged. Actual remover held-drain control proves root/Store retention after injected timeout, finally releases and joins original disposal, Store closed and retry removes root; prior native/setup controls remain. M1/M2/M4 remain resolved; authorized shared merge retained. No reviewer workload/runtime marks. One unchanged-head mode-free run then original evidence review; no extra full run or QA.

### rev-26 · 2026-10-28T22:41:32.394Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1370-evidence-1
commit: e9b423785c7edcea6b76f0d0fe1db08e8523600e
scope: evidence
findings: [{"severity":"medium","text":"M5: Three new rows use Guide rather than required Notes label; unchanged index parser treats all three new guides missing (A-13498:6649/6657/6665). Change only owning labels; preserve complete guard red/green then fresh source review. Item-owned omission missed in prior review.","file":"docs/agents/tests/index.md","line":323}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13500 evidence1 not clear: f03d2257/A-13498 T0green/T1red,1137 ordinary pass1fail plus35 separate load passes, no unfinished identities. T2/changedNeovimT3/Web unexecuted; C1/C2 neither verified nor fabricated failed. Same-head Coordinator all d6234357 disposition remains separate/pending. No reviewer workloads, retry exception or ready claim. Fresh corrected source before resubmission.

### rev-26 · 2026-10-28T22:42:08.334Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1370-source-4
commit: ce5ddf854cac1b426072b908cbdce87b80454269
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13501 source4 clear. Sole successor diff three index labels Guide→Notes now matches unchanged parser/exact-row guard. All prior source/fixture/assertion/tier fixes unchanged; no dev merge. Complete local docs red2/3→green3/3 reported separately. A-13498/A-13499 old-head failures retained, no downstream runtime or C1/C2 verification. One unchanged-head mode-free plus Coordinator-owned replacement all then original evidence review. No reviewer workload or extra requested full run/QA.

### rev-26 · 2026-10-28T23:24:27.984Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1370-evidence-2
commit: ce5ddf854cac1b426072b908cbdce87b80454269
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13516 final evidence2 clear; C1/C2 verified from both originals. A-13509:4023 ordinary+50 separate load passes, setup3base+each5/5load, Neovimonce(parent+nested), Chromium2.728387234s plus report-only Web10/10. A-13515:5430passes8skips0fail, T0–T3/Web complete with unchanged native Neovim consumers; new Neovim1.010741348s/Chromium2.881597813s. No unfinished identities; neither run has T4. Exact body/source/audio/approval controls retained. Report-only ratchet2244.256vs2243.246 (~1.010s growth) recorded without enforcement claim. Coordinator ee66c51e directs final/ready. Old failedA-13498/A-13499 retained; no reviewer workloads or extra run/QA.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-28T23:33:10.389Z

Merged 530bb50a6defb4758581d6c4ac64eec9ad0620cd onto dev.
