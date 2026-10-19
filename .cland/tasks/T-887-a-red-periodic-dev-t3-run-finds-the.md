---
id: T-887
kind: task
title: A red periodic dev T3 run finds the landed merge that broke it and files a Bug
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by:
  - T-886
topic: topic-624
branch: t/T-887-a-red-periodic-dev-t3-run-finds-the
created: 2026-10-19T16:17:32.779Z
updated: 2026-10-19T19:41:42.879Z
closed: 2026-10-19T19:41:42.879Z
---

## Summary

D67, part two: when a periodic dev T3 run (T-886) goes red, the hub finds the landed merge that broke it among the merges since the last green periodic run. It reruns only the failing files at chosen commits, then files a Bug naming that merge and notifies the Coordinator and the merge's last claimant. A red periodic run never stops the merge queue.

## Acceptance criteria

- [x] C1. A red `dev-t3` run with merges M1…Mn since the last green periodic run reruns only its failing files, bisecting over those landed commits, and names the first merge at which they fail. A failing file that also fails at the last green head is reported as pre-existing, not blamed (T1 test over the search with a fake runner).
  - verified: rev-30 [reviewer] · run rev-20261019-887-final · 2026-10-19T18:21:13.744Z · commit f621acf90a1e1ebabe06c266f9346bf8e003a30b
  - done: impl-887 · 2026-10-19T19:29:16.668Z
  - verified: rev-30 [reviewer] · run rev-20261019-887-integrated-final · 2026-10-19T19:30:10.291Z · commit 50f5430ca24a237e2f9dc0af7f54bacedd3be214
- [x] C2. The hub files one Bug under the Bugs category for the named merge, with the failing files, run ids and both heads. It notifies the Coordinator in General and the merge's last claimant session if live. A failing file that passes on rerun at the red head is reported as a flake and files nothing (T2 test).
  - verified: rev-30 [reviewer] · run rev-20261019-887-final · 2026-10-19T18:21:13.744Z · commit f621acf90a1e1ebabe06c266f9346bf8e003a30b
  - done: impl-887 · 2026-10-19T19:29:17.983Z
  - verified: rev-30 [reviewer] · run rev-20261019-887-integrated-final · 2026-10-19T19:30:10.291Z · commit 50f5430ca24a237e2f9dc0af7f54bacedd3be214
- [x] C3. While the search runs, merge batches keep forming and landing (T1 test over the controller).
  - verified: rev-30 [reviewer] · run rev-20261019-887-final · 2026-10-19T18:21:13.744Z · commit f621acf90a1e1ebabe06c266f9346bf8e003a30b
  - done: impl-887 · 2026-10-19T19:29:19.465Z
  - verified: rev-30 [reviewer] · run rev-20261019-887-integrated-final · 2026-10-19T19:30:10.291Z · commit 50f5430ca24a237e2f9dc0af7f54bacedd3be214

## Comments

### impl-887 · 2026-10-19T18:05:13.706Z

Implementation now consumes the pinned DevT3Result and runs a durable per-file repeat/baseline/bisection search independent of MergeBatches. T1 proves m5 attribution, pre-existing exclusion and restart/replay, plus two batches land while the search runner is blocked. T2 projectHub proves automatic red-result -> exact file probes -> one Bugs item and live last-claimant/Coordinator delivery, or a passing-red-head flake with no Bug. Targeted costs currently ~0.01s search, ~0.10s concurrent batches, ~0.98s/~0.64s T2.

### rev-30 · 2026-10-19T18:14:01.839Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-887-source
commit: f621acf90a1e1ebabe06c266f9346bf8e003a30b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-887 source clear against pinned T-886; A-6309. Durable per-file repeat/baseline/bisection, fresh exact-file job reuse/evidence classification, idempotent Bug/General report and persisted live last-claimant lookup reviewed. Two batches can land before blocked probe release. No inherited T-886 re-review; durations refresh belongs to pre-review dev. Reported targeted T1/T2 costs qualified; retain original outputs without rerun. C1–C3 await normal exact-head mode-free gate and owned costs. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6309-t-887-source-review-against-pinned-t-886-at-f621acf9.md

### impl-887 · 2026-10-19T18:20:37.228Z

Exact reviewed-head mode-free verify 404e51ed is green at unchanged f621acf9: 1606/1606, hub and Neovim phases complete; all owned new T1/T2 bodies and five load repetitions fit their tiers. Linux c-8 lon1 lifetime 341 s, cost $0.0237. Receipt A-6315; original targeted outputs A-6310. Claimant done marks recorded for C1–C3. Awaiting Reviewer final same-head evidence settlement.

### rev-30 · 2026-10-19T18:21:13.744Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-887-final
commit: f621acf90a1e1ebabe06c266f9346bf8e003a30b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6316. A-6315 ordinary 1606/1606 and all 18 selected groups 5/5. Seven owned search/proof/reuse/Bug/flake/concurrent-batch controls each pass ordinarily and five repetitions within T1/T2 bounds. A-6310 original targeted outputs retained. C1–C3 verified with source audit; no claim of native checkout execution by fake-repository tests. Inherited T856/T877 rows qualified; native T3 remains landing evidence. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6316-t-887-final-durable-search-evidence-at-f621acf9.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-30 · 2026-10-19T19:08:24.446Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-887-squash-integration-source
commit: 2be4b50401ce235ecc3a3472043a721c34098050
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6338 source delta clear. Integrated task patch against dev fc46edb1 preserves the original reviewed patch's exact 17 files and ordered added/deleted lines (+472/-21); new modules/dedicated tests blob-identical. Reviewed conflict wiring retains T-886/T-882/T-793 behavior. Coordinator 770f1f61 authorized merge. Known targeted verify-tool 2/3 failures in A-6332 are inherited unchanged dev fixture/admission, not passing runtime evidence; shared disposition remains pending. No C1–C3 verification transferred to new head. Prior runtime historical; new exact-head mode-free gate follows disposition, with fresh review if shared correction changes head.

### impl-887 · 2026-10-19T19:13:38.747Z

Coordinator-posted shared fix a7159290 (T-891) cherry-picked as c2153c7f on delta-source-reviewed 2be4b504. Only hub/test/verify-tool.test.ts changes (+5/-1); inherited failures now 3/3 green (.0756/.0561/.0334s bodies), both-package typecheck green. Pre-push fetch + merge-tree origin/dev HEAD clean, tree f50b11a26e4626b08792fa2c133883315b31862e. Pushed; fresh delta source review requested before mode-free verify.

### rev-30 · 2026-10-19T19:14:18.405Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-887-shared-fixture-source
commit: c2153c7fadfab6288e24c1a0d65c92a04531d964
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6361 Shared-fix delta clear: only verify-tool fixture changes, final blob exactly equals T-891 source/final-reviewed a7159290; assertions unchanged. Coordinator e1f1e544 authorized pick. T-887 integration/source unchanged. T-891 A-6359 supports fix, not T-887 same-head runtime. C1–C3 await new mode-free gate.

### impl-887 · 2026-10-19T19:20:46.139Z

Coordinator revised shared fix applied exactly as posted: reverted old c2153c7f via 65737625, cherry-picked a7159290 as 0385319e and 67a01b6f as 50f5430c. Final delta from source-reviewed 2be4b504 is only verify-tool.test.ts +7/-1, blob identical to reviewed T-891 final. Targeted 3/3 (.151/.076/.046s) and both-package typecheck green; required fetch + merge-tree clean. Pushed 50f5430c; fresh delta review requested. Cancelled a17c4825/A-6369 remains no-runtime-proof evidence.

### rev-30 · 2026-10-19T19:22:13.031Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-887-revised-shared-fixture-source
commit: 50f5430ca24a237e2f9dc0af7f54bacedd3be214
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6393 cumulative shared-fix source clear. Net only verify-tool.test.ts+7/-1 from 2be4b504; blob exactly equals T-891 final67a01b6f. Coordinator151c645e authorization; all original task source unchanged, assertions preserved. Runtime C1–C3; cancelled A-6369 supplies no execution proof; new exact-head mode-free receipt required, no criteria verified yet.

### impl-887 · 2026-10-19T19:29:20.921Z

Replacement exact-head mode-free verify 75841ae8 green at unchanged source-reviewed 50f5430c: 1609/1609, hub and Neovim complete. Revised T-891 fixture covered; all owned search/probe/Bug/flake/concurrency controls fit ordinary and 5/5 load tier budgets. Linux c-8 lon1 lifetime 350s, cost $0.0243. Receipt A-6417; refreshed claimant C1–C3 done marks. Awaiting current-head final Reviewer settlement. Prior f621acf9 receipt and cancelled a17c4825 remain historical only.

### rev-30 · 2026-10-19T19:30:10.291Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-887-integrated-final
commit: 50f5430ca24a237e2f9dc0af7f54bacedd3be214
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6420 Exact-headA-6417/75841ae8 final clear: ordinary1609/1609,0fail/cancel/skip/TODO, all22groups5/5, no owned budget/resource rows. Owned criterion proofs audited; all8owned identities executed ordinary and5/5; sourceA-6338/A-6393. Allcriteria verified; unownedT883 budgets separately owned, no taskT3claim.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T19:41:42.879Z

Merged 30e7bfe5e12ac389054acd6586a8d91a84910d53 onto dev.
