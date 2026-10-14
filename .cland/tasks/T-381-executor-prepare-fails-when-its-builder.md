---
id: T-381
kind: task
title: Executor prepare fails when its builder release is unconfirmed, and the release error is swallowed
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-344
topic: topic-241
branch: t/T-381-executor-prepare-fails-when-its-builder
created: 2026-10-14T09:04:29.537Z
updated: 2026-10-14T11:13:15.973Z
closed: 2026-10-14T11:13:15.973Z
---

## Summary

`cland executor prepare` built and transferred a real snapshot, then failed at the `release` stage with "builder release not confirmed". Two `executor-release-unconfirmed` records came within a second. That is `DropletExecutor.release` catching an exception from `deleteLeaseResources` and giving up without waiting. The release `catch` swallows the error, so the cause is invisible, and prepare turns a retriable, unconfirmed release into a failed prepare.

## Evidence

- T-347's C6 real check on 2026-10-14, run by the Coordinator with driver A-2262 at 205897b4 in a scratch hub. Builder droplet 608961348, c-8 lon1, created 08:56:11Z. Image 249754241 was built and transferred to lon1, nyc1 and sfo2 in 454 s.
- The scratch journal shows `executor-lease-active` at 08:56:38Z, then `executor-release-unconfirmed` at 09:03:42.100Z and 09:03:42.860Z, then `executor-prepare-failed` at 09:03:44Z.
- The driver's cleanup released the builder and deleted the image. The provider listing afterwards showed no `cland` droplets and no snapshots. Builder cost was about 8 min of c-8, roughly $0.03.
- The earlier real prepares (T-344 C7 on the smallest size, T-346 C7) confirmed their release. This one used `prepare_size = "c-8"` and three regions.

## What to do

1. Stop swallowing the release error: journal its cause (status, id, message) on `executor-release-unconfirmed`.
2. Find why `deleteLeaseResources` threw right after a long prepare. Candidates:
   - a 4xx or 5xx on the key delete, or on the droplet delete while the droplet is still locked by a snapshot or transfer action;
   - an expired transport or abort after the 454 s prepare.
3. Fix the cause. Prepare must not fail on a release that is merely unconfirmed: keep the image as prepared, and leave the builder in the durable `releasing` state for the retry and the sweep. Report an unconfirmed builder cost honestly in the notice.

## Acceptance criteria

- [x] C1. `executor-release-unconfirmed` carries the swallowed error's cause, and a fake-API test shows it for a delete that the fake rejects.
  - done: impl-381 · 2026-10-14T09:12:32.694Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-381-2 · 2026-10-14T11:12:45.673Z · commit 9d14fdfb018d017f6dc73cd9bda2b9436572459a
- [x] C2. The real cause is established and fixed, with a fake-API regression reproducing it (for example a droplet still busy with a snapshot or transfer action answering 422 on delete, then succeeding later).
  - done: impl-381 · 2026-10-14T09:28:18.154Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-381-2 · 2026-10-14T11:12:45.673Z · commit 9d14fdfb018d017f6dc73cd9bda2b9436572459a
- [x] C3. A prepare whose image is committed but whose builder release is still unconfirmed reports the snapshot as prepared, and the hub's retry or sweep later confirms the release and its cost.
  - done: impl-381 · 2026-10-14T09:12:34.123Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-381-2 · 2026-10-14T11:12:45.673Z · commit 9d14fdfb018d017f6dc73cd9bda2b9436572459a
- [x] C4. Real check, run by the Coordinator from the human's or Coordinator's shell with the driver of T-347 C6: prepare on c-8 with three regions confirms its builder release.
  - done: impl-381 · 2026-10-14T09:28:19.271Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-381-2 · 2026-10-14T11:12:45.673Z · commit 9d14fdfb018d017f6dc73cd9bda2b9436572459a

## Comments

### coord · 2026-10-14T09:06:00.672Z

Coordinator reading of C2 (2026-10-14 09:10Z): A-2262's scratch logs hold no provider response. The two unconfirmed records came 0.76 s apart, so the first delete threw at once, twice. C2 is met by the fix covering the transient classes with fake-API regressions (busy/pending-action 422 or 409, then success; 5xx; transport abort), with the release polling through transient rejections within its window. The observed real cause is recorded by C4's rerun through the new diagnostics, and the Reviewer judges C2 on both.

### impl-381 · 2026-10-14T09:08:53.317Z

CLI/hub regression reproduced the original failure (release: builder release not confirmed; snapshot prepare failed). First fix retains the prepared image and pending durable lease with null lifetime/cost; later sweep confirms deletion and cost. Adding bounded retry regressions for 409, 422, 503 and provider transport timeout. The original provider response was not captured: C2's observed cause will come from the Coordinator's C4 rerun with journal diagnostics.

### rev-23 · 2026-10-14T09:17:22.687Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-381-1
commit: 9d14fdfb018d017f6dc73cd9bda2b9436572459a
scope: full

No high or medium findings. droplet.ts:191–218 retries transient cleanup failures under one absolute deadline, journals redacted status/id/message and retains durable releasing ownership. api.ts:67–84 / cleanup.ts:5–27 carry that bound through every list/identity/delete call. prepare.ts:158–184 retains a completed snapshot when builder lifetime/cost remain unconfirmed; CLI/frame-first regressions preserve image/restart/settlement and diagnostic/redaction assertions. No criteria source-verified: C1/C3 await exact-head full evidence; C2 also awaits observed real cause under Coordinator's interpretation, and C4 is the Coordinator-owned c-8/three-region rerun. Source clear permits the required full verify and authorized prepare-only check at this exact head. A-2306: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2306-t-381-full-source-review-clear-at-9d14fdfb.md.

### coord · 2026-10-14T09:20:25.701Z

C4 real create: droplet 608967227 (cland-t381-real-809f4d5b), c-8 lon1, created 2026-10-14T09:20:20.396Z, deadline 2026-10-14T09:35:20.396Z, $0.25/hour. Prepare-only check at reviewed head 9d14fdfb018d017f6dc73cd9bda2b9436572459a; one builder, three regions, no parallel runs.

### coord · 2026-10-14T09:27:37.743Z

C4 real destroy: droplet 608967227 (cland-t381-real-809f4d5b), released, released 2026-10-14T09:27:33.184Z, lifetime 430384ms, estimated cost $0.029887777777777777.

### coord · 2026-10-14T09:27:38.886Z

C4 complete at reviewed head 9d14fdfb018d017f6dc73cd9bda2b9436572459a: 0 release retries, 0 unconfirmed release records. Confirmed builder cost $0.029888. Provider cleanup listings and actual causes are in A-2310: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2310-t-381-c4-prepare-only-real-check-complete-at-9d14fdfb.md. No suite or parallel run was started. The T-381 claimant marks C2/C4 from this evidence.

### coord · 2026-10-14T09:27:53.073Z

Coordinator reading of C2 after C4 (2026-10-14 09:30Z): the real prepare-only rerun A-2310 at 9d14fdfb confirmed the builder release, with 0 retries, 0 unconfirmed records and $0.0299. The provider was empty afterwards. The earlier failure was transient and its cause was not observed. C2 is met by the fix covering the transient classes (fake regressions) plus diagnostics that will name any future cause (executor-release-retry and the unconfirmed cause). This check's spend was $0.0299; the failed attempt-1 import crash created nothing.

### rev-23 · 2026-10-14T11:12:45.673Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-381-2
commit: 9d14fdfb018d017f6dc73cd9bda2b9436572459a
scope: evidence

Final clear; no high or medium findings. Exact-head full a478538c/A-2341 passes typecheck and 1989/1989 across all phases, with zero failures/cancellations/skips/todo. C1 diagnostic and C3 durable pending-builder/image/restart/cost regressions pass. C2 uses the Coordinator's explicit 09:27:53 interpretation: transient-class fake coverage plus future-cause diagnostics and the successful real rerun; the original provider cause remains unobserved. C4 A-2310 confirms same-source-head c-8 prepare across lon1/nyc1/sfo2, builder release 430384ms/$0.0298878, snapshot deleted and empty final cleanup listings. C1–C4 verified. Evidence A-2342: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2342-t-381-final-clear-exact-head-suite-and-real-prepare-receipt.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-14T11:13:15.973Z

Merged 83b74c6ee6e47810c0b6849b563565d238840e2e onto dev.
