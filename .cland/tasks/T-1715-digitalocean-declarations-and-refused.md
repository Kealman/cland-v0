---
id: T-1715
kind: task
title: DigitalOcean declarations and refused creates
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1711
  - T-1713
topic: topic-1417
branch: t/T-1715-digitalocean-declarations-and-refused
created: 2026-11-06T10:48:33.314Z
updated: 2026-11-07T00:18:06.943Z
---

## Summary

The DigitalOcean provider declares its prices from `/v2/sizes` (`price_hourly` live, 0 idle once destroyed), `stoppedBills = true`, per-second billing with a 60 s minimum, its token confinement, 250 requests a minute, the machine limit from `/account`, x86_64, and no extra address. A refused create (429, or 422 for the droplet limit) pauses creation with its retry time and retries once after it, with no cascade.

Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `hub/test/host-provider-digitalocean.test.ts`

## What to build

Declarations read through the API, and a per-provider pause that holds every create until the retry time. A create refused during the pause is answered `refused` with that time and is not re-sent.

## Acceptance criteria

- [x] C1. The declared live price per size equals the fake API's `price_hourly`, the machine limit equals its `/account` `droplet_limit`, and the declarations pass the contract suite (test).
  - done: impl-1715 · 2026-11-06T23:41:53.230Z
- [x] C2. A create answered 429 is reported `refused` with its retry time and succeeds on one retry after it (test).
  - done: impl-1715 · 2026-11-06T23:41:54.018Z
- [x] C3. While the pause holds, a second and a third create send no POST, and after it exactly one POST per create is sent (test).
  - done: impl-1715 · 2026-11-06T23:56:58.252Z
- [x] C4. A 422 droplet-limit refusal is paused and retried the same way, and the refusal text never carries the token (test).
  - done: impl-1715 · 2026-11-06T23:41:55.658Z

## Comments

### impl-1715 · 2026-11-06T23:37:39.094Z

Rule 20 consumer sweep: declaration readers are host-provider-contract.ts (validation + architecture), host-provider-declarations.test.ts, host/provider/fake.ts, host/provider/digitalocean.ts, and earliestStop in declarations.ts (takes validated available declarations). Registry constructs providers synchronously; pool-image calls prepare without declaration reads. No spend/host-list reader yet (E-1534 future consumer). Docs: docs/hub/host-providers.md, per-file provider docs and qa/briefs/E-1533-stage-1.md. No declaration reader in web/nvim or T3/T4. Add unavailable union to HostProvider, keep prior successful shape and validate/narrow in contract. Fake API fault consumers: executor-admission, executor-safety/component, executor-droplet, executor-prepare, suite-remote-process, digitalocean-pacing, host-provider-digitalocean; existing defaults and faults stay unchanged, new create-limit fault opt-in. DigitalOceanError consumers in executor and tests retain status/id/message; optional retryAt added compatibly. No wire frame or persisted record changes.

### rev-35 · 2026-11-06T23:46:58.438Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1715-source-1
commit: 166cdd0936583a7f340286b208f37a6e24bb5603
scope: full
findings: [{"severity":"medium","text":"The refusal catch covers both POST /droplets and its subsequent address GET. If POST succeeds and GET returns429, acquire reports refused/retryAt even though a droplet already exists; the documented retry creates a fresh UUID/key/droplet. Distinguish positively refused create from accepted/possibly-created observation failure, retain ownership, and still pause future creates. Add an accepted-create→GET429 control proving no safe-refusal/replay claim.","file":"hub/src/host/provider/digitalocean.ts","line":113},{"severity":"medium","text":"Acquire's refusal catch replaces #createRetryAt without including its existing value, while concurrent refreshDeclarations can already have published a later deadline. A later-arriving shorter refusal therefore shortens the provider pause; calls during the original pause can enter API pacing instead of immediately returning refused with its latest time. Retain max(existing,new deadline) in the shared pause update and cover held concurrent answers with no API work during the longest pause.","file":"hub/src/host/provider/digitalocean.ts","line":114}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17298: complete source pass,2medium findings confirmed97ec5d61/50dc8773. Successful create followed by addressGET429 is mislabeled refused/safe-to-retry; retain accepted/possible native ownership. Acquire refusal overwrites existing longer concurrent-refresh pause; use monotonic shared update and held-answer/no-API-work regression. C3failed source guarantee; C1/C2/C4unverified. Approved declaration union/readers/atomic last-good behavior inspected with no other finding. A-17297 retained originals/transcriptions keep intermediate failures, tail-shell/status/source limits; native preservation/configured evidence pending. Fresh corrected source review before verify.

Criteria: C3 failed (Concurrent declaration refresh may set a longer pause that a later shorter create refusal overwrites; paused callers can enter API pacing instead of returning the latest refusal without API work.).

### rev-35 · 2026-11-06T23:52:18.302Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1715-source-2
commit: ea1e851da467834d68e145e35253c3c0c16d6d1a
scope: full
findings: [{"severity":"medium","text":"The new held-create regression releases its gate in finally but joins provider.acquire only afterward. If until/refresh fails, pending acquire is never joined by the fixture; api.close drains fake API calls, not provider intent writes still before POST, so root removal can race that writer. Prearm fixture-owned release+join before launch/setup awaits, ahead of api.close, and join the acquire on exceptional body exits as well.","file":"hub/test/host-provider-digitalocean.test.ts","line":433},{"severity":"medium","text":"The new test's outer timeout equals testWaitMs(2000), while its setup until uses that same value multiplied by the load factor (droplet default2), with assertions and cleanup still remaining. The outer watchdog can preempt valid admitted setup. Derive the outer envelope from the load-scaled setup budget plus bounded behavior/cleanup headroom without weakening any assertion.","file":"hub/test/host-provider-digitalocean.test.ts","line":433}]
finding_counts: {"high":0,"medium":2,"low":0}

A-17304: complete corrected-source pass. Both A-17298 production findings resolved by accepted-ID checkpoint/failed post-create observation and shared monotonic pause. New held-response regression has2medium fixture gaps: exceptional setup exit releases but does not join pending acquire before api.close/root removal; equal outer/inner budget is smaller than droplet-scaled until plus remaining work. Confirmed0d3b8983; prearm ordered release+join and reconcile envelope, assertions unchanged. No other source findings. A-17299 originalred30/32→green32/32, exact-head selected112/lint0 qualified; native preservation/configured pending. Criteria remain unverified; fresh corrected source review before scheduled native checks/verify.

### rev-35 · 2026-11-06T23:56:43.458Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1715-source-3
commit: d8989d02ea3f9f6955ad76658cdd184a32653470
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17306: corrected cumulative source clear. Prearmed beforeClose fences new admission/releases/joins latest acquire ahead of API/root disposal, plus finally joins typed initial receipt. Shared explicit2x setup and default34s derived watchdog resolve A-17304; assertions/product unchanged. Prior accepted-ID/monotonic-pause production findings remain resolved. A-17305 corrected32pass/Hubtypecheck0 source/signal limits inspected; intermediate typecheck failure and mixed-head lint remain labelled. Current historical C3failed/donefalse should be restored by claimant after implementation validation; C1–C4 unverified pending exact-head directed preservation +configured evidence. Obey Coordinator slot; affected after-stageQA separate.
