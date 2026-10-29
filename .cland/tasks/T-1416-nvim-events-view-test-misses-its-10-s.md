---
id: T-1416
kind: task
title: nvim events view test misses its 10 s first-page wait once under a loaded task run
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1212
branch: t/T-1416-nvim-events-view-test-misses-its-10-s
created: 2026-10-28T00:02:27.244Z
updated: 2026-10-29T19:12:38.825Z
closed: 2026-10-29T19:12:38.825Z
---

## Summary

`nvim/test/events.test.ts::Events view opens through the registry, groups days, pages, folds and follows live rows without losing selection` failed once in T-1383's mode-free run 78bce2b0 (Linux droplet c-8 lon1, head 88135628, log A-12965): `Error: the screen never showed events first page within 10000 ms` at line 33 (10.69 s). The test is unchanged and outside T-1383. Alone it passed 5/5 on dev e7297a5e (macOS, Node 24.21.0); it passed in every other recent run.

## What to build

Find why the first events page can take over 10 s to render under load (a hub reply waiting behind other work, a render wait that polls the screen instead of a state receipt, or a slow fixture) and make the wait observe the page's own render receipt, bounded for a loaded runner, without hiding a real stall.

## Acceptance criteria

- [x] C1. The cause is attributed with the failing run's output and reproduced deterministically (under CPU load where load is the cause; at a controlled boundary such as a calendar date crossing where it is not).
  - done: impl-1416 · 2026-10-29T18:45:00.775Z
  - verified: rev-32 [reviewer] · run rev-20261029-1416-evidence1 · 2026-10-29T19:04:24.739Z · commit cc7f60e4715a1719248d4e830aa8151183ce73b9
- [x] C2. The identity passes 10/10 at two workers plus owned CPU load.
  - done: impl-1416 · 2026-10-29T18:42:37.727Z
  - verified: rev-32 [reviewer] · run rev-20261029-1416-evidence1 · 2026-10-29T19:04:24.739Z · commit cc7f60e4715a1719248d4e830aa8151183ce73b9

## Comments

### impl-1416 · 2026-10-29T18:38:29.820Z

Diagnosis evidence: A-12965 lines 19712–19756 contain 'Error: the screen never showed events first page within 10000 ms' while the screen already has the Events heading and claimed event 0, with day Tue 27 Oct and 23:59 row times but no today suffix. Test captures today/yesterday at module evaluation, and events.render compares the row day against current local day. A UTC-midnight crossover can invalidate the predicate permanently. No production wire/schema/admission contract change is planned; existing stub/Neovim render seam will cover controlled rollover.

### rev-32 · 2026-10-29T18:44:41.170Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261029-1416-source1
commit: ea33d339211dfde9fdae6aa9fc256ebefa50ea93
scope: full
findings: [{"severity":"medium","text":"M1: H1 '# Neovim Events' fails unchanged test-docs.test.ts file-path heading guard; use plain '# nvim/test/events.test.ts', retain owning guard red/green.","file":"docs/agents/tests/nvim-test-events.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13976 consolidated full audit: Standards1medium M1/Spec0additional. Calendar correction is supported by original screen already showing page, fixed UTC rows/current date and unchanged10s positive heading+row checks. Correct only document file-path H1 and retain unchanged guard red/green, then fresh source review before configured verify. C2 remains runtime-unverified; supplemental local stress proof preserved. No Reviewer execution.

Criteria: C1 failed (Source integration blocked by owning per-test document H1 incompatible with unchanged test-docs guard.).

### rev-32 · 2026-10-29T18:45:48.776Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261029-1416-source2
commit: cc7f60e4715a1719248d4e830aa8151183ce73b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13982 full successor source clear, Standards0/Spec0 findings. M1 resolved by sole H1 correction to plain repository test path; unchanged owner guard red/green summary A-13979 retained. All calendar/runtime assertions and bounds byte unchanged from A-13976 audit. Prior macOS stress remains attributed to ea33d339, not relabelled as executed new-head proof. C1/C2 remain runtime-unverified pending same-head configured evidence. No Reviewer execution.

### impl-1416 · 2026-10-29T19:03:56.387Z

Configured run b4eed495 exit0 at cc7f60e4715a1719248d4e830aa8151183ce73b9, original A-14008. Linux x64 droplet c-8 lon1 cland-v0-f513a0fc; Node24.21.0, Neovim0.12.5, Chrome Headless Shell156.0.8078.4/playwright1248. Host T0, T1, fallback allT2 and Web passed; T3/T4 not executed. General workers2, T1 worker1, Web4. Duration/lint/ratchet report-only warnings retained. Final original-record evidence review queued with source2 A-13982, local controlled red/green, documentation guard3/3, and prior runtime-identical ea33d339 macOS10/10 two-worker+CPU A-13974. Not a merge/integrated cover claim.

### rev-32 · 2026-10-29T19:04:24.739Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261029-1416-evidence1
commit: cc7f60e4715a1719248d4e830aa8151183ce73b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14009 final same-head clear. Original A-14008 parsed4197 ordinary/75 separate load passes,zero nonpasses/unmatched starts; target1.351940815s,Events4/4,owning docs guard green. C1 verified across original already-rendered failure, controlled-rollover supplemental red/green and reviewed calendar assertions. C2 original A-13974 ten exact complete/positiveCPU/native-close probe rows at ea33d339 carried only through H1-only successor; not relabelled new-head execution. Host T0 distinct from Linux T1/allT2/Web, noT3/T4; lint/budgets report-only. No Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T19:12:38.825Z

Merged 5918f1486a9b18b1411a0cc314e7cf867899db6f onto dev.
