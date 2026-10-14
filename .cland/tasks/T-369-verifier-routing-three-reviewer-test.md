---
id: T-369
kind: task
title: verifier-routing three-Reviewer test times out on a c-8 Linux droplet (5 s channel wait)
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - qa-found
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-235
branch: t/T-369-verifier-routing-three-reviewer-test
created: 2026-10-14T01:33:54.938Z
updated: 2026-10-14T06:09:30.482Z
closed: 2026-10-14T06:09:30.482Z
---

## Summary

`hub/test/verifier-routing.test.ts` "three live Reviewers receive one request, and a repeat returns to the same reviewer" timed out at line 139 on a c-8 Linux droplet, waiting 5 s for rev-2's request. The test's 5 s channel wait is load-sensitive on the droplet's slower vCPUs, and remote Linux runs will make it a merge blocker.

## Evidence

- T-345's C9 real run 99128e8e at f7e69665 on 2026-10-14, c-8 lon1 (Linux x64 6.8.0, Node v24.21.0): the hub machine shard reported 1533 pass, 1 fail and 4 skips. The only failure was `verifier-routing.test.ts:139`, a timeout waiting for rev-2's request (5 s channel wait). The run's evidence is on T-345.
- The test passes on the Mac in every integrated run, the latest being 5ba76a49 at 86c1af8, which passed 1900/1900.

## What to do

Find whether the request is late or lost: run the test alone on a droplet, or under a load generator locally. If it is late, make the wait readiness-based or scale it, the same class as the T-340 sweep. If it is lost, that is a routing bug, so file it with the evidence. This is a shared test fix: one commit, cherry-picked into the branches.

## Second occurrence (2026-10-14, macOS)

T-347's full run 355e5bec at 2bea4c2e (A-2229), local darwin arm64 under suite load, failed 1/1617 in the same test family: verifier-routing.test.ts:199, the 5 s channel-event wait after rev-2's hold was released. Its log saw only the role event. T-347 does not change the file. So this is not Linux-only, and it now blocks merges as a dev defect.

## Acceptance criteria

- [x] C1. The cause is established and written down, late delivery (timing) or a lost or misrouted request (routing bug), with a targeted reproduction under load on dev.
  - done: impl-369 · 2026-10-14T04:23:33.324Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-369-1 · 2026-10-14T04:24:56.742Z · commit 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
  - verified: rev-23 [reviewer] · run rev-2026-10-14-369-2 · 2026-10-14T06:09:14.627Z · commit 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
- [x] C2. If it is timing, the waits become readiness-based or scaled as in the T-340 sweep; if it is routing, the hub is fixed. Either way the routing and exact-once assertions are kept.
  - done: impl-369 · 2026-10-14T04:23:34.878Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-369-1 · 2026-10-14T04:24:56.742Z · commit 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
  - verified: rev-23 [reviewer] · run rev-2026-10-14-369-2 · 2026-10-14T06:09:14.627Z · commit 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
- [x] C3. The fix is one commit, so it can be cherry-picked into every live branch under the shared-fix rule.
  - done: impl-369 · 2026-10-14T04:23:39.206Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-369-1 · 2026-10-14T04:24:56.742Z · commit 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
  - verified: rev-23 [reviewer] · run rev-2026-10-14-369-2 · 2026-10-14T06:09:14.627Z · commit 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
- [x] C4. The verifier-routing file passes 20 consecutive targeted runs under a parallel load generator on macOS.
  - done: impl-369 · 2026-10-14T04:37:18.685Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-369-2 · 2026-10-14T06:09:14.627Z · commit 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0

## Comments

### impl-369 · 2026-10-14T04:22:32.657Z

C1 diagnosis established at dev 39ff0f4c: five standalone runs on dev and five at T-347 head 2bea4c2e all pass (A-2232); pristine dev reproduces the original rev-2 5s timeout on run 4/5 with four parallel CPU workers. Scratch-only 1s delay of rev-2 native MCP hello reproduces it 3/3. Hub assignment and ack occur within 2ms, native fake log shows injection the next ms; observer remains connected but saw only its role clause. Native spoke connected after the scripted observer, and the hub correctly delivers to the newest same-session spoke. This is a test startup readiness race. Fix waits for each initial completed-turn session.usage frame before attaching the observer, preserving every routing/exact-once assertion and existing event deadline. Diagnostic artifacts are in topic-235.

### rev-23 · 2026-10-14T04:24:56.742Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-369-1
commit: 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
scope: full

No high/medium findings. Native fake MCP connects before first completed-turn usage; subscribing and waiting for that frame before attaching each observer establishes the newest-spoke delivery ordering. Buffered UI frames prevent missed startup events. Four-line single-commit fix preserves all routing/affinity/history/exact-once assertions and 5s waits, with no production seam. A-2232/A-2234 establish the startup observer race under pristine-dev load/delayed hello. C1–C3 verified; C4 twenty complete-file load runs and ordinary exact-head full verification remain pending. A-2236: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2236-t-369-complete-source-review-native-readiness-before-observer.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-369 · 2026-10-14T04:37:31.054Z

C4 complete at reviewed/pushed head 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0: 20 consecutive `node --test hub/test/verifier-routing.test.ts` complete-file invocations under four continuous parallel Node CPU workers on macOS arm64 / Node v24.21.0, one invocation at a time. Every run passed 7/7; total 140 passes, 0 failures, 810.574s test wall time. No filters, retries, deadlines overridden or source mutations. Workers terminated; diagnostic scratch worktrees removed and committed worktree clean. A-2239 contains all 20 durations and A-2240 contains all logs, both in topic-235. Source review clear is rev-2026-10-14-369-1 (A-2236). Enqueueing ordinary same-head full verify next.

### impl-369 · 2026-10-14T06:08:52.335Z

Same-head full verification passed: 2a11cc0a-5232-456b-be6e-37ffd1da4c17 at 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0, local macOS arm64 / Node v24.21.0 / Neovim v0.12.5. Typecheck and full suites green, 1966 passed, 0 failed/cancelled/skipped. A-2254 is the durable full log in topic-235; the three-live-Reviewers case passed in 9.772s. Current task worktree is clean and still at the exact source-reviewed head. C4's twenty complete-file load runs are in A-2239/A-2240. Awaiting final same-head reviewer verdict and Coordinator merge; claim retained.

### rev-23 · 2026-10-14T06:09:14.628Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-369-2
commit: 73ab7e402bdfe1d94bc3970ab7dcbe7c12fb22a0
scope: evidence

No findings remain. A-2239/A-2240 verify C4's twenty consecutive complete-file macOS/four-worker load runs: 140/140, no filters/retries/deadline overrides/skips. Exact-head ordinary full 2a11cc0a/A-2254 passes typecheck and 1966/1966 (37 free, 1572 hub machine, 357 Neovim), zero failures/cancellations/skips/todo. C1–C3 complete source A-2236 retained; C1–C4 all checked. A-2255: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2255-t-369-final-review-clear-twenty-load-runs-and-full-suite.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-14T06:09:30.482Z

Merged e5bd6b89f058a5e3384087975cf1ddcf356e33c3 onto dev.
