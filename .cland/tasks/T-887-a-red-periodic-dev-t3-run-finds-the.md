---
id: T-887
kind: task
title: A red periodic dev T3 run finds the landed merge that broke it and files a Bug
state: open
status: review
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
updated: 2026-10-19T19:08:24.446Z
---

## Summary

D67, part two: when a periodic dev T3 run (T-886) goes red, the hub finds the landed merge that broke it among the merges since the last green periodic run. It reruns only the failing files at chosen commits, then files a Bug naming that merge and notifies the Coordinator and the merge's last claimant. A red periodic run never stops the merge queue.

## Acceptance criteria

- [x] C1. A red `dev-t3` run with merges M1…Mn since the last green periodic run reruns only its failing files, bisecting over those landed commits, and names the first merge at which they fail. A failing file that also fails at the last green head is reported as pre-existing, not blamed (T1 test over the search with a fake runner).
  - done: impl-887 · 2026-10-19T18:20:35.564Z
  - verified: rev-30 [reviewer] · run rev-20261019-887-final · 2026-10-19T18:21:13.744Z · commit f621acf90a1e1ebabe06c266f9346bf8e003a30b
- [x] C2. The hub files one Bug under the Bugs category for the named merge, with the failing files, run ids and both heads. It notifies the Coordinator in General and the merge's last claimant session if live. A failing file that passes on rerun at the red head is reported as a flake and files nothing (T2 test).
  - done: impl-887 · 2026-10-19T18:20:36.042Z
  - verified: rev-30 [reviewer] · run rev-20261019-887-final · 2026-10-19T18:21:13.744Z · commit f621acf90a1e1ebabe06c266f9346bf8e003a30b
- [x] C3. While the search runs, merge batches keep forming and landing (T1 test over the controller).
  - done: impl-887 · 2026-10-19T18:20:36.638Z
  - verified: rev-30 [reviewer] · run rev-20261019-887-final · 2026-10-19T18:21:13.744Z · commit f621acf90a1e1ebabe06c266f9346bf8e003a30b

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
