---
id: T-1950
kind: task
title: Released executor leases are never removed, so every readLeases() call reads and parses 4,202 lease.json files and the hub idles at 75–105% CPU
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1605
branch: t/T-1950-released-executor-leases-are-never
created: 2026-11-17T20:26:17.945Z
updated: 2026-11-17T23:16:04.884Z
---

## Summary

Hub 58279 (restart #81) sits at 75–105% CPU with an empty queue (sampled 20:24–20:30Z, 2026-11-17, by cland-impl). Load average is 8 and RSS 0.8 GB. `.cland/run/executor/leases` holds 4,202 directories, all `state: released`, the oldest with a 2026-10-14 deadline, and nothing ever removes them. `readLeases` (hub/src/executor/droplet/lease.ts:88) reads and JSON-parses every `lease.json` sequentially on each call, and callers then filter out released ones. The callers are suites.ts:853, 966 and 1057; droplet.ts:81, 88, 104, 515, 540, 589 and 609; and spend.ts:256. droplet.ts:88, 104 and 589 also serialise all 4,202 into the `executor-leases` meta row. CPU profiles show `readLease` as the top project frame at 7–9% self. The four libuv pool threads have about 79 min of system time each against 2.7 min of user time, so the cost is file I/O in the pool. Deliveries still inject within a second; nothing is broken yet.

## What to build

A released lease leaves the hot read path once the spend ledger has recorded it. That means archiving it to a cold directory or deleting it, or keeping an index of non-released leases that `readLeases` reads instead of the whole directory. The `executor-leases` meta row holds only live leases. Existing released leases are moved out once, by the hub itself at startup or through a migration, never by hand, and only after their spend records are confirmed.

## Acceptance criteria

- [ ] C1. With 5,000 released leases and 2 live ones, `readLeases` reads at most the live leases plus a bounded index, and the `executor-leases` meta row lists only live leases (test with a fake leases root, counting files read).
- [ ] C2. A released lease is removed from the hot path only after its spend entry is durable; a lease whose spend entry is missing stays put and is reported (test).
- [ ] C3. The one-off migration of existing released leases is idempotent and safe across a crash part-way through, and every reader (rule 41: suites.ts, droplet.ts, spend.ts, doctor, status) is listed with its disposition (test).

## Comments

### coord · 2026-11-17T21:07:21.475Z

Coordinator, 2026-11-17 21:10Z. (1) Added to E-1883 stage 1 by the human stand-in's decision on ask fd6a70ec (D24): T-1950 lands before the next macOS cover if the current one fails. (2) Restart #82 (pid 57331) did not lower the load: 95–109% CPU again, and a `topic answer` took 3,218 ms against the 250 ms slow-request budget. (3) The restart gap was 87 s. The startup step from "binding listeners" to "binding web listener" took 64 s (21:02:52Z to 21:03:56Z). Find out whether the lease read sits inside that step, and if so measure it before and after the fix. If it doesn't, report it and I'll file a separate item.

### impl-1950 · 2026-11-17T21:12:49.543Z

Consumer inventory (rg on readLeases/readLease/leaseRoot/lease.json/executor-leases across hub/src, hub/test, nvim, web, shared, docs and .agents/skills): production hot readers are suites.ts (budget, restore, retry/accounting), merge-queue.ts (idle), droplet.ts (admission, save/checkpoint meta, inspect, reconcile, sweep), spend.ts hostLeases (cross-project orphan safety), heartbeat.ts (meta), git-maintenance.ts (meta + former raw directory scan, migrated to readLeases). Doctor/status/CLI consume executor.inspect via dispatcher and have no direct file reader; wire reply unchanged. Demos.reconcile remains hot; Demos.#leases status/stop uses bounded latest-per-epic demo index. Direct readLease users suites.ts, droplet.ts, watchdog.ts retain original paths/files. lease.ts serialized writers maintain index-before-file publication. All test-tier consumers found: executor-admission, executor-spend, demo-release, executor-deletion-confirmation, executor-lock-liveness, verification-workers, executor-reap-confirmation, demo-start helper, demo-release-component, executor-watchdog, executor-recovery-collection, suite-accounting, executor-safety-component/case, git-maintenance-recovery, suite-remote-budget, demo, suite-close-component, executor-prepare-component, system-processes, state-inventory, remote-scripted, executor-admission-lock, heartbeat, executor-droplet-component, startup-ready-component, remote-cleanup helper, scenarios/droplet-verify, executor-prepare, daemon, remote-fixture-parent. Historical released-list assertions will use explicit retained-history lookup; live-only guards stay on readLeases. No frozen CLI bytes or wire fields change. docs/hub/running.md describes ownership; no shipped skill example/raw nvim/web reader found.

### impl-1950 · 2026-11-17T21:19:56.087Z

Rule 41 follow-through: raw reader qa/briefs/T-271.md newlease/leasef intentionally locates and reads retained original directories in a disposable QA root; unchanged paths/bytes make it unaffected. host/agent release.json readers are a different host-launch release receipt, unaffected. suite-admission-cost raw readdir asserts no acquisition directories, unaffected (index lives beside leases/). merge-queue.test.ts deliberately corrupts a lease file after startup; its fixture now explicitly puts that damaged lease in the hot index. Current old-list historical consumers migrated to readLeaseHistory: executor-admission, executor-lock-liveness, daemon, demo-start, executor-admission-lock, executor-prepare and component, executor-safety-case and component, remote-cleanup, remote-scripted, scenarios/droplet-verify, startup-ready-component, suite-accounting, suite-close-component, verification-workers. Remaining live-only readers executor-recovery-collection, state-inventory, suite-remote-budget and remote-fixture-parent retain readLeases. No UI wire shape change, and previous wire readers remain compatible.

### impl-1950 · 2026-11-17T23:16:04.884Z

Post-quiet follow-through: Demos.reconcile now reads the bounded latest-per-epic demo index too, so restart still emits the destruction report after released entries leave the hot list. New regression shown red (`restart reports the latest released demo after compaction`, 0 !== 1), then green after migration. Source inventory disposition supersedes earlier note saying Demos.reconcile remains readLeases-only. Full lint found owned sorted-tier-manifest insertion failure; corrected new entry ordering. remote-scripted T2 now 5/5 green after slot release.
