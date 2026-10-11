---
id: T-220
kind: task
title: "Node's compile cache breaks warm hub loads on Node 24: re-enable it only on a safe runtime"
state: closed
status: done
criterion_seq: 3
labels:
  - ready-for-agent
  - tech-debt
  - low
assignee: impl-220
parent: T-230
blocked_by: []
topic: topic-142
branch: t/T-220-node-s-compile-cache-breaks-warm-hub
created: 2026-10-11T09:22:48.031Z
updated: 2026-10-11T18:11:37.347Z
---

## What happened

T-174 turned on Node's module compile cache (`NODE_COMPILE_CACHE`, shared by all processes in a suite run) to speed up hub starts in tests. On the supported Node 24.21.0, a cold load of `core.ts` / `new HubCore()` passes. Later warm loads from the same cache crash with SIGSEGV or throw private-brand TypeErrors ("Receiver must be class #roles/#topicStatuses/#items"). No daemon, fixture or duplicate module graph is needed to reproduce it.

Node 25.6.1 passes all three loads, but it is outside the repo's engine range. In the T-174 run at 3716cd7, 682 of 980 hub tests failed this way (A-1151, A-1152). impl-174 isolated the cause and removed automatic cache activation from T-174 (topic-119, 2026-10-11). Its minimal reproduction artifact is in topic-119.

## What to build

Get the compile-cache speedup back without the crash. The likely fix is to enable it only on a Node version shown to be safe, or to use a per-process cache directory if that avoids the fault. Decide whether to report the bug upstream to Node.

## Acceptance criteria

- [x] C1. The minimal reproduction from topic-119 is checked in as a test, or recorded as a documented manual check, against the engine range.
  - done: impl-220 · 2026-10-11T17:57:04.000Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-220-1 · 2026-10-11T17:59:22.358Z · commit 1e2600083b8d32d3fba97945a5c560e5d518af9f
- [x] C2. The cache is enabled only where the reproduction passes. Otherwise this item closes as wontfix, with the measurement of what the cache would have saved.
  - done: impl-220 · 2026-10-11T17:57:04.285Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-220-1 · 2026-10-11T17:59:22.359Z · commit 1e2600083b8d32d3fba97945a5c560e5d518af9f
- [x] C3. A full `cland suite all` passes on the supported Node with the change.
  - done: impl-220 · 2026-10-11T18:11:00.182Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-220-1 · 2026-10-11T18:11:08.764Z · commit 1e2600083b8d32d3fba97945a5c560e5d518af9f

## Comments

### impl-220 · 2026-10-11T17:50:21.862Z

Claimed on task worktree from dev 22c80d6. Preserving A-1154 reproduction; comparing shared warm, cache-disabled and isolated cache loads on the supported Node 24 engine range, and checking upstream Node/V8 reports before choosing activation.

### impl-220 · 2026-10-11T17:57:04.422Z

Implemented and pushed 1e26000 on t/T-220-node-s-compile-cache-breaks-warm-hub after fetching/merging origin/dev (already current). Checked in hub/test/compile-cache-check.ts, the 12-version released engine-range matrix and standalone dependency-free JS reproduction in docs/node-compile-cache.md, and README guidance to rerun for new Node 24.x or Node 25 support. All supported versions fail shared warm loads; isolated caches pass but cost 10.7–22.8 ms extra per load. Coordinator approved C2's wontfix/no-activation fallback; no upstream report filed. Independent typecheck and diff check pass. Raw observations: A-1323 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1323-t-220-raw-runtime-checks-and-startup-measurements.jsonl. C3 awaits my final full suite.

### rev-18 · 2026-10-11T17:59:22.359Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-220-1
commit: 1e2600083b8d32d3fba97945a5c560e5d518af9f

No high or medium findings in Standards or Spec. C1: hub/test/compile-cache-check.ts:15 preserves A-1154's original import/HubCore-construction boundary; all 12 supported runtime matrix rows independently match A-1323. C2: docs/node-compile-cache.md:3 implements the Coordinator-approved no-activation fallback; supported isolated-cache medians and import-only saving calculations reproduce the raw evidence, with appropriate caveats and future rerun guidance.

C3 remains unverified: awaiting an artifact-backed full cland suite all pass on supported Node at this exact head. This is a C1/C2 review clearance, not final item readiness.

A-1327: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1327-t-220-review-at-1e26000-c1-c2-clear-c3-pending.md records the separate Standards/Spec review and evidence.

Criteria: C1 verified, C2 verified.

### impl-220 · 2026-10-11T18:11:00.353Z

C3 complete: own cland suite all run 21cd5edf-61b8-4dad-ae35-5aa6fe306062 at pushed 1e2600083b8d32d3fba97945a5c560e5d518af9f exited 0, with typecheck and all 1527 tests passing; zero failures, cancellations, skips or todo. Full result/log A-1331: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1331-suite-21cd5edf-61b8-4dad-ae35-5aa6fe306062-all-at-1e26000.log. Head unchanged from the C1/C2 clear review; awaiting final C3 review verification.

### coord · 2026-10-11T18:11:37.347Z

Merged 8a8933b01591e18262406503e6cf77338c71b9bc onto dev.
