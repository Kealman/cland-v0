---
id: T-1101
kind: task
title: demo.test.ts's remote recorder case times out on demo.start under macOS T3 load
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-848
branch: t/T-1101-demo-test-ts-s-remote-recorder-case
created: 2026-10-22T09:03:34.023Z
updated: 2026-10-22T13:17:12.119Z
---

## Summary

The shared stage cover's macOS run 3dcaf593 (A-9068, dev ff6edeaa, local darwin arm64, 2 workers, T3 peak 1m load 7.25) failed `hub/test/demo.test.ts` "the demo recorder runs a headless case remotely and retains captures and executor accounting locally" with `Error: no result for demo.start within 5000ms` (hub/test/harness.ts:631). The same test passed 5/5 alone at the same commit (coord, 2026-10-22 09:05Z), and the Linux cover 4b8ac01b at that commit was green. Its 5 s frame-result wait is within load noise on a busy macOS run.

## Acceptance criteria

- [ ] C1. The test waits for demo.start's durable receipt with a bound that holds under the T3 load of a full macOS run, or splits the fake executor's provisioning time from the asserted behaviour, keeping its final assertions (rule 9) (test).
- [ ] C2. The test passes 20/20 under `--test-concurrency 4` with a parallel CPU load on macOS, in a disposable root under rule 15 (test).

## Comments

### coord · 2026-10-22T12:11:40.868Z

Second test, same cause: the macOS stage cover b2ce36f1 (A-9148, dev b99de2c7, local darwin arm64, T3 peak load 7.62) failed `hub/test/demo-release.test.ts` "demo stop waits for an archived droplet with stripped tags to become absent" with the same `Error: no result for demo.start within 5000ms` (hub/test/harness.ts:631). Both demo tests wait 5 s for the harness's demo.start reply under macOS T3 load. This item's fix should cover every demo.start wait in hub/test (demo.test.ts, demo-release.test.ts and any other caller of that harness request), not one file.

### impl-1101 · 2026-10-22T13:17:12.119Z

Implementation prepared: all 17 successful demo.start calls across demo.test.ts, demo-release.test.ts, demo-release-component.test.ts and demo-cap.test.ts use a helper that arms a new matching lease observer before sending, requires active/delivered/ready persistence, then separately bounds the correlated result. All existing final assertions remain. Five refusal-only calls retain the direct request seam. `node hub/bin/typecheck.ts -p hub/tsconfig.json` and `git diff --check` passed on the current uncommitted tree (local darwin arm64; static checks only, no suite/gate receipt). Test/load runs await cover-quiet lift and Coordinator's reserved load window per the 13:16Z decision.
