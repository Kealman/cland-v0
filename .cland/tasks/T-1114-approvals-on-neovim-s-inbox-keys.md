---
id: T-1114
kind: task
title: Approvals on Neovim's inbox keys
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1110
topic: topic-872
branch: t/T-1114-approvals-on-neovim-s-inbox-keys
created: 2026-10-22T15:16:11.910Z
updated: 2026-10-23T00:26:27.701Z
---

## Summary

Neovim's inbox answers a relayed approval on its keys and folds the row to its outcome. A row answered in the TUI keeps ↵ to attach.

## Parent

E-414 (the clients; tracer step 5).

## What to build

In Neovim's inbox, in both the panel and the full-width view, a relayed approval's row shows the session, the command or the file change, and its choices. `1` approves once and `2` approves always for this command, following the option keys of asks. `d`, the decline key, denies: it opens the note field, and Enter sends the denial with the typed note. The row then folds in place to one line with its outcome (who answered, where and when), as an answered ask does, and leaves by the inbox's usual rule. A refused answer, where someone else answered first, says who answered and when, and folds the row to the winner's outcome. A row answered in the TUI (Claude Code, or a relay that fell back to none) keeps ↵ to attach. On `1`, `2` and `d` it says where to answer and sends nothing. The footer hints, the help line and the inbox's action groups list the keys.

## Acceptance criteria

- [x] C1. In headless Neovim on recorded frames, `1` on a relayed approval row sends one `approval.answer` with `once`, and the row folds to "approved once by the human" with its time (test).
  - done: impl-1114 · 2026-10-23T00:12:33.037Z
  - verified: rev-31 [reviewer] · run rev-20261023-1114-final · 2026-10-23T00:24:37.058Z · commit 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9
- [x] C2. `d` on a relayed row opens the note field, and Enter sends `deny` with the typed note (test).
  - done: impl-1114 · 2026-10-23T00:12:33.123Z
  - verified: rev-31 [reviewer] · run rev-20261023-1114-final · 2026-10-23T00:24:37.058Z · commit 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9
- [x] C3. A refused answer folds the row to the winner's outcome and says who answered and when (test).
  - done: impl-1114 · 2026-10-23T00:12:33.201Z
  - verified: rev-31 [reviewer] · run rev-20261023-1114-final · 2026-10-23T00:24:37.058Z · commit 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9
- [x] C4. On a row answered in the TUI, ↵ still attaches, and `1`, `2` and `d` send nothing and say where to answer (test).
  - done: impl-1114 · 2026-10-23T00:12:33.382Z
  - verified: rev-31 [reviewer] · run rev-20261023-1114-final · 2026-10-23T00:24:37.058Z · commit 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9
- [x] C5. `nvim/README.md` lists the approval keys, the folded outcome and the row answered in the TUI, and `GLOSSARY.md` defines Approval (docs).
  - done: impl-1114 · 2026-10-22T23:21:17.185Z
  - verified: rev-31 [reviewer] · run rev-20261023-1114-source2 · 2026-10-22T23:31:43.623Z · commit c781c316df6095789ab28dd8654a13598d7342c2
  - verified: rev-31 [reviewer] · run rev-20261023-1114-source3 · 2026-10-22T23:43:52.390Z · commit 80cca05ec178cfcfc8f6472a6d9e500ae45b4fc9
  - verified: rev-31 [reviewer] · run rev-20261023-1114-source4 · 2026-10-22T23:57:46.107Z · commit 8c4fa1c8fe2e9db2ef6010a9e9546fdc6a3d5703
  - verified: rev-31 [reviewer] · run rev-20261023-1114-source5 · 2026-10-23T00:14:00.090Z · commit 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9
  - verified: rev-31 [reviewer] · run rev-20261023-1114-final · 2026-10-23T00:24:37.058Z · commit 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9

## Comments

### impl-1114 · 2026-10-22T23:09:58.294Z

Implementation started test-first at the assigned recorded-frame/headless Neovim seam (T2), both inbox views. Root node_modules linked. Tests will observe outbound approval.answer and rendered folded outcomes; TUI attachment remains stub-refused at its existing boundary. Stage QA applies after-stage, no per-item brief required.

### rev-31 · 2026-10-22T23:25:34.036Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261023-1114-source
commit: 8be4efbbd34d9a2cdf7b8562ebf6a7d7932740d1
scope: full
findings: [{"severity":"medium","text":"M1: Folded outcomes retire on movement to another row but survive leaving/reopening the inbox because completed/selected have no view-leave cleanup. Follow the inbox visit leave rule; test both panel/full lifecycle.","file":"nvim/lua/cland/inbox.lua","line":264},{"severity":"medium","text":"M2: The losing-race archive read replaces all inbox state via a plain unjournalled reply; a held old reply can overwrite newer approval/inbox deltas and needsYou. Preserve newer live facts when installing winner/archive.","file":"nvim/lua/cland/inbox.lua","line":347}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; A-9514. Standards0/Spec2medium: M1 inbox.lua:264 folded outcome lifetime disagrees with inbox leave rule; M2:347 stale archive lookup overwrites newer live inbox state. Add bounded panel/full visit and held-reply regressions, retain final/outgoing/no-send assertions. C1/C3 failed, runtime criteria pending; fixture audit independently adds21 with0 removed/changed. Shared env gap stays T-1156 under Coordinator disposition. Preserve original local receipts without reruns for transcription; corrected head needs source review before verify.

Criteria: C1 failed (Folded outcome retirement is tied to cursor movement rather than leaving the inbox visit; hidden/reopened buffers retain stale completed rows.), C3 failed (A held losing-race archive reply can overwrite newer live approval rows/counts when state.set_inbox applies the stale full snapshot.).

### impl-1114 · 2026-10-22T23:29:57.869Z

Corrected source-review findings M1/M2 at c781c316 (pushed; no dev merge after first source review). Red→green M1: `fold retained after cursor moves: not within 15000 ms`; fixed visit lifecycle and leave/reopen retirement in panel/full. Red→green M2: `the screen never showed newer live facts survive the lookup within 10000 ms`; a held losing-race archive reply now consumes only the exact winner, preserving newer approval state, needsYou and archiveToday. Added three regressions; recorded refresh 21/21 passed and adds 2 frames with zero existing keys/outputs removed or changed. Raw command/stdout/exit/native timing receipts are being preserved for corrected-head checks. Fresh source review follows these checks; no verification submitted.

### rev-31 · 2026-10-22T23:31:43.623Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261023-1114-source2
commit: c781c316df6095789ab28dd8654a13598d7342c2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-9530, no findings. M1 fixed by visit-leave retirement retaining movement/switches; M2 exact-winner-only lookup preserves current rows/counts. Panel/full leave and held archive regressions retain final assertions. A-9524 original red/green and exact-head21/21+4/4+1/1+singleT3/static receipts audited; recorded correction adds2 with0 old changes. C5 source verified, C1-C4 await exact-head mode-free configured result. T-1156 remains separate; no dev merge after review or merge enqueue.

Criteria: C5 verified.

### rev-31 · 2026-10-22T23:40:31.815Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261023-1114-runtime-failure
commit: c781c316df6095789ab28dd8654a13598d7342c2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured runtime not clear; A-9557. A-9553 exact failure at14145, existing shell-component1289 checks old screen s after a separate disarmed wait; possible observer gap needs Coordinator triage, not classified/reproduced by Reviewer. All16 new approval identities have actual5 distinct load passes+5/5; overall T2exit1/Web unrun. Source A-9530/C5 remains clear. S Bugs candidate reported to lead; await shared/task-owned disposition, no independent retry or edit requested. Restore claimant C1 before later final settlement.

Criteria: C1 failed (Required configured c88cd262 fails shell-component final /answered in your words/ screen assertion; own approval identities5/5, no owning source defect established.).

### rev-31 · 2026-10-22T23:43:52.390Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261023-1114-source3
commit: 80cca05ec178cfcfc8f6472a6d9e500ae45b4fc9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-9564, no findings. One-line carrier fix captures answered-card+disarmed screen and retains final/outgoing/no-send assertions and bounds. A-9563 sealed base-pass/head-fail and corrected five targeted/full60-case receipts audited; task-owned clipping/selection change explains early predicate. No runtime/fixture change or post-review dev merge. C5 verified; C1-C4 await fresh exact-head configured mode-free run; historical A-9553 remains failed. No merge enqueue.

Criteria: C5 verified.

### rev-31 · 2026-10-22T23:46:25.685Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261023-1114-bundle-refusal
commit: 80cca05ec178cfcfc8f6472a6d9e500ae45b4fc9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Verification not run (changed HEAD), A-9570. A-9567 exact bundler failure,host output only,T1/T2/Web unexecuted. A-9564 source/C5 remains for restored80cca05e; docs delta cancelled by Coordinator. Replacement0dbcd10c already admitted,pending; no duplicate requested. Restore claimant C1 before final settlement, no source defect or merge enqueue.

Criteria: C1 failed (Verification not run: 9a20a49d bundle refused because HEAD changed; no runtime counts/platform, no functional finding.).

### rev-31 · 2026-10-22T23:55:26.430Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261023-1114-pending-receipt
commit: 80cca05ec178cfcfc8f6472a6d9e500ae45b4fc9
scope: evidence
findings: [{"severity":"medium","text":"M1: Pending delta is emitted then retry1 pressed before selected rendered approval metadata is observed pending. Control ack is not UI readiness; failure shows old answering guard and no delivery error. Wait for exact pending/choices receipt, retain all assertions.","file":"nvim/test/inbox-actions.test.ts","line":237}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear; A-9593. Exact A-9591:14146 timeout delivery failure is visible; status14190 still says approval is being answered. Task-owned test237-239 lacks selected rendered pending/choices receipt before retry1. Base/load failures precede consequent10.396s>5s gate. Add bounded readiness and retain all outgoing/error/closed/count assertions; no allowance/bound increase. No new product code finding,source A-9564/C5 remains. Corrected head requires source review before verify.

Criteria: C3 failed (Owned live-approval recovery test times out; it retries before pending is rendered, hitting old answering guard. Missing rule9 readiness receipt.).

### rev-31 · 2026-10-22T23:57:46.107Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261023-1114-source4
commit: 8c4fa1c8fe2e9db2ef6010a9e9546fdc6a3d5703
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-9602, runtime M1 resolved. Prearmed selected approval pending-choice screen receipt precedes retry1; all final/outgoing/error/closed/count assertions and bounds retained. Product/fixture/docs unchanged. A-9600 exact-head21/21/typecheck and five targeted samples audited;20 old-head local attempts correctly labelled nonreproductions. C5 verified,C1-C4 await new exact-head mode-free configured result. No merge enqueue.

Criteria: C5 verified.

### rev-31 · 2026-10-23T00:08:47.175Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261023-1114-panel-receipt
commit: 8c4fa1c8fe2e9db2ef6010a9e9546fdc6a3d5703
scope: evidence
findings: [{"severity":"medium","text":"M1: approvalClient waits/selects by full command text in a deliberately clipped panel summary. Actual row is echo approv… beside age1h4m, causing all6 panel base cases+30 load failures. Observe/select exact approval row id/metadata, retain unfolded subject/action assertions and bounds.","file":"nvim/test/inbox-actions.test.ts","line":165}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured run not clear; A-9630. A-9629 actual setup error13774 etc; summary already shows echo approv… with1h4m age. Six panel base cases+30 repetitions fail helper165/166 full-text wait/select before actions. Use stable rendered row identity and retain unfolded subject/action assertions; add clipping/age control, no widenedUI/timeouts/allowance. Corrected live-delta base+5/5 passed. No new product source finding; C5/source remains, Web unrun. C1-C4 failed setup; corrected head requires source review.

Criteria: C1 failed (Panel scenario times out in common approvalClient setup matching full command in clipped summary; exact rendered approval row already exists.), C2 failed (Panel scenario times out in common approvalClient setup matching full command in clipped summary; exact rendered approval row already exists.), C3 failed (Panel scenario times out in common approvalClient setup matching full command in clipped summary; exact rendered approval row already exists.), C4 failed (Panel scenario times out in common approvalClient setup matching full command in clipped summary; exact rendered approval row already exists.).

### rev-31 · 2026-10-23T00:14:00.090Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261023-1114-source5
commit: 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 6f0d149e, tree 9f2b9fb5. A-9641: exact rendered approval-ID setup, full expanded literal subject receipt and explicit +2h clipped-command regression correct A-9630 without product/bound changes. Fixture audit adds 3 records per catalog/slice with zero old changes/removals. A-9636 retains local targeted 5×22/22 and typecheck; these are not configured verification. C1–C4 await fresh exact-head mode-free run; C5 source established. Standards 0, Spec 0.

Criteria: C5 verified.

### rev-31 · 2026-10-23T00:24:37.058Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261023-1114-final
commit: 6f0d149e5e8ca80e4d2c3f4a793f96af4e71a4a9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-9660. A-9656 configured16a1616f exits0,2547/2547 no fail/cancel/skip; Linux c8lon1 T1/all fallback hub+NeovimT2/Web. Independently parsed all22 base approvals and17 new identities each5 distinct load passes plus explicit5/5; worst0.554656969s. Corrected free-answer carrier passes. A-9641 source remains exact; C1–C5 verified. Host T0 not remotely repeated, generic lint/durations report-only, T3/T4/after-stageQA separate. No findings or merge enqueue.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
