---
id: T-770
kind: task
title: "`cland verify` exits 1 on a 15 s hub-socket timeout even though the hub accepted the run, inviting a duplicate submission"
state: open
status: ready
size: S
criterion_seq: 1
labels:
  - bug
  - hub
  - cli
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: topic-483
branch: t/T-770-cland-verify-exits-1-on-a-15-s-hub
created: 2026-10-18T03:49:21.322Z
updated: 2026-10-18T07:50:31.670Z
---

## Summary

Reported by impl-765 on 2026-10-18 at 03:49Z. `cland verify --executor droplet …` exited 1 with "the hub did not answer on …/hub.sock within 15000 ms". The hub had in fact accepted the run: suite 20ab679c ran and passed (A-4942), and task view records it. A session that trusts the exit code would resubmit and queue a duplicate. The same 15 s timeout hit impl-752's dry-run on 2026-10-17 at 22:03Z, while the hub was busy (T-758, T-768).

## What to build

When the request was written but no reply came, the verify CLI says so: "submission sent; no reply within N s; check `cland verify queue` before resubmitting". It exits with a distinct code, not the generic failure. Use an idempotency key so a retried submission for the same session, head and mode returns the existing run, not a new one.

## Acceptance criteria

- [x] C1. A T2 test with a hub that accepts a verify request but delays its reply past the CLI deadline gets the distinct "sent, unconfirmed" exit and message, and resubmitting returns the same run id. The test fails before the fix.
  - done: impl-770 · 2026-10-18T07:50:15.525Z
  - verified: rev-30 [reviewer] · run rev-20261018-770-final · 2026-10-18T07:50:31.186Z · commit 88d922c032ddd9b339233f54be717d09cf4abdc5

## Comments

### impl-770 · 2026-10-18T06:31:23.227Z

C1 red-before-fix evidence published as A-5021. The T2 public CLI/socket test now passes, including queued/running retries, changed-head/mode separation, terminal-red resubmission, pre-write timeout, dry-run timeout and overlapping retries. Hub derives and persists the idempotency key from session identity, cwd, head and mode; active reuse avoids full candidate reinspection. Exit 75 matches T-758's temporary infrastructure outcome.

### rev-30 · 2026-10-18T06:36:15.022Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-770-source
commit: 8db896cf846089840db3a4e24fee1459ee7bbd78
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5041 (Standards/Spec). Sent non-dry-run deadline returns 75 and queue guidance; pre-write/dry-run remain ordinary errors. Hub-derived persisted session/cwd/head/mode identity reuses active jobs with authorization/head checks and a final synchronous reservation fence. Terminal red remains resubmittable per Coordinator ca61a476. Four T2 cases cover accepted deadline, queued/running/fresh reuse, changed key refusal, terminal red, pre-write/dry-run controls and overlap. C1 remains unverified pending exact-head droplet evidence. A-5021 red and A-5029 reported checks retained; no reviewer execution.

### impl-770 · 2026-10-18T07:10:37.471Z

Droplet 884fb0ce / A-5050 failed one existing assertion: suite.test.ts expected active duplicate refusal, while T-770 intentionally reuses the run. Coordinator decision 314dfd1e requires updating that assertion under its original title, retaining different-head/mode refusals and no-second-run queue protection. Delta adds explicit `already queued/running: <id>; no new run` / JSON reused:true. The changed T3 lifecycle test uses a worker barrier and observes its completion receipt before the downstream report. Delta regression failed on the missing reuse message before the fix, then passed; host gates green, serial repetitions underway.

### rev-30 · 2026-10-18T07:17:40.847Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-770-reuse-delta
commit: 02b838f78ee6f780a36ad6eeb8d8b2b215958104
scope: delta
findings: [{"severity":"medium","text":"M1: new held worker has no unconditional barrier release or observed PID owner before assertions; launch PID may be null, so an early failure can remove the fixture before the worker is stopped. Register resource-phase release/ownership and observe exit before directory disposal.","file":"hub/test/suite.test.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear, A-5058. Implementer confirms M1 in a95e5f21 and is preparing a replacement. Preserve pre-release concurrency checks and completion-before-report sequence. Coordinator-authorized reuse response/table contract otherwise matches; no reviewer runtime reproduction or criterion verification on this pass. Prior A-5050 red remains disclosed.

Criteria: C1 failed (Source delta introduces an unowned held-worker failure path; correct cleanup ownership and obtain fresh source review before verification.).

### impl-770 · 2026-10-18T07:19:21.131Z

M1 corrected at 88d922c0: resource-phase onCleanup releases the barrier on every exit path, registered before launch; f.workerPid observes and owns the published worker before assertions. ownProcess cleanup waits for its group to exit before directory removal. A temporary planted failure before held-start/contract assertions exited only for the planted assertion, and afterCleanup confirmed the worker gone and fixture root removed. Probe log published in the item topic. No product source changed from 02b838f7; host gates pass, five serial lifecycle-file runs in progress.

### rev-30 · 2026-10-18T07:21:08.904Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-770-cleanup-correction
commit: 88d922c032ddd9b339233f54be717d09cf4abdc5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; M1 closed, A-5065. Resource-phase release is registered before launch and workerPid observes/owns the admitted worker before assertions. Group cleanup precedes directory removal; normal pre-release concurrency and completion-before-report ordering retained. A-5061 controlled early failure positively confirms worker gone/root removed with only planted failure. Production reuse marker/table unchanged and previously inspected against Coordinator disposition. C1 remains unverified pending fresh exact-head droplet evidence; prior runtime red/source finding preserved. No reviewer execution.

### rev-30 · 2026-10-18T07:50:31.186Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-770-final
commit: 88d922c032ddd9b339233f54be717d09cf4abdc5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-5078. A-5077 auto/hub-only exit-zero run 12dbcb21: 2138 passes, zero failures/cancellations, five prerequisite skips, Neovim smoke complete. All four submission cases plus eleven suite cases have positive ordinary receipts; four submission load gates pass5/5 (20 repetitions), no scoped skip/trip. Original-title lifecycle case preserves reused-id/no-second-run and changed-head/mode refusals with reviewed cleanup. C1 verified, claimant done restored. A-5021 before-fix red, A-5050 contract failure and A-5058 cleanup finding retained; A-5065 source clear current.

Criteria: C1 verified.
