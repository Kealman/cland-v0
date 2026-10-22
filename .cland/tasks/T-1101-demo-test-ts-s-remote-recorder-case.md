---
id: T-1101
kind: task
title: demo.test.ts's remote recorder case times out on demo.start under macOS T3 load
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-848
branch: t/T-1101-demo-test-ts-s-remote-recorder-case
created: 2026-10-22T09:03:34.023Z
updated: 2026-10-22T13:59:10.680Z
---

## Summary

The shared stage cover's macOS run 3dcaf593 (A-9068, dev ff6edeaa, local darwin arm64, 2 workers, T3 peak 1m load 7.25) failed `hub/test/demo.test.ts` "the demo recorder runs a headless case remotely and retains captures and executor accounting locally" with `Error: no result for demo.start within 5000ms` (hub/test/harness.ts:631). The same test passed 5/5 alone at the same commit (coord, 2026-10-22 09:05Z), and the Linux cover 4b8ac01b at that commit was green. Its 5 s frame-result wait is within load noise on a busy macOS run.

## Acceptance criteria

- [x] C1. The test waits for demo.start's durable receipt with a bound that holds under the T3 load of a full macOS run, or splits the fake executor's provisioning time from the asserted behaviour, keeping its final assertions (rule 9) (test).
  - done: impl-1101 · 2026-10-22T13:44:57.199Z
  - verified: rev-23 [reviewer] · run rev-20261022-1101-source · 2026-10-22T13:48:52.311Z · commit 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe
  - verified: rev-23 [reviewer] · run rev-20261022-1101-final · 2026-10-22T13:59:10.610Z · commit 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe
- [x] C2. The test passes 20/20 under `--test-concurrency 4` with a parallel CPU load on macOS, in a disposable root under rule 15 (test).
  - done: impl-1101 · 2026-10-22T13:44:57.249Z
  - verified: rev-23 [reviewer] · run rev-20261022-1101-final · 2026-10-22T13:59:10.610Z · commit 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe

## Comments

### coord · 2026-10-22T12:11:40.868Z

Second test, same cause: the macOS stage cover b2ce36f1 (A-9148, dev b99de2c7, local darwin arm64, T3 peak load 7.62) failed `hub/test/demo-release.test.ts` "demo stop waits for an archived droplet with stripped tags to become absent" with the same `Error: no result for demo.start within 5000ms` (hub/test/harness.ts:631). Both demo tests wait 5 s for the harness's demo.start reply under macOS T3 load. This item's fix should cover every demo.start wait in hub/test (demo.test.ts, demo-release.test.ts and any other caller of that harness request), not one file.

### impl-1101 · 2026-10-22T13:17:12.119Z

Implementation prepared: all 17 successful demo.start calls across demo.test.ts, demo-release.test.ts, demo-release-component.test.ts and demo-cap.test.ts use a helper that arms a new matching lease observer before sending, requires active/delivered/ready persistence, then separately bounds the correlated result. All existing final assertions remain. Five refusal-only calls retain the direct request seam. `node hub/bin/typecheck.ts -p hub/tsconfig.json` and `git diff --check` passed on the current uncommitted tree (local darwin arm64; static checks only, no suite/gate receipt). Test/load runs await cover-quiet lift and Coordinator's reserved load window per the 13:16Z decision.

### impl-1101 · 2026-10-22T13:44:57.135Z

C1/C2 implementation and targeted evidence complete. All 17 successful demo.start sites use the armed new-lease active/delivered/ready observer and a separate post-receipt reply bound; all final assertions retained. Five refusal-only sites remain direct frame requests. A-9178 contains every sample, timings and full raw TAP; runner A-9176. Local darwin arm64 at implementation head 7315450fb470634dc738117835d18e7a468de8a5: 20/20 stress waves at --test-concurrency 4 with four actual test-file workers and 16 CPU burners, 80/80 executions (40/40 each affected native scenario), highest sampled 1m load 36.954. Then 18/18 across all four demo files without added CPU load (23.661s). These are targeted T2/T3 checks, no suite/gate receipt. Nine baseline waves restored the old five-second wait and all passed, so the historical flake was not reproduced locally. Delivery dominates measured startup: provisioned-to-delivered 2605–3424ms versus provider create 158–389ms, pre-lease work 57–150ms and ready-to-reply 11–118ms. Load window released after observing CPU children exit. Review head 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe merges tracker-only origin/dev eb7755d8; implementation/test/docs files are unchanged from the tested head. qaPolicy is none and no QA brief is supplied.

### rev-23 · 2026-10-22T13:48:52.311Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1101-source
commit: 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe/tree 20f063348b2ba3560441316eb3c44548e9a58787, fixed base eb7755d8. All 17 success calls migrated and 5 refusal requests retained; existing final assertions unchanged. New helper arms persisted new active/delivered/ready lease observer before send, excludes old leases and correlates exact result lease under separately bounded reply wait. Docs/tier/isolation/cleanup checked; no production changes or findings. A-9178 parsed 20 unique four-worker stress waves, 80/80 executions (40 per native scenario), 16 CPU burners under authorized window; runner A-9176 inspected. Tested 7315450f has identical helper/tests/docs; review-head merge changes only tracker. Baseline 9 waves did not reproduce historical 5 s failure, limitation retained. C1 verified; local C2 proof accepted, final C2 mark awaits exact-head mode-free configured receipt. No Reviewer runtime, Linux/native-T3/full-suite/QA or enforcing-budget claim.

Criteria: C1 verified.

### rev-23 · 2026-10-22T13:59:10.610Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1101-final
commit: 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 clear at unchanged 88fc85294bf26d4b589c8dd8013c97db4ce1bdbe/tree 20f063348b2ba3560441316eb3c44548e9a58787. A-9184/09c04df4 original records and hub passed state checked: aggregate/T1/all-T2 hub+Neovim/Web exit 0; 2445 ordinary test and 375 file passes, no failures/skips/cancellations. T2 demo-cap 2/2 and release-component 9/9 pass; no task load-scope finishes or Linux native demo T3 inferred. C2 A-9178 macOS 20 unique four-worker waves/80 executions under 16 CPU burners already source-audited, tested helper/tests/docs identical across tracker-only merge; all-four-file targeted 18/18 retained. Baseline did not reproduce historical 5 s timeout, limitation explicit. Linux c-8 lon1 501 s/$0.0348, host 9b9049d5 reused/not repeated remotely; generic lint/duration/ratchet report-only, 2 missing baselines, no enforcing-budget/T3/T4/stage/QA/full-suite claim. Zero findings; Coordinator owns landing/deferred integrated coverage.

Criteria: C1 verified, C2 verified.
