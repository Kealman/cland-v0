---
id: T-1107
kind: task
title: "Neovim sometimes never shows hub: connected when ui.json is unreadable, after T-1054's mark import"
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1054
topic: topic-847
branch: t/T-1107-neovim-sometimes-never-shows-hub
created: 2026-10-22T12:32:29.333Z
updated: 2026-10-22T12:56:00.806Z
---

## Summary

`nvim/test/ui.test.ts` "absent ui.json silently defaults; unreadable or corrupt files notify without hiding inbox answers" fails intermittently: "the screen never showed the stub hub connected within 10000 ms" (the client helper waits for `hub: connected` on screen, ui.test.ts line 29). It failed in the macOS stage cover ab78e484 (A-9149, dev b99de2c7) and in 2 of 5 runs alone on macOS at the same commit (coord, 2026-10-22 12:33Z), so it is not only load. The screen at timeout shows the shell with "no coordinator" and no `hub: connected`. T-1054 (c6396710) changed nvim/lua/cland/ui.lua to import last looks and plan marks from ui.json once into the hub; the case loops over absent, directory, `{broken`, wrong-shape and wrong-version ui.json files, so the import path on an unreadable file is the first suspect.

## Acceptance criteria

- [x] C1. The cause is found and stated in the item topic with the failing ui.json variant; the fix makes the Neovim client reach `hub: connected` for every ui.json variant the test covers, and the preference notice still shows without hiding the inbox answer hint (test).
  - done: impl-1107 · 2026-10-22T12:41:01.732Z
  - verified: rev-23 [reviewer] · run rev-20261022-1107-source · 2026-10-22T12:45:48.683Z · commit d4c958ad0be95ab271427b8feeffb78192e51930
  - verified: rev-23 [reviewer] · run rev-20261022-1107-final · 2026-10-22T12:56:00.709Z · commit d4c958ad0be95ab271427b8feeffb78192e51930
- [x] C2. ui.test.ts passes 20/20 alone on macOS at the head; the new no-legacy/no-write regression in human-marks-component.test.ts (T2) passes in the mode-free Linux run; ui.test.ts's Linux T3 evidence comes from the stage covers after landing; the samples are listed in the item topic (test).
  - done: impl-1107 · 2026-10-22T12:43:22.427Z
  - verified: rev-23 [reviewer] · run rev-20261022-1107-final · 2026-10-22T12:56:00.709Z · commit d4c958ad0be95ab271427b8feeffb78192e51930

## Comments

### impl-1107 · 2026-10-22T12:38:03.906Z

Cause reproduced at b99de2c7 on Darwin arm64: directory ui.json variant, timeout while client.connected=true, S.hub.state=connected and snapshots empty. A-9150 preserves exact failure and status line displaced by the new startup save-error notice. Prediction 1 confirmed: marks_imported flushes unrelated pending preferences without validated legacy keys. New held-marks-reply regression went red (2 write attempts for absent file), green after four-line product guard; existing legacy import/stale cleanup retained. Only changed human-marks-component consumer recorded; ui.test assertions/waits unchanged. 20 full-file local macOS samples underway; Linux T2 mode-free verification follows source review. Coordinator revised C2 to defer native ui.test Linux evidence to stage covers.

### impl-1107 · 2026-10-22T12:43:22.566Z

d4c958ad/tree1769703d source complete and pushed. A-9153 lists20/20 full-file ui.test samples begun after this commit on local Darwinarm64 Node24.21/Neovim0.12.5:200tests,0fail/skip; original assertions and waits unchanged. Root check exit0, lint report-only132/59,0refusals. A-9152 recorder4/4,5659frames, no recording byte changes; final actual recorded T2 replay4/4,0skip at unchanged head. C1/C2 implementation marked done; C2 Linux T2 and final verification marks pending source-clear then mode-free configured run. Native ui.test Linux T3 evidence explicitly deferred to Coordinator stage covers per revised C2. No per-item QA required; qaPolicy none/after-stage.

### rev-23 · 2026-10-22T12:45:48.683Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1107-source
commit: d4c958ad0be95ab271427b8feeffb78192e51930
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at d4c958ad0be95ab271427b8feeffb78192e51930/tree 1769703de3169b89c72ac9b635fb0b046992c3ff from fixed base 83c7e0c35627d7ace3e326c0f4a1a588bd2b0329. Four-file fix guards marks_imported changed/flush on actual validated legacy payload; preserves acknowledged legacy/stale cleanup, ordinary preference flush, original invalid-file notice, all ui.test assertions/waits. New recorded T2 observer is armed behind held marks.get before release, proves zero writes/import frames with pending preferences then positive ordinary flush. A-9150 directory diagnosis, A-9151 red 2!=0, A-9152 capture 4/4 and unchanged fixture bytes inspected. A-9153 parsed 20 unique postcommit local Darwin ui.test full-file samples: 200 passes/zero fail/skip/cancel. C1 established; C2 local portion accepted but Linux T2 exact-head configured receipt/repetitions pending. Coordinator revised C2 defers native Linux ui.test T3 to stage covers, not a pass. A-9155 audit; zero Standards/Spec findings. No Reviewer runtime or configured/Linux/T3-stage/QA clearance inferred.

Criteria: C1 verified.

### impl-1107 · 2026-10-22T12:55:50.145Z

Configured mode-free Linuxx64 droplet b1a98719 finished exit0 at unchanged d4c958ad (A-9156). Independently parsed distinct suite progress finishes:2445 ordinary test passes and5 load-gate test passes, no failures/skips/cancellations. New owned regression base1.629189259s plus five passing repetitions; worst1.963116876s, explicit5/5. AllT1/allfallbackT2hub+Neovim/Web complete; host check88cf98d0 reused, not repeated remotely. Lint132/59,0refusals and duration/ratchet diagnostics report-only; Web actual47.20s is not a40s budget pass. Droplet c8lon1,workers2(Web4),lifetime515s,$0.0357. No T3/T4/integrated/native Linux ui.test/stageQA pass claimed. Reviewer has same-head result for final C2 settlement; claim/head held, no merge.

### rev-23 · 2026-10-22T12:56:00.709Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1107-final
commit: d4c958ad0be95ab271427b8feeffb78192e51930
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final pre-merge C1/C2 clear at unchanged d4c958ad0be95ab271427b8feeffb78192e51930/tree 1769703de3169b89c72ac9b635fb0b046992c3ff. A-9156/b1a98719 original records and hub passed state checked: aggregate/T1/all-T2 both packages/Web exit 0; 2445 ordinary test and 375 file passes plus 5 load test/file passes, no failures/skips/cancellations. New regression ordinary line 11969 1.629189259 s, five unique load finishes 11957/11999/12046/12082/12152 max 1.963116876 s and explicit 5/5 at 12155. C1/source and A-9153 20 committed-head local macOS ui.test full-file samples remain accepted. Revised C2 native Linux ui.test T3 explicitly deferred to post-landing stage covers, not a passing T3 claim. Linux c-8 lon1 workers 2/Web 4, 515 s/$0.0357, host 88cf98d0 reused/not repeated remotely; generic lint/duration/ratchet report-only, 2 missing baselines. No enforcing tier-budget/T4/QA claim, no findings. Coordinator owns landing and replacement stage covers.

Criteria: C1 verified, C2 verified.
