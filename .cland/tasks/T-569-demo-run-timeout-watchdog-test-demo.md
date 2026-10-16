---
id: T-569
kind: task
title: 'demo run-timeout watchdog test: "demo deadline reached during delivery" under a 2500 ms run timeout on a loaded droplet'
state: open
status: ready
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
updated: 2026-10-16T19:42:53.413Z
---

## Summary
Seen once, on 2026-10-16 in T-488's droplet run 59571add at 72faa365 (A-3651): hub/test/demo.test.ts:69, "demo run timeout destroys the machine through the watchdog even with the hub gone", failed with `demo deadline reached during delivery`. The test sets CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS=2500, and the deadline starts before acquire and delivery, so a slow delivery on a loaded droplet can use up the whole window. It didn't repeat: T-488's next Linux run 463f653f (A-3691) passed it, and the file was 5/5 on both T-488's branch and dev on a quiet Mac (A-3661).

## Acceptance criteria
- [x] C1. The test separates delivery time from the run-timeout window it's checking, for example by starting the timed bound after delivery or by giving delivery its own deadline, so droplet load can't fail it, and the product's deadline semantics are recorded on this item.
  - done: impl-569 · 2026-10-16T17:29:56.448Z
  - verified: rev-30 [reviewer] · run rev-20261016-569-source · 2026-10-16T17:31:38.466Z · commit 8c565a38ffbe73a353ea4bd95986fd6b723facdf
  - verified: rev-30 [reviewer] · run rev-20261016-569-shared-duration · 2026-10-16T18:12:48.228Z · commit 87a4cad65b1f4b16e05d86ea3c0765b2f1907179
  - verified: rev-30 [reviewer] · run rev-20261016-569-dev-merge · 2026-10-16T19:06:22.557Z · commit 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff
  - verified: rev-30 [reviewer] · run rev-20261016-569-final · 2026-10-16T19:42:52.582Z · commit 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff
- [x] C2. demo.test.ts passes 5/5 serially as a whole file on the Mac and once on a droplet in the task's verify.
  - done: impl-569 · 2026-10-16T17:59:54.495Z
  - verified: rev-30 [reviewer] · run rev-20261016-569-final · 2026-10-16T19:42:52.582Z · commit 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff

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

### impl-569 · 2026-10-16T17:59:54.380Z

Droplet receipt 43274e37 / A-4094 at reviewed head 8c565a38: entire demo.test.ts passed, including watchdog run timeout 4.423s and machine lifetime 4.710s. Across the hub package: 1975 tests, 1970 pass, 0 fail, 5 skipped. Verification exit 1 is solely the outside-diff T-603 Claude adapter duration budget (5.082s >5s); reported to lead T-569 and Reviewer, no unrelated changes made. C2's required Mac 5/5 and Linux whole-file pass evidence is now present, but the overall green verification gate remains blocked pending Coordinator direction/shared fix.

### rev-30 · 2026-10-16T18:12:48.228Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-569-shared-duration
commit: 87a4cad65b1f4b16e05d86ea3c0765b2f1907179
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-569 shared-duration delta source clear at 87a4cad65b1f4b16e05d86ea3c0765b2f1907179, direct child of reviewed 8c565a38ffbe73a353ea4bd95986fd6b723facdf. Standards and Spec axes: no findings.

Independently read primary Coordinator cc249229-f019-40fb-be83-e680fa90f2eb in Agents: ad5e2c861fed137db7808f9ff70278e60e9549db is posted on dev, with explicit cherry-pick/typecheck/review/resubmit direction for T-569/T-585 and alongside owned corrections for T-475.

Only hub/test/durations.json changes. Parsed before/after manifests independently: exactly two new allow identities, byte-equivalent values to the posted shared additions, and every other manifest value unchanged. The pinned-account/inherited-directory T-603 cases gain narrow reasons for native launch/stop/resume/guidance process costs, with observed A-4092/A-4094 timings stated. Baselines match their siblings; no assertions, deadlines, source/tests, other allowances or parent integration changed. Direct parent matches the prior head; diff whitespace check passes. No local rerun needed for this authorized manifest-only shared pick. Request reports root typecheck exit 0 at this head.

A-4080's five serial Mac whole-file passes (40/40) and A-4094's whole demo-file Linux assertions remain relevant because their source bytes are unchanged. A-4094 exit 1 was solely the external pinned-profile budget; no green new-head gate is inferred. C1 refreshed; C2/final gate waits for the required new-head droplet receipt.

Proceed with the Coordinator-directed mode-free exact-head droplet verification. No per-item QA criteria.
Review artifact A-4101.

Criteria: C1 verified.

### rev-30 · 2026-10-16T19:06:22.557Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-569-dev-merge
commit: 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-569 dev-merge delta source clear at 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff. Standards and Spec axes: no findings; both reviewed in-session under the role's no-delegation constraint.

Independently read primary Coordinator 100257e6 in topic-402: wait for T-585 merge, then merge origin/dev, typecheck, delta review and fresh droplet verification. Actual parents are reviewed 87a4cad65b1f4b16e05d86ea3c0765b2f1907179 and dev a446efc5244748bd1b2bb8b32bb78a1589049b6f; origin task tip matches requested head. No combined conflict diff or manual resolution. Against incoming dev, exactly two owned files remain (31 insertions/6 deletions): watchdog test correction and its two unchanged duration reason edits. Entire demo.test.ts is byte-unchanged from the prior reviewed head; relevant product watchdog/droplet/demo source and remote fixture are also unchanged across this merge. Prior C1 deadline semantics and exact completion/receipt assertions remain applicable. Incoming T-585 correction and shared T-603 allowances are retained.

Independent whitespace check passes; request reports exact-head root typecheck and shard lint exit 0 with clean pushed tree. No Reviewer test execution. Existing A-4080 five serial Mac files remain applicable to unchanged owned source. C1 refreshed by source only; C2 and final new-head gate remain pending. A-4117's previous sole T-585 red is not converted into a green new-head receipt. Proceed with normal mode-free exact-head droplet verification per Coordinator. No per-item QA criteria.
Review artifact A-4128.

Criteria: C1 verified.

### impl-569 · 2026-10-16T19:42:32.748Z

Final exact-reviewed-head verification is green: 57fe66cf-de15-470d-9579-b5b72157c726 / A-4154 at 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff, exit 0, 2004 tests / 1999 pass / 0 fail / 5 skipped, including Neovim smoke. All eight demo cases passed; run-timeout watchdog 5.839s, machine-lifetime watchdog 6.394s. Mac 5/5 serial whole-file proof A-4080 remains applicable to unchanged owned test source after the Coordinator-directed dev merge. Typecheck and test:shards passed before review. Reviewer requested to settle final C2/verdict; no changes after source-clear. Droplet c-8 Linux lifetime 2029s, cost $0.1409.

### rev-30 · 2026-10-16T19:42:52.582Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-569-final
commit: 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-569 final evidence clear at unchanged reviewed merge head 5e66218b11953c73c8d9a98719bc7cd7f8ffd6ff. Standards and Spec axes: no findings.

Independently audited complete A-4154 / 57fe66cf-de15-470d-9579-b5b72157c726: branch/head match A-4128 source clearance; exit 0. Total 2004 tests, 1999 pass, zero fail, five prerequisite/platform skips. Hub free 40/40, machine 1947 pass/zero fail/five skips, Neovim smoke 12/12. All eight demo.test.ts whole-file cases have positive timing receipts, including run-timeout watchdog 5.839244063 s and machine-lifetime watchdog 6.394362273 s. No hard duration-budget or load-gate failure in the complete log; routine regression notices are non-failing. Four workers, suite wall 1943.21 s, peak load 18.65.

C2 Mac proof rechecked in A-4080: five serial whole-file runs, eight passes each, zero failures/skips (40/40). Previously audited admission records all below 15 with high-load waits respected. Independent git comparison confirms demo.test.ts is byte-unchanged from measured 8c565a38 through current head, so the five Mac files remain applicable despite the authorized shared allowance/dev integration. Both claimant done marks are present in task.view.

C1 source proof remains A-4072/A-4101/A-4128: delivery has a separate setup budget; test asserts original product deadline semantics, delivery/ready state, hub shutdown, accelerated durable expiry, provider absence and watchdog firing/confirmation receipt in separate bounded observations. Product deadline behavior itself is unchanged; the recorded mechanism and commit remain. This green task receipt settles the new-head runtime gate without reclassifying prior T-603/T-585 red receipts as green.

C1/C2 verified at this exact head. No per-item QA criteria or further task run required.
Review artifact A-4157.

Criteria: C1 verified, C2 verified.
