---
id: T-498
kind: task
title: "doctor-isolation test: rm of the other fixture hits ENOTEMPTY while its hub is still live (Linux, under load)"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-302
branch: t/T-498-doctor-isolation-test-rm-of-the-other
created: 2026-10-15T14:03:16.446Z
updated: 2026-10-15T15:08:56.777Z
---

## Problem

`hub/test/doctor-isolation.test.ts:16`, 'doctor --fix under one fixture root preserves another deleted-project hub', failed on Linux in T-458's droplet verify 903d684f (A-3044). The test's `rm(other, {recursive: true})` hit ENOTEMPTY while the other fixture's hub was still live and writing to its `.cland/run`. T-458 doesn't touch the file, and the file passes alone in about 2 s on the Mac.

## Acceptance criteria

- [x] C1. The test stops the other fixture's hub and observes it gone before removing its directory. Alternatively, the removal tolerates and retries the live-writer race within a bounded wait. Every assertion stays, and the root cause is recorded in the commit.
  - done: impl-498 · 2026-10-15T15:08:08.811Z
  - verified: rev-31 [reviewer] · run rev-20261015-498-source · 2026-10-15T15:08:56.777Z · commit 9534d5c9b70bdbf57255009cce0d5f2976074058
- [ ] C2. doctor-isolation.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### impl-498 · 2026-10-15T15:06:29.699Z

Baseline whole-file command `node --test hub/test/doctor-isolation.test.ts` passed on Mac (1 test, 2233 ms). Reported Linux A-3044 already supplies the live-writer ENOTEMPTY failure, so skipping a new load reproduction/minimisation: the existing one-test file is the exact regression seam. Both daemons must stay alive to preserve all sweep assertions. Applied the same bounded fs.rm retries used in orphan-servers.test.ts: 10 retries, 50 ms linear delay (2.75 s maximum backoff per directory), to both live roots. No assertions removed or changed; no unconditional sleep.

### impl-498 · 2026-10-15T15:07:05.711Z

Fix committed as 9534d5c9 (test: retry live fixture removal in doctor isolation), pushed to origin. Awaiting T-485's current-file completion; T-485 yielded the next ~12s window to T-498, then T-497. Five required targeted passes will precede the source review request.

### rev-31 · 2026-10-15T15:08:56.777Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-498-source
commit: 9534d5c9b70bdbf57255009cce0d5f2976074058
scope: full

Source review clear at 9534d5c9b70bdbf57255009cce0d5f2976074058. No high, medium or low findings.

## Standards
No findings against repo testing guidance or baseline smells. The only diff is the two live-root rm calls and an explanatory comment; fs.rm's bounded retry options match the existing orphan-servers fixture pattern. No unconditional wait, new helper or production change; diff check passes.

## Spec
C1 verified: hub/test/doctor-isolation.test.ts:17-18 uses recursive removal with maxRetries 10 and retryDelay 50 for both live fixture roots. The 10-delay linear retry schedule totals 2750 ms of backoff. Keeping both hubs running preserves the ownership proof: the scoped orphan scan must find the owned deleted-project hub and exclude the foreign hub; doctor --fix must end only the owned PID and leave the foreign PID alive. Every existing assertion is unchanged.
The commit records the Linux .cland/run live-writer ENOTEMPTY cause; A-3044:3934-3936 supplies the exact historical failure at the foreign fixture.

A-3093 checked: five labelled quiet serial whole-file Mac passes at this exact head, one test each, 0 failures/skips/cancellations, 1.963-2.875 s per file. That satisfies the Mac portion of C2; C2 remains unverified until the required exact-head post-source droplet verify.
Standards: 0 findings. Spec: 0 findings. No Reviewer tests or edits.

Criteria: C1 verified.
