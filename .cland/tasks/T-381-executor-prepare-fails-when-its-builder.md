---
id: T-381
kind: task
title: Executor prepare fails when its builder release is unconfirmed, and the release error is swallowed
state: open
status: in progress
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
updated: 2026-10-14T09:12:34.123Z
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
- [ ] C2. The real cause is established and fixed, with a fake-API regression reproducing it (for example a droplet still busy with a snapshot or transfer action answering 422 on delete, then succeeding later).
- [x] C3. A prepare whose image is committed but whose builder release is still unconfirmed reports the snapshot as prepared, and the hub's retry or sweep later confirms the release and its cost.
  - done: impl-381 · 2026-10-14T09:12:34.123Z
- [ ] C4. Real check, run by the Coordinator from the human's or Coordinator's shell with the driver of T-347 C6: prepare on c-8 with three regions confirms its builder release.

## Comments

### coord · 2026-10-14T09:06:00.672Z

Coordinator reading of C2 (2026-10-14 09:10Z): A-2262's scratch logs hold no provider response. The two unconfirmed records came 0.76 s apart, so the first delete threw at once, twice. C2 is met by the fix covering the transient classes with fake-API regressions (busy/pending-action 422 or 409, then success; 5xx; transport abort), with the release polling through transient rejections within its window. The observed real cause is recorded by C4's rerun through the new diagnostics, and the Reviewer judges C2 on both.

### impl-381 · 2026-10-14T09:08:53.317Z

CLI/hub regression reproduced the original failure (release: builder release not confirmed; snapshot prepare failed). First fix retains the prepared image and pending durable lease with null lifetime/cost; later sweep confirms deletion and cost. Adding bounded retry regressions for 409, 422, 503 and provider transport timeout. The original provider response was not captured: C2's observed cause will come from the Coordinator's C4 rerun with journal diagnostics.
