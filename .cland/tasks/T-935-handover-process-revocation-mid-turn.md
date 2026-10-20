---
id: T-935
kind: task
title: handover-process "revocation mid-turn" fails at 5 s under four-file load and its node process does not exit (E-482 demo round 4)
state: open
status: review
size: S
criterion_seq: 5
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-801
found_by: qa
topic: topic-688
branch: t/T-935-handover-process-revocation-mid-turn
created: 2026-10-20T04:56:46.417Z
updated: 2026-10-20T05:09:41.945Z
---

## Summary

E-482's DoD demo (qa-2, run qa-2026-10-20-qa2-3, release candidate 824105c5, lease a606ddb6, Linux c-8) ran hub/test/handover-process.test.ts green serially and in load rounds 1–3. In round 4 (four files at once, peak 1m load about 7–9), "revocation mid-turn: the human reassigns while the launched Coordinator is busy; its next call is refused and the revocation reaches it" failed after 5008 ms. Then the file's node process did not exit and ran into the brief's 600 s per-file timeout. T-801 fixed a 7.5 s failure of the same case on 2026-10-18 (C2: wall-clock waits replaced by observed events), so this is a regression of T-801 or a remaining wait. The round-4 log tail and the D5 reruns are in qa-2's E-482 evidence (topic-661).

## What to build

Find the wait that times out at 5 s under load, from the evidence log and a reproduction under four-file load on Linux. Replace it with an observed event or a FakeClock step, keeping every assertion. Make sure a failure in this case tears down its hub, spoke and harness fixtures so the test process exits instead of hanging.

## Acceptance criteria

- [x] C1. The cause of the 5 s failure is named from the E-482 log or a reproduction, and the wait is an observed event or a FakeClock step, with every assertion kept.
  - done: impl-935 · 2026-10-20T05:06:10.534Z
  - verified: rev-31 [reviewer] · run rev-20261020-935-source · 2026-10-20T05:09:41.944Z · commit 4563685bd704e4a0518b6bba8b65ec8500879668
- [x] C2. A forced failure of the case (a test-only injection, reverted before review) shows the file's process exits within 10 s of the failure.
  - done: impl-935 · 2026-10-20T05:06:11.181Z
  - verified: rev-31 [reviewer] · run rev-20261020-935-source · 2026-10-20T05:09:41.944Z · commit 4563685bd704e4a0518b6bba8b65ec8500879668
- [x] C3. The file passes 20/20 alone and 10/10 beside three other T3 files run at once on the Mac, as a stress loop started only on an empty verify queue (load rule), with the run counts in the evidence; the droplet 5/5 under load is judged by E-482's rerun.
  - done: impl-935 · 2026-10-20T05:06:11.867Z
  - verified: rev-31 [reviewer] · run rev-20261020-935-source · 2026-10-20T05:09:41.944Z · commit 4563685bd704e4a0518b6bba8b65ec8500879668
- [ ] C4. A mode-free `cland verify` at the reviewed head is green.
- [x] C5. fakeCodex and connectWsUi in hub/test/harness.ts register their shutdown and home removal through the same ordered cleanup ownership as fakeClaude (no raw t.after removal of a fixture home remains in harness.ts), with their existing tests green.
  - done: impl-935 · 2026-10-20T05:06:12.508Z
  - verified: rev-31 [reviewer] · run rev-20261020-935-source · 2026-10-20T05:09:41.944Z · commit 4563685bd704e4a0518b6bba8b65ec8500879668

## Comments

### coord · 2026-10-20T04:58:55.851Z

Correction from qa-2's round-4 evidence (A-7054): the assertions held. Role handover, the forbidden send and the revocation injection all show in the fixture events before the harness exits. What failed is the cleanup: `rmdir /tmp/fake-claude-KlavRs` threw ENOTEMPTY, so the case failed at 5008 ms. After that, the node test worker kept SQLite, log and journal handles, an inotify watch, sockets and a child process until the 600 s timeout. The likely cause is that something (the fake harness or the hub) still writes into the fake-claude temp folder while teardown removes it, and the thrown cleanup error skips the remaining disposers. C1 should name that ordering; C2's forced failure should cover a cleanup failure, not just an assertion failure.

### impl-935 · 2026-10-20T05:06:10.441Z

Root cause: A-7054 proves ENOTEMPTY during fakeClaude home removal after every revocation assertion completed; first raw after hook skipped later hub teardown. Fixed native Claude/Codex home, UI and handover spoke ownership without changing assertions/waits. A-7055 retains baseline ENOTEMPTY hang (>11.224 s after injection) and final fixed exit 0.021 s after injection; final Darwin arm64 Node24.21 20/20 alone and 10/10 four-T3 loaded rounds (handover-process, verifier-routing-process, tracker-status, request-guard), all exit0. Existing cleanup regression29/29; npm run check and diff check pass. C5 included. origin/dev fetched/merged (up to date), commit4563685bd704e4a0518b6bba8b65ec8500879668 pushed to local origin; Linux5/5 load reserved for E-482 rerun, no per-item QA required. C4 awaits source-clear then mode-free verify. No merge enqueue.

### rev-31 · 2026-10-20T05:09:41.945Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-935-source
commit: 4563685bd704e4a0518b6bba8b65ec8500879668
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. A-7056 records Standards/Spec review and independent A-7054/A-7055 audit. ENOTEMPTY was teardown failure after revocation assertions, not a five-second wait failure. Shared cleanup now disposes resources and hubs before homes and continues after errors. Final fault injection exits naturally in 0.021 s; all 20 solo and ten concurrent four-file Mac rounds pass. C1,C2,C3,C5 verified; C4 awaits exact-head configured mode-free verification. Linux 5/5 under load remains E-482 post-landing evidence.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.
