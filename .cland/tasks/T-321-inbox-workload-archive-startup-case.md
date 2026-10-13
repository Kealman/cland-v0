---
id: T-321
kind: task
title: inbox-workload archive-startup case fails on a c-8 droplet but not locally or in the 4-CPU container
state: open
status: review
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-268
blocked_by: []
topic: topic-200
branch: t/T-321-inbox-workload-archive-startup-case
created: 2026-10-13T10:06:48.166Z
updated: 2026-10-13T11:20:37.575Z
---

## Summary

On a DigitalOcean c-8 droplet (Ubuntu 24.04, 8 vCPU, ordinary user), the archive-startup case of `hub/test/inbox-workload.test.ts` fails in the full suite. It still fails after T-314's indexed-subtree fix (deb88d3) and T-282's regression for it (5168701, 5c0568a). It passes on macOS and in the local 4-CPU Ubuntu container, alone and under a scoped 16-worker contention. Find the cause, reproduce it locally, and fix it with no raised time bound, no skip and no retry.

## Parent

T-268: Suite spend and Linux portability. T-282's acceptance run is blocked on this.

## Evidence

- Second droplet run (2026-10-13 07:43Z, head 7eab38f): "all protocol holds committed: not within 15000ms" (A-1846).
- Fourth droplet run (2026-10-13 10:06Z, head 5c0568a): hub tests 1451 passed, 1 failed (archive startup in inbox-workload), 3 skipped. The evidence is published by impl-282 in topic-195 with the exact assertion.
- The container proof at 5168701 passed the scoped contention case and the file ten times alone (A-1867).
- The runner uses a fixed 4 workers per phase, so CPU count does not change the hub worker count. The difference between the droplet and the container is not yet explained.

## Constraints

- Iterate in the local Ubuntu 24.04 container through Coordinator slots: unchanged Docker settings, `--init`, an ordinary user.
- No further droplet run without a notice through the Coordinator and the human's stand-in.
- Decision D24 (stand-in, 2026-10-13 ~10:08Z): if no local reproduction and fix lands within one Implementer cycle, about three hours from the item's launch, the stand-in records D26. D26 narrows T-282's criterion to green on c-8 except the named load-sensitive bounded-work cases listed in T-282. T-282 then closes on the fourth run's evidence, this item moves to Tech debt, and T-268 goes to its QA demo.

## Acceptance criteria

- [x] C1. The cause of the droplet-only failure is named in the item, with evidence.
  - done: impl-321 · 2026-10-13T10:22:28.444Z
  - verified: rev-26 [reviewer] · run rev-20261013-321-source-2 · 2026-10-13T10:52:31.076Z · commit fa1807c4b45f2ca271c6d9518f9e4469022af427
  - verified: rev-26 [reviewer] · run rev-20261013-321-source-3 · 2026-10-13T10:55:30.870Z · commit 4d9f6ac97746d466c7991686311dd08fa2a9f0cc
  - verified: rev-26 [reviewer] · run rev-20261013-321-source-4 · 2026-10-13T11:18:13.718Z · commit 91badd26d298be4b30d3433f09e471d343548468
- [x] C2. A local reproduction exists, as a test or as a recorded container recipe, that fails before the fix.
  - done: impl-321 · 2026-10-13T10:22:29.203Z
  - verified: rev-26 [reviewer] · run rev-20261013-321-source-2 · 2026-10-13T10:52:31.076Z · commit fa1807c4b45f2ca271c6d9518f9e4469022af427
  - verified: rev-26 [reviewer] · run rev-20261013-321-source-3 · 2026-10-13T10:55:30.870Z · commit 4d9f6ac97746d466c7991686311dd08fa2a9f0cc
  - verified: rev-26 [reviewer] · run rev-20261013-321-source-4 · 2026-10-13T11:18:13.718Z · commit 91badd26d298be4b30d3433f09e471d343548468
- [x] C3. The fix is at the cause. The file passes ten times alone and once in a full run in the container, with every original bound unchanged.
  - done: impl-321 · 2026-10-13T11:19:14.788Z
  - verified: rev-26 [reviewer] · run rev-20261013-321-c3 · 2026-10-13T11:20:37.575Z · commit 91badd26d298be4b30d3433f09e471d343548468
- [ ] C4. `cland verify` is green on macOS.

## Comments

### impl-321 · 2026-10-13T10:09:05.279Z

Started at 10:07Z with D24 cap about 13:07Z. Read item, T-282/T-268, topic-195 and A-1846/A-1867. Exact second-run symptom is 100 hold replies not seen within 15000ms; T-314's indexed subtree fix is already present, and runner concurrency is four on both machines. Requested fourth-run exact assertion and metadata from impl-282 in topic-200. Running unchanged archive-startup case locally before selecting deterministic probe; no droplet or container started.

### impl-321 · 2026-10-13T10:22:25.473Z

Cause and red/green evidence A-1897: fourth c-8 failure A-1890 is stop-6's OS probe, not the earlier hold bound. Eight real protocol stops with64unrelated retained items caused12,413tracker prepares; synchronous full tracker hydration in session membership/default subscription fan-out plus inbox/journal projection starves delivery of other completed ps probes. Controlled system-boundary ordering (first snapshot immediate; others real/bin/ps after200ms; one3500ms retained-item hydration delay) reproduces exact false stop error in4.114s before fix. Commit756f45a seeds/updates current item summaries before task publication and reads existing indexed session ownership; exact recipe green with288queries, plain320, original unchanged workload7/7green(archive11.588s vs55.996s baseline). Typecheck/default subscriptions13/13/plan approval2/2green. No OS probe bound, signal, lease, original fixture/deadline/sweep assertion or harness helper changed. Approved Linux slot pending current host queue drain; ten-file/container-full and macOS queued suite still required.

### rev-26 · 2026-10-13T10:47:55.624Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261013-321-source-1
commit: 8d32583ef699a662bb502df7fd51e77196b876ab

Medium — hub/src/hub/core.ts:562–563: plan !== undefined refresh includes plan:null epic candidates, including closed retained epics, so stop fan-out still hydrates unrelated retained history. Lead confirmed the Reviewer-requested case: 64 epic candidates, eight stops, 9,872 prepares > unchanged 1,000 budget. Preserve missing-child plan recovery while removing recurring candidate reads; renewed exact-head source review required under D25. A-1910 records Standards/Spec evidence and limits; no Reviewer test execution. C1/C2 supplied local red/green mechanism assessed, but actual c-8 ps error remains generic. C3 approved Linux proofs and C4 macOS full receipt still pending.

Criteria: C3 failed (core.ts:562–563 re-reads every retained epic candidate on projection; 64 unrelated open/closed epics reproduce 9,872 prepares for eight stops, over the unchanged 1,000 budget.).

### rev-26 · 2026-10-13T10:52:31.076Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-321-source-2
commit: fa1807c4b45f2ca271c6d9518f9e4469022af427

Source review under D25: no high/medium source finding remains. core.ts:316/362 use committed snapshots; tracker.ts:899–904/925 publishes changed plan refusal/acceptance through existing ItemChange, removing recurring retained-epic reads without losing missing-child/reparent freshness. A-1911 raw task/epic stop logs 240/288 queries resolve the earlier 9,872-query finding; inbox8/8 retains T-284 C7 and original sweep/query/OS bounds; plan approval3/3, gates8/8, task plans10/10 and typecheck green. Shared b5b67ad reviewed alone and unchanged as5d7b0f8; dev tracker/spec integration checked. C1/C2 verified for named synchronous hydration mechanism and supplied exact local red/green; original c-8 generic ps error still does not distinguish exit failure from timeout, so no stronger probe attribution claimed. C3 ten-file/full Linux and C4 macOS exact-head full gates remain unverified. Artifact records both axes; this source clear permits the authorized proof work, not merge readiness.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-13T10:55:30.870Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-321-source-3
commit: 4d9f6ac97746d466c7991686311dd08fa2a9f0cc

Source review under D25: no high/medium finding. A-1914's T-321 correction/evidence unchanged at merged head4d9f6ac; no hub/src or hub/test delta and shared plan readiness bytes unchanged. Integration contains landed T-318 Neovim category-count/navigation/prefix code and UI tests/docs plus tracker records, checked against rev-23 clear C1–C5/A-1913 full1766/1766 and merge0b5ca0e. git diff --check clean. C1/C2 marks renewed with prior c-8 generic-probe ambiguity explicitly retained. C3 approved ten-file/full Linux and C4 macOS full receipt still unverified; this source verdict clears exact-head subsequent macOS submission after protected-slot order, not merge readiness. Artifact records integration assessment.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-13T11:18:13.718Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261013-321-source-4
commit: 91badd26d298be4b30d3433f09e471d343548468

Source review under D25: no high/medium finding. hub/test/request-guard.test.ts:54–73 uses distinct equal-shaped T-6/T-8 baseline views, preventing incidental task.view replay within the existing 250ms argument-keyed window. All three500-read floods, latency limits, exact replay/logging assertions, write invalidation and flushLogs barrier unchanged; no production delta since A-1916. Confirms Coordinator's calibration assessment. C1/C2 renewed. C3 interpretation per Coordinator5e90457f accepts workload ten solo/full-run passes, but mark awaits published raw proof; failed overall container run remains failed evidence. Corrected Linux filter selected no named test, so exit0 is not counted. C4 exact-head macOS full still pending. Artifact records review and limits; source clear only, not final readiness.

Criteria: C1 verified, C2 verified.

### impl-321 · 2026-10-13T11:18:55.485Z

Protected container proof at4d9f6ac: ten solo inbox files8/8 each; all8 workload cases pass inside overall FAILED full run (archive20.999s). Full exit1 due request-guard calibration legitimate repeated task.view; explicit nvim diagnostic309pass/3existing skips. Corrected91badd2 continuation matched zero named tests; exit0 INVALID, not proof; both container/Desktop shutdowns0, END posted. Coordinator2ee45fde waives separate Linux calibration green; corrected named macOS/c-8 full tests supply it. Source clear renewed A-1918 at91badd2; same-head standalone typecheck completed0.
