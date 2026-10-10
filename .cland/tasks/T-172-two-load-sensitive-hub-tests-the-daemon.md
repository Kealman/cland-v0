---
id: T-172
kind: task
title: "Two load-sensitive hub tests: the daemon stop-log order and the handover audit read race their background writes"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T10:45:43.912Z
updated: 2026-10-10T15:56:11.630Z
---

## Parent

T-19 (follow-ups). Seen in T-155's full suite on 2026-10-10 (hub 961/964). Both pass alone, twice each, on T-155's head 37dbb8c. T-149's earlier run also failed a handover case that then passed.

## What to build

Two hub tests read state that a background task can change or have not written yet. Each should wait on the event it means, not on the order or timing of others.

1. `hub/test/daemon.test.ts:295` asserts that the last three hub.log events are exactly `['stopping', 'socket-kept', 'stopped']`. An `orphan-sweep-completed` event from the startup sweep can land between them. Assert the subsequence and order of the three stop events, ignoring unrelated events, rather than the last three lines.
2. `hub/test/handover.test.ts:135` reads the audit log right after the handover and finds no `role.handover` record yet. The audit write lags the reply. Poll the audit log for the record, with the existing `eventually` helper, before asserting its fields.

## Acceptance criteria

- [ ] Both tests assert the same facts without depending on unrelated events or write timing.
- [ ] Each passes 20 consecutive runs alone and under parallel load (four workers).
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size XS. tech-debt; test-only.

## Comments

### coord · 2026-10-10T10:46:16.055Z

Add a third case: nvim/test/thread.test.ts:637, the append performance budget (2 ms). It missed under full-suite load twice on 2026-10-10: 2.075 ms in T-160's run and 2.17 ms in T-167's run. It passes alone (1.5-1.7 ms). Measure it in a way that load cannot fail (a median of N runs, or a budget relative to a calibration run), or move it out of the default suite into a benchmark, without dropping the check.

### coord · 2026-10-10T11:58:38.028Z

Add a fourth case: hub/test/progress.test.ts:43 expected 'delivered' but saw 'queued' in T-168's full run on 2026-10-10. The file passes 11/11 alone, twice on af1403f and once on dev 53a3187. Wait on the delivery stage event, not on a snapshot taken right after the send.

### coord · 2026-10-10T15:56:11.630Z

Add a fifth case: hub/test/request-guard.test.ts:43 asserts the other client waited under BUDGET_MS*2 behind a 500-request flood. It failed under full-suite load in T-143's run on 2026-10-10 and passes alone (14/14 on dev). Measure relative to an unloaded baseline, or assert ordering, not wall-clock.
