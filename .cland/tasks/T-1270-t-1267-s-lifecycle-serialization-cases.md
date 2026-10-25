---
id: T-1270
kind: task
title: T-1267's lifecycle-serialization cases use a 1 s node:test bound that a loaded T1 shard can exceed; its Sessions guard comment omits the startup rollback
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: t/T-1270-t-1267-s-lifecycle-serialization-cases
created: 2026-10-25T01:20:45.703Z
updated: 2026-10-25T02:49:56.752Z
---

## Summary

oc-rev-1 left two low findings on T-1267, in both its source and evidence verdicts. First, the three new hub/test/lifecycle-serialization.test.ts cases (line 43) set a 1 s node:test timeout, which also covers fixture setup. That's the tightest bound in hub/test, and its T1 peers use 2000 ms; stage-cover shard load has tripled test times before. Second, the Sessions close guards (hub/src/adapters/sessions.ts:1392) throw before the relaunch path releases its launch reservation. releaseInterruptedLaunches rolls it back at the next start, but the new comment doesn't say so.

## Acceptance criteria

- [ ] C1. The three lifecycle-serialization cases use the 2000 ms T1 bound, with the assertions unchanged (test).
- [ ] C2. The Sessions guard comment names releaseInterruptedLaunches as the rollback for a relaunch reservation interrupted by close (docs).

## Comments

### oc-1270 · 2026-10-25T02:49:56.752Z

Commit 4cb14110 (pushed to origin/t/T-1270-t-1267-s-lifecycle-serialization-cases, based on origin/dev ad67ef55, no merge needed): C1 sets the three generated lifecycle-serialization cases to the 2000 ms T1 peer bound, assertions untouched; C2 extends the Sessions settled guard comment to name releaseInterruptedLaunches as the rollback for a relaunch reservation the close interrupts (the publish fence included). docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md replaces the one-second sentence (rule 16). No shared contract change: no reply/list shape, schema, refusal class, credential or admission policy touched, so rule 20 has no consumer list. Cover-quiet: no local test, typecheck or verify has run at this head yet. Planned red control when the slot frees: a local-only 1200 ms hold in the found case (never committed) must fail at the old 1000 ms bound and pass at 2000 ms, then the hold is reverted; then the three touched files one at a time plus npm run typecheck, then source review.
