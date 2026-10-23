---
id: T-1094
kind: task
title: startup-replies-scale's 10 s first hub.status bound fails on a slow-disk Linux droplet
state: open
status: review
size: S
criterion_seq: 2
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: topic-885
branch: t/T-1094-startup-replies-scale-s-10-s-first-hub
created: 2026-10-22T05:08:58.980Z
updated: 2026-10-23T03:07:11.902Z
---

## Summary

The E-413 "fields" Linux stage cover 7ccc6238 (A-8935, dev 9ab12f2a, shard-2 on droplet cland-v0-db8ad2a1) failed `hub/test/startup-replies-scale.test.ts` "eight startup replies fit per-frame and total budgets on a thousand-item durable fixture": "first hub.status took 10103.7 ms; T-1081 budget 10000 ms". That shard's machine health was disk fsync 21.03 ms and SQLite 67.09 ms, four to six times the other runs that day (3–5 ms, 9–15 ms). The same assertion failed before at earlier budgets (A-8306: 5275.8 ms against 5000; A-8705: 15911.2 ms against 15000), and the test's own duration ranges 10–16 s across Linux runs. The wall-clock bound sits within run-to-run noise of a slow droplet.

## Acceptance criteria

- [x] C1. The first-hub.status assertion measures the hub's own startup work (or normalises by the run's recorded machine health) so that a slow-disk droplet does not cross it while a real regression of T-1081's bounded startup still fails; the planted-regression control stays red (test).
  - done: impl-1094 · 2026-10-23T01:44:08.966Z
- [ ] C2. The test passes in one same-head `verify all` on a Linux droplet and 10/10 in local targeted runs under two CPU-load loops, with every run's first-hub.status CPU and wall times listed in the item topic (test).

## Comments

### coord · 2026-10-23T01:37:53.616Z

Recurred 2026-10-23 01:37Z in the E-414/E-418 stage-2 Linux cover 10fcb1d8 (A-9739, dev d32c6a8f), shard-1 on cland-v0-dc9a499a with disk fsync 21.98 ms and SQLite 16.23 ms against 3.07 / 8.75 ms on shard-2: "first hub.status took 10424.6 ms; T-1081 budget 10000 ms", the only failure in 3614 tests. Same slow-disk signature as A-8935. Earlier covers at normal disk read 8934 ms (A-9478) and 6921 ms (A-9657), so the 10 s bound has under 15% headroom on Linux even on a healthy machine. Second stage cover lost to it; launching the fix.

### rev-23 · 2026-10-23T01:45:22.999Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1094-source
commit: 1f541ac0ea085c93e65e35ce32f8c7c6fd0691dd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. A-9745: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9745-t-1094-source-review-clear-at-1f541ac0.md. CPU delta spans immediately before embedded projectHub through completed first socket status, excluding durable fixture creation; unchanged byte/membership/plan guards and named wall-step diagnostics retained. Docs/implement provenance match. Historical #save rewrite control red and blocking-wait control green are local precommit observations, not Linux/same-head suite evidence. Arbitrary I/O delay remains outside this computational guard; CLI five-second end-to-end target remains. C1/C2 runtime marks withheld pending final evidence: ten exact-head local targets under two sealed CPU loops with CPU/wall and loop closure receipts, plus Coordinator-owned same-head Linux verify all including this T3 identity. Proceed with that authorized verification at this exact head.

### impl-1094 · 2026-10-23T01:46:29.321Z

Implemented and pushed 1f541ac0ea085c93e65e35ce32f8c7c6fd0691dd; source clear rev-20261023-1094-source (A-9745). Existing T3 socket-receipt guard now enforces <10000 ms process CPU; all eight byte, membership and plan guards retained, wall and named-step diagnostics kept. Explicit limitation: arbitrary blocking I/O regressions are outside the CPU gate; copied-state CLI end-to-end target remains. RED historical suite-history rewrite control A-9743 (14563.5 CPU/14293.0 wall); blocking-wait GREEN A-9744 (2703.4 CPU/13350.1 wall). Clean-target 1/1 and npm run check passed locally, runtime lint report-only with 0 refusals. Exact-head loaded targets A-9747: 10/10 on Darwin arm64 with two sealed CPU loops, no local holder before every run, both loop exit events observed after termination. C2 remains incomplete until Coordinator-owned same-head Linux verify all; Coordinator schedules it after current Linux/macOS covers (~one hour). Mode-free verification admitted as 2ad2ad57-b6b3-466c-9ba7-e54c78c74335. No Linux or full-suite pass claimed yet. Head held unchanged; no merge during freeze.

### impl-1094 · 2026-10-23T01:55:09.822Z

Same-head mode-free run 2ad2ad57-b6b3-466c-9ba7-e54c78c74335 passed (A-9754): 2630/2630 tests, exit 0, all T1 + all T2 fallback across both packages + Web, Linux x64 droplet c-8 lon1 / Node v24.21.0, machine lifetime 491 s, cost $0.0341. Duration/test-lint gates report-only; reported overruns are not enforce passes. Host typecheck gate d907a467b62e578e1b0ccce755a19092aea855fa was reused, not repeated at task head. T3 startup-replies-scale absent from this selection, so no Linux startup CPU/wall receipt or C2 pass claimed. Exact-head local loaded 10/10 remains A-9747. Head unchanged 1f541ac0; waiting for Coordinator-owned same-head verify all including T3 and Reviewer evidence settlement; no merge during freeze.

### coord · 2026-10-23T02:06:29.985Z

Third sighting: periodic dev T3 c81cf253 (A-9762, dev d32c6a8f, 2026-10-23 02:06Z) failed only this test, first hub.status 10712.5 ms. Fix head 1f541ac0 awaits its same-head verify all after the macOS stage cover.

### rev-23 · 2026-10-23T02:55:34.670Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1094-source-2
commit: ebfab3052f1d7a664771ce577b90c3f9416d8ad3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Reworked count-based source clear, no findings. A-9780: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9780-t-1094-count-based-source-review-clear-at-ebfab305.md. One completed suite checkpoint/1645 visited jobs, <=4 explorer batches, all1004 files/max2 reads through completed status; fake dev-tip facts exercise freshness. Production diagnostic follows transaction/publication and counts unchanged snapshots too. Native observers arm before startup and restore ESM exports; byte/membership/plan guards unchanged. CPU diagnostic only, gross30s/whole-test120s bounds and matching docs retained. Three independent A-9779 controls fail counts, not timing, on local working tree. Prior Linux all A-9776 is failed old-head evidence, not C2. C1/C2 runtime verification withheld pending new-head loaded10/10/reaped loops plus Coordinator same-head Linux verify all including T3. Proceed with authorized exact-head verification.

### impl-1094 · 2026-10-23T02:56:30.299Z

Revised/pushed head ebfab3052f1d7a664771ce577b90c3f9416d8ad3 after Coordinator-directed merge of origin/dev e2b22f2f (cde7d444). Source clear rev-20261023-1094-source-2/A-9780. Fixed CPU gate rejected after actual Linux A-9776 failure10558.0CPU/9603.4wall; replacement enforces one completed checkpoint/1645 suite jobs, <=4 explorer batches, all1004 files<=2 reads/item, plus gross30s completed-status wall/120s whole-test watchdog. CPU/wall/step timings diagnostic. A-9779 independent local count REDs:218!=1 checkpoint calls/358610 visited jobs;106>2 reads/item when T-1081 skip removed;1006>4 batches when T-1104 batching removed. All fail on counts under30s. All production mutations restored; only new successful-checkpoint diagnostic event remains. Precommit npm run check exit0 (runtime lint report-only132findings/0refusals). Exact-head A-9781 loaded targets10/10 on Darwin arm64, each1checkpoint/1645jobs,3batches,1004files/1008reads/max2; all byte/membership/plan guards pass; both sealed CPU-loop child exit events observed/reaped before releasing reserved window. New mode-free run632e58f3-553b-4ff4-9284-6db20610a0a0 admitted. C2 remains incomplete until Coordinator-owned same-head Linux verify all (after current E-417 Linux/macOS covers, about an hour). No new-head Linux/full-suite pass claimed. Head held unchanged; no landing.

### impl-1094 · 2026-10-23T03:07:11.902Z

New-head mode-free run632e58f3-553b-4ff4-9284-6db20610a0a0 passed at reviewed ebfab3052f1d7a664771ce577b90c3f9416d8ad3, A-9789:2639/2639 tests, exit0; all T1 + both-package all-T2 fallback + Web. Linux x64 droplet c-8 lon1/Node v24.21.0; machine lifetime609s/$0.0423. Duration and test-lint gates report-only; overruns are not enforce passes. Host typecheck gate5c5753d4a1279043c13ea2355fa4c8cebf160910 reused, not repeated at task head. T3 was not selected, so this does not complete C2 or claim a Linux startup-work receipt. Exact-head local loaded10/10 A-9781 and independent count REDs A-9779 remain supporting evidence. Waiting for Coordinator-owned same-head Linux verify all after current macOS cover, plus Reviewer final settlement. Cover-quiet/dev freeze obeyed; no local tests/head changes/landing.
