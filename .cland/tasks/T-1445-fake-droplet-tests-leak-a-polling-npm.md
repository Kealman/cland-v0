---
id: T-1445
kind: task
title: Fake-droplet tests leak a polling 'npm test' and node pair whenever a run ends without writing the finish file
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1194
branch: t/T-1445-fake-droplet-tests-leak-a-polling-npm
created: 2026-10-29T16:09:32.114Z
updated: 2026-10-29T17:23:18.455Z
---

## Summary

On 2026-10-29 the Mac had 97 orphaned `npm test` processes (ppid 1, 10–15 days old), each with a `node -e` child that checks every 50 ms for `$HOME/finish`. Their cwd was `…/T/cland-fake-do-*/droplet-*/home/runner/cland`. That's about 194 processes, adding load while swap was nearly full (396 MB free). Coord stopped them with SIGTERM; free swap rose to 1.5 GB. Tests that start that finish-polling child: `executor-safety`, `executor-run`, `suite-candidate`, `suite-close-recovery` and `suite-remote-process`. A run that ends, is cancelled or times out without writing `finish` leaves the pair running forever.

## What to build

Every fake-droplet run's remote command exits or is killed when its test or fixture ends: write `finish`, or kill the process group in the fixture's cleanup, including timeout and abort paths. The poller itself also gives up after a bounded time. Add a census assertion so a leaked pair fails the test.

## Acceptance criteria

- [x] C1. Each listed test file leaves no `npm test` or finish-polling `node` process behind after it passes, fails or is aborted, shown by a process census in the test.
  - done: impl-1445 · 2026-10-29T17:11:54.756Z
- [x] C2. The finish poller exits by itself after a bounded time even if nobody writes `finish`.
  - done: impl-1445 · 2026-10-29T16:24:22.166Z

## Comments

### impl-1445 · 2026-10-29T16:17:00.187Z

Scope/seams: fake provider close + native process census for owned disposable machine roots (C1); test-owned barrier command native exit without finish (C2). Consumer search: fakeDigitalOcean used by remote-fixture, executor fixtures/tests and cloud/test helpers; remote-fixture supplies executor-run/safety, close-run-fixture supplies suite-close-recovery/suite-remote-process. suite-candidate uses local suite-fixture instead. No production/wire/schema/admission contract changes planned; existing fake close signature retained. Will place ownership cleanup at fake provider boundary, with census assertions and bounded barriers.

### impl-1445 · 2026-10-29T16:20:12.359Z

Red receipts (macOS local working tree): close census [82495,82521] remained after old provider close, assertion failed; C2 without deadline got null exit from 2s exec timeout instead of 124. Both owned processes drained in finally. Green executor-safety.test.ts: 8 tests, including shell/host timeout, failed-provider cleanup, cancel/stopped-hub watchdog, new provider close census and independent deadline. New case durations 992ms and 78ms on macOS. npm run typecheck passed. Shared helper fixes canonical stateRoot + close-owned process drainage/census; no production contracts changed. All fake-api callers retain old close signature; scripted close skips OS scans. Consumer inventory: executor-safety, suite-dry-run, executor-admission, executor-droplet, startup-ready-component, suite-unit-fixture, executor-prepare, daemon, droplet-fixture, executor-prepare-component, remote-fixture; their transport behaviour unchanged except guaranteed teardown.

### rev-34 · 2026-10-29T16:52:52.305Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1445-source1
commit: 6c8e363c627d534713737e41f02e63e37be302c1
scope: full
findings: [{"severity":"medium","text":"M1: New suite-candidate and suite-close-recovery guides are absent from the per-test index, so the unchanged test-docs membership guard fails. Add only their Notes rows; claimant reports working-tree red/green, not present at reviewed head.","file":"docs/agents/tests/index.md"},{"severity":"medium","text":"M2: close awaits HTTP connection shutdown but neither fences new direct-provider admission nor joins active async handle work. A beforeCreate continuation can outlive close and resume mkdir/boot work after the process census and root removal. Track and fence admitted operations, drain/cancel them with a separate cleanup bound before census/removal, and cover a held-create late-release/post-close-admission control.","file":"hub/test/fakes/digitalocean/fake-api.ts","line":265},{"severity":"medium","text":"M3: New ending regressions acquire fakeDigitalOcean, create files and spawn before their try/finally; setup failures leave the provider unowned. Sequential finally cleanup also skips later disposal/native join/provider close after an earlier failure, and closed has no independent join bound. Pre-own the acquisition and native work, continue sibling cleanup, and add omitted/aborted setup controls while retaining the positive census and native failure/abort assertions.","file":"hub/test/executor-safety.test.ts"}]
finding_counts: {"high":0,"medium":3,"low":0}

A-13820: consolidated M1–M3 at immutable head. Read-only full Standards/Spec review. Independent barrier deadline source design retained; C2 runtime remains unverified. Claimant working-tree M1 red/green is excluded until replacement committed head. No configured suite yet. Fresh source review required before verification.

Criteria: C1 failed (Provider handler work can resume after close/census/root removal; new cleanup regressions also lack ownership across setup failure.).

### impl-1445 · 2026-10-29T16:54:07.972Z

Review correction inventory (M2): fake provider admission/close is a test-only shared contract. Consumers already inventoried (executor/suite/daemon/startup fixtures); calls during active lifetime unchanged. After close, direct provider and filesystem mutator calls will reject a fixed closed error. Both direct provider transport and HTTP body/handler continuations must be tracked through actual settlement, even when the caller's deadline race ends first; close fences synchronously, drains boundedly and retains root on incomplete drainage. Scripted mode shares the fence/drain but keeps OS scans disabled. M1 index correction is working-tree green.

### rev-34 · 2026-10-29T16:59:58.945Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1445-source2
commit: 889ba2832d01fb0d50bf5850ea43086963cea937
scope: full
findings: [{"severity":"medium","text":"M3 remains at the actual setup-deadline boundary: pollingOwner.close awaits a bounded scope.wait(setup) before its cleanup loop, so expiry permanently rejects memoized closing and skips all process/provider/native disposal even if setup later settles. The held-create controls also register release as a caseDeadlines after hook, but caseDeadlines waits pending entered receipt work before hooks; a missing receipt can prevent release/close indefinitely. Keep disposal as an owned continuation through actual setup settlement, bound observation separately, and prove a genuinely held/missing and aborted admission receipt rather than throwing after completed setup.","file":"hub/test/executor-safety.test.ts","line":177}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13829: M1 index and M2 admission/handler-drainage correction closed by source inspection. Sole remaining M3 is actual setup timeout/omitted-receipt disposal continuation, including new held-create control ownership. Preserve all existing assertions and add actual held/late-settlement controls; fresh source review before verification. Local macOS attribution only; no Reviewer execution or configured Linux claim.

Criteria: C1 failed (Setup observation expiry still skips memoized disposal; missing held-create receipt can block cleanup release.).

### rev-34 · 2026-10-29T17:09:24.383Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261029-1445-source3
commit: fbdc3d05ecd3feb1a96e8d373f7ca056bef3a2ce
scope: full
findings: [{"severity":"medium","text":"M3 remaining: new held native setup/cleanup controls rely on manually advanced FakeClock deadlines. The polling case directly awaits entered.promise before any clock advance; held-create acquisition/serving/disposal waits and polling native close/drain use fake-time caseDeadlines, with no independent elapsed-time failure bound. Missing native receipts or a stuck disposal can therefore hang rather than reach pre-owned cleanup. Keep injected time for deliberate caller-expiry assertions; add separate real elapsed-time setup/native-drain observation with release/cancel ownership, including the entered wait.","file":"hub/test/executor-safety.test.ts","line":329}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13843: M1/M2 remain closed; source2 retained teardown and early cancellation cycle corrected. Sole remaining M3 is independent real elapsed-time bounds for native serving/drain in new controls, including direct entered wait and final disposal. Keep fake time for deterministic caller timeout assertions. No Reviewer execution or Linux runtime verification.

Criteria: C1 failed (New held native setup/disposal controls can wait forever on receipts because their deadlines use manually advanced fake time.).
