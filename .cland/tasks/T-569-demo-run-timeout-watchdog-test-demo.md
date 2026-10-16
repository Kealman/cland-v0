---
id: T-569
kind: task
title: 'demo run-timeout watchdog test: "demo deadline reached during delivery" under a 2500 ms run timeout on a loaded droplet'
state: open
status: review
size: S
rank: 4442
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
  - v0.1.4
assignee: null
parent: E-482
blocked_by: []
topic: topic-402
branch: t/T-569-demo-run-timeout-watchdog-test-demo
created: 2026-10-16T04:18:06.312Z
updated: 2026-10-16T17:38:24.723Z
---

## Summary
Seen once, on 2026-10-16 in T-488's droplet run 59571add at 72faa365 (A-3651): hub/test/demo.test.ts:69, "demo run timeout destroys the machine through the watchdog even with the hub gone", failed with `demo deadline reached during delivery`. The test sets CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS=2500, and the deadline starts before acquire and delivery, so a slow delivery on a loaded droplet can use up the whole window. It didn't repeat: T-488's next Linux run 463f653f (A-3691) passed it, and the file was 5/5 on both T-488's branch and dev on a quiet Mac (A-3661).

## Acceptance criteria
- [x] C1. The test separates delivery time from the run-timeout window it's checking, for example by starting the timed bound after delivery or by giving delivery its own deadline, so droplet load can't fail it, and the product's deadline semantics are recorded on this item.
  - done: impl-569 · 2026-10-16T17:29:56.448Z
  - verified: rev-30 [reviewer] · run rev-20261016-569-source · 2026-10-16T17:31:38.466Z · commit 8c565a38ffbe73a353ea4bd95986fd6b723facdf
- [ ] C2. demo.test.ts passes 5/5 serially as a whole file on the Mac and once on a droplet in the task's verify.

## Comments

### coord · 2026-10-16T06:22:18.669Z

Second sighting, now the machine-lifetime case: demo.test.ts:71 in T-488's droplet run 16c8d5d6 (A-3771). T-488's paired probe (A-3785) ruled the branch out: five simultaneous branch/dev pairs on the Mac, with the same delivery time on both sides. Mean DropletRun.deliver was 952/954 ms (run timeout) and 876/882 ms (machine lifetime), and acquire-before-delivery was about 300 ms. With CLAND_TEST_EXECUTOR_*_MS=2500, that leaves about 1.2 s of window on a quiet Mac, and a loaded droplet can use it all up. That supports C1's direction: start the timed bound after delivery, or give delivery its own deadline.

### coord · 2026-10-16T16:37:57.471Z

Coordinator, 2026-10-16 16:37Z: shared-defect candidate from the hub. demo.test.ts:71 "demo run timeout destroys the machine through the watchdog even with the hub gone" ('machine command failed or exceeded its time bound') failed in T-476's run 9955455a (A-3851) and T-628's local run b708b845 (A-4021, peak load 26.9). That's two receipts on different runs, so it's the first entry for the quarantine manifest (T-657) once that lands, with this item as owner.

### impl-569 · 2026-10-16T17:29:03.697Z

Product deadline semantics (C1): Demos.start computes the demo run-timeout deadline before acquire; DropletExecutor selects min(run deadline, lease.created + machine lifetime). Acquire, readiness and delivery consume that shared wall-clock budget, and delivery's machine command is bounded by the remaining lease time minus collection margin. This is intentional product behavior, retained by this test-only change. The two watchdog tests now validate the selected deadline with a 60s setup budget and a separate 20s demo.start request deadline, then stop the hub and shorten the durable lease deadline to now + 250ms. Watchdog deletion and its receipt are observed with separate bounded waits. Historical A-3851 / 9955455a, A-4068 / 007fa789 and A-4021 / b708b845 establish the setup-expiry failure; baseline quiet Mac watchdog run passed 2/2.

### rev-30 · 2026-10-16T17:31:38.466Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-569-source
commit: 8c565a38ffbe73a353ea4bd95986fd6b723facdf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-569 source review

Source clear at 8c565a38ffbe73a353ea4bd95986fd6b723facdf, fixed point cb8462c81dbb5daaca59d89b11f4053a8166f48d. Origin task tip matches. Two test/manifest files only; no production change. Standards and Spec axes reviewed in-session under the no-delegation role.

## Standards
No findings. The fixture still owns a real daemon and detached watchdog with fake provider/machine edges. Setup uses a 60 s lease budget and a separately bounded 20 s demo.start request. It requires delivered execution and demo ready, registers the watchdog for cleanup, stops the daemon through the existing owned-process helper, then changes only the durable deadline. Atomic writeLease is the real persistence seam the detached watchdog reads.

Provider disappearance and watchdog receipt have separate bounded waits; original provider DELETE evidence remains asserted. The receipt must fire at/after the new deadline and confirm absence at/after firing, rather than treating provider-list disappearance alone as completed watchdog work. No fixed sleep replaces a lifecycle assertion. The intentional key-delete 403 and archived-droplet behavior remain; retry confirmation can validly produce an empty deleted list, so omission of that intermediate assertion does not remove the original proof. Fixture teardown still stops all writers before directories. Duration allowance seconds/identities remain unchanged; only their reasons describe the revised setup/expiry proof. Read-only diff whitespace check passes.

## Spec
No findings. C1 established by source and the product semantics recorded on the item at 17:29:03. Demos.start creates its run deadline before acquire; DropletExecutor chooses the earlier run deadline or lease.created + lifetime. Acquire/readiness/delivery consume that wall-clock budget, and delivery uses remaining time minus collection margin. These production semantics remain unchanged.

The two test variants still select run timeout versus machine lifetime separately. The run-timeout deadline is bracketed between before-request + setupMs and lease-created + setupMs; the lifetime variant requires exact lease-created + setupMs. Only after successful delivery and hub termination does either case write a new now+250 ms deadline, with an assertion that the machine is live first. The detached watchdog therefore tests post-hub expiry without forcing delivery into a 2.5 s window.

## Evidence and criteria
A-4071 records historical setup-phase failures and the Coordinator's earlier paired branch/dev probe; no new stress or Reviewer reproduction was run. It reports baseline targeted cases 2/2 and honestly retains an intermediate invalid receipt.deleted assertion failure; the final source has no post-fix execution receipt yet. The request reports exact-head typecheck exit 0 and diff check exit 0.

C1 verified. C2 remains pending five serial whole-file demo.test.ts passes on Mac and once on a droplet through normal exact-head task verification. These existing identities need the requested whole-file receipts; baseline 2/2 is not the corrected proof. No per-item QA criteria.

Standards 0 findings; Spec 0 findings.
Review artifact A-4072.

Criteria: C1 verified.

### impl-569 · 2026-10-16T17:38:24.723Z

C2 Mac evidence: A-4080 contains 5/5 serial whole-file `node --test hub/test/demo.test.ts` passes at reviewed/pushed head 8c565a38ffbe73a353ea4bd95986fd6b723facdf (40/40 tests total). Admission load values were 14.76, 14.26, 12.41, 11.78 and 14.48; runs waited rather than starting at >=15. Whole-file durations: 43.42s, 48.52s, 48.91s, 57.65s, 53.91s. Final npm run typecheck and git diff --check passed; worktree clean. Source clear rev-20261016-569-source / A-4072. Exact-head droplet verify 43274e37-8da8-4b15-97f6-1643f5feaee6 is pending; C2 remains incomplete until its Linux receipt.
