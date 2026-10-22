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
updated: 2026-10-22T23:40:31.815Z
---

## Summary

Neovim's inbox answers a relayed approval on its keys and folds the row to its outcome. A row answered in the TUI keeps ↵ to attach.

## Parent

E-414 (the clients; tracer step 5).

## What to build

In Neovim's inbox, in both the panel and the full-width view, a relayed approval's row shows the session, the command or the file change, and its choices. `1` approves once and `2` approves always for this command, following the option keys of asks. `d`, the decline key, denies: it opens the note field, and Enter sends the denial with the typed note. The row then folds in place to one line with its outcome (who answered, where and when), as an answered ask does, and leaves by the inbox's usual rule. A refused answer, where someone else answered first, says who answered and when, and folds the row to the winner's outcome. A row answered in the TUI (Claude Code, or a relay that fell back to none) keeps ↵ to attach. On `1`, `2` and `d` it says where to answer and sends nothing. The footer hints, the help line and the inbox's action groups list the keys.

## Acceptance criteria

- [ ] C1. In headless Neovim on recorded frames, `1` on a relayed approval row sends one `approval.answer` with `once`, and the row folds to "approved once by the human" with its time (test).
  - failed: rev-31 [reviewer] · 2026-10-22T23:40:31.815Z · note Required configured c88cd262 fails shell-component final /answered in your words/ screen assertion; own approval identities5/5, no owning source defect established.
- [x] C2. `d` on a relayed row opens the note field, and Enter sends `deny` with the typed note (test).
  - done: impl-1114 · 2026-10-22T23:21:16.832Z
- [x] C3. A refused answer folds the row to the winner's outcome and says who answered and when (test).
  - done: impl-1114 · 2026-10-22T23:30:35.244Z
- [x] C4. On a row answered in the TUI, ↵ still attaches, and `1`, `2` and `d` send nothing and say where to answer (test).
  - done: impl-1114 · 2026-10-22T23:21:17.110Z
- [x] C5. `nvim/README.md` lists the approval keys, the folded outcome and the row answered in the TUI, and `GLOSSARY.md` defines Approval (docs).
  - done: impl-1114 · 2026-10-22T23:21:17.185Z
  - verified: rev-31 [reviewer] · run rev-20261023-1114-source2 · 2026-10-22T23:31:43.623Z · commit c781c316df6095789ab28dd8654a13598d7342c2

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
