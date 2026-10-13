---
id: E-230
kind: epic
title: "Verification service"
state: closed
criterion_seq: 6
labels:
  - epic
  - v0.1.1
assignee: null
parent: R-227
blocked_by: []
topic: topic-165
branch: null
created: 2026-10-11T17:48:08.530Z
updated: 2026-10-12T01:47:39.495Z
closed: 2026-10-12T01:47:39.738Z
---

## Goal

Verification becomes a hub-owned service: `cland verify` admits suite runs by load budget and priority from one queue the hub owns, reuses a green result for an identical tree, and shows who waits, who runs and how long.

## Contents

From the T-218 research (A-1142, v0.1.1 row) and decision D21: V1 `cland verify`, a hub-owned scheduler replacing /tmp/cland-suite.lock as the source of truth, with a compatibility shim for hand runs; V2 a result cache keyed by the candidate tree, accepted by the merge gate at the same tree; V3 queue metrics and a queue view with ETA. Plus T-212 (suite cancel), T-213 (two load-sensitive tests), T-215 (shard by resource) and T-220 (Node 24 compile-cache guard).

Constraints: T-209's head-bound verification stays intact; T-207's phase place, T-214's phase selection and T-203's single posted result carry over; while V1 is in flight, every other item keeps using today's lock.

## Definition of done

QA runs the demo below on `dev` in a scratch project and records a clear verdict on this epic with each checkbox verified by its id.

- [ ] C1. `cland verify` queues runs in the hub, admits them by load budget and priority, survives a hub restart, and a hand run of `npm test` goes through the compatibility shim.
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T01:47:21.141Z · commit 88ce02b18616f0b719789ffd11d1175f855417ac
- [ ] C2. A green result for a candidate tree is reused for the same tree and accepted by the gate; any tree change runs again; T-209's head binding holds.
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T01:47:21.141Z · commit 88ce02b18616f0b719789ffd11d1175f855417ac
- [ ] C3. The queue view and metrics show holder, waiters, wait and run times and an ETA, from the CLI and the workbench.
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T01:47:21.141Z · commit 88ce02b18616f0b719789ffd11d1175f855417ac
- [ ] C4. A session cancels its own queued or running suite and the cancellation is posted (T-212).
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T01:47:21.141Z · commit 88ce02b18616f0b719789ffd11d1175f855417ac
- [ ] C5. The hub suite is sharded by resource, the two load-sensitive tests are fixed, and the compile cache is enabled only where safe (T-215, T-213, T-220).
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T01:47:21.141Z · commit 88ce02b18616f0b719789ffd11d1175f855417ac
- [ ] C6. hub/README.md, the merge and qa skills and the Implementer clause describe `cland verify`.
  - verified: qa-22 [qa] · run qa-2026-10-12-22 · 2026-10-12T01:47:21.141Z · commit 88ce02b18616f0b719789ffd11d1175f855417ac

## Plan

```yaml
stages:
  - name: small fixes and the scheduler
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-212
      - - T-220
      - - T-232
  - name: cache, metrics and shards
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-233
        - T-234
      - - T-213
      - - T-215
      - - T-250
      - - T-251
```

## Comments

### qa-22 · 2026-10-12T01:47:21.141Z

verdict: qa
result: clear
by: qa-22 [qa]
run: qa-2026-10-12-22
commit: 88ce02b18616f0b719789ffd11d1175f855417ac

| Check | Surface | Result | Evidence |
| --- | --- | --- | --- |
| M0 | hub-api | PASS | M0.log |
| M1 | hub-api | PASS | M1.log |
| M2 | hub-api | PASS | M2.log |
| M3 | hub-api | PASS | M3.log |
| M4 | hub-api | PASS | M4.log |
| M5 | hub-api | PASS | M5.log |
| M6 | hub-api | PASS | M6.log |
| M7 | hub-api | PASS | M7.log |
| M8 | hub-api | PASS | M8.log |
| M9 | hub-api | PASS | M9.log |
| M10 | hub-api | PASS | M10.log |
| M11 | headless-grid | PASS | M11.log |
| M12 | hub-api | PASS | M12.log |
| M13 | hub-api | PASS | M13.log |
| M14 | hub-api | PASS | M14.log |
| M15 | hub-api | PASS | M15.log |
| M16 | hub-api | PASS | M16.log |
| M17 | hub-api | PASS | M17.log |
| M18 | hub-api | PASS | M18.log |
| M19 | hub-api | PASS | M19.log |
| M20 | hub-api | PASS | M20.log |
| M21 | hub-api | PASS | M21.log |

No high, medium, or low product findings.

Build: 88ce02b18616f0b719789ffd11d1175f855417ac (dev; unchanged through final check).
Run: qa-2026-10-12-22. Node v24.21.0.

Criteria verified: C1 (M2–M6), C2 (M2/M7/M8/M9), C3 (M2/M5/M10/M11/M12), C4 (M2/M13), C5 (M14–M18), C6 (M19). M0/M1/M20/M21 safety and prerequisite gates pass. M2 maps only its corresponding test names to C1–C4.

142 targeted tests pass, zero failures/cancellations/skips: suite 46; exact-head merge 2; tracker-ready 2; freshness 6; workbench queue 1; suite-runner 41+3; suite-selection 38; codex/crew/thread 1 each. Every test file ran separately with inherited CLAND variables stripped. No root full suite was submitted or run. The three lint-negative runner cases used CLAND_TEST_SKIP_LOCK=1 as required.

M7 follows Coordinator ruling 09f31762-bc11-47b9-b8b6-2a14079cc652, confirmed 4e6ab262-fee8-4320-ac63-82ec44fb42b7: M6 cancellation supersedes earlier green evidence. The original M7a observation remains in M7.log. The resulting successful cbca2897 run was reused at tracker-only head 408331d with pid null, same tree c686b3e and original head 3c97b81. M7-cache.log preserves the provenance header. Source changes and --fresh executed; the subsequent request reused the new green run. No original check was rerun or overwritten.

M13 follows Coordinator ruling e5137a83-77dd-4555-b8c0-1725350e82c3: repeating an explicit cancellation is harmless, retains exactly one cancelled result (exit 143), and a successful finished run cannot be newly cancelled. Both checks pass. The brief's original expectation mismatch remains captured. Cross-session cancellation was refused; own queued/running cancellation and human cancellation passed. No refusal was bypassed.

M15 reflects T-251's intended expanded error: every unclassified test is named with the suggested machine manifest line. M19 confirms T-251 also corrected the shipped QA clause; the old low-priority clause finding named by the brief is no longer present.

The live workbench used one headless Neovim. Its sessions panel was already visible; Escape was sent and no toggle hid it. Idle/hand/hi/idle views and live state were captured, with changes observed within three seconds. JSON comparisons normalize Lua's omitted null fields. History recipient lists were returned as comma-separated strings; these were read/checked in that shape. QA-driver assertion assumptions were corrected while continuing the existing cases; no product code changed.

M17 reads A-1436 and A-1437: 20 successful repetitions per codex/crew/thread case both alone and at four-worker load. M18 confirms warm shared compilation fails on Node 24.21.0 and disabled compilation passes 9/9; automatic activation remains absent.

Scratch-only locks were guarded before hub start; all scratch job/log/journal scans have no /tmp/cland-suite reference. Machine lock change during this run belongs to external crew T-137 (pid 28200, runner 30356), not scratch work. All scratch processes stopped, and scratch directories removed after evidence copying. The root source stayed clean apart from live .cland tracker changes.

Evidence includes case logs, exact test output, raw scratch suite jobs/logs/artifacts, hub log/journal, timing rows, four screen/state captures, runner scripts, and the 22 recorded runs.jsonl rows.

Evidence table paths are relative to A-1488: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1488-t-230-epic-qa-at-88ce02b-all-22-checks-clear.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
