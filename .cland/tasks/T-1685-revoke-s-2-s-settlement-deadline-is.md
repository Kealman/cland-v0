---
id: T-1685
kind: task
title: Revoke's 2 s settlement deadline is shorter than the 5 s stop-and-reap wait it composes; revoke-native times out under load
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1673
topic: topic-1389
branch: t/T-1685-revoke-s-2-s-settlement-deadline-is
created: 2026-11-05T09:15:47.739Z
updated: 2026-11-05T09:46:00.049Z
---

## Summary

The E-1532 stage-5 Linux cover 6c40efc8 at f66710b3 (A-16824, 2 shards, Linux x64) failed `hub/test/host-revoke-native.test.ts` "revoke settles live Claude Codex OpenCode and an already released Claude generation on the fake host" at line 123. The revoke reported `timedOut: true` and `inventoryComplete: false`, naming two OpenCode generations (live `opencode` and `stopped`) as `settlement pending`. The test took 18.5 s; the same case passed in 12.2–16.1 s in A-16786, A-16805, A-16807, A-16811, A-16821 and A-16822.

The likely cause is an interaction. Revoke's pre-cut settlement deadline is `HOST_SETTLEMENT_MS = 2000` (hub/src/host/settle.ts, from T-1666). T-1673 and T-1683 since made a local OpenCode or Codex stop wait up to 5 s for the child-exit receipt. Under load, settling OpenCode generations can now take longer than the 2 s revoke deadline, so a healthy host reports leftovers. The report itself is honest (C2 of T-1666), but a loaded host should not reach it routinely.

## What to build

Make revoke's settlement deadline consistent with the bounded waits it composes:
- the per-generation stop and reap settlement (5 s);
- private-file retirement;
- the inventory pass.

Either derive `HOST_SETTLEMENT_MS` from those bounds with a documented headroom, or settle generations concurrently so the total stays within the deadline. Keep every guarantee:
- the deadline still cuts authority;
- what is left is named;
- no Host call happens after the cut.

## Acceptance criteria

- [ ] C1. Revoke's settlement deadline is at least the longest bounded wait it composes (per-generation stop and reap plus retirement), or the generations settle concurrently within it; the chosen relation is stated in docs/agents/host-agent.md (test).
- [ ] C2. With an OpenCode child-exit receipt held for 3 s (inside the 5 s stop bound), revoke completes with inventoryComplete true and no leftovers. With it held past the stop bound, revoke names that generation as incomplete with timedOut false. Only a generation still held when the overall revoke deadline passes reports timedOut true, with no Host call after the cut (test, fake timers).
- [ ] C3. host-revoke-native passes 20/20 locally under CPU load, including a Linux container run (evidence).

## Comments

### impl-1685 · 2026-11-05T09:34:50.007Z

Rule 20 consumer sweep (rg fields/functions/frames across hub, web, nvim, docs, skills): production host/settle.ts, adapters/sessions.ts, cli/host.ts, hub/dispatch.ts, hub/web-authority.ts, protocol.ts; tests host-revoke, host-revoke-native, host-settlement, host-secret-admission; docs host-agent, host-settlement and host-secret-admission guides; implement skill. CLI derives its frame timeout from the constant; dispatcher, protocol, web-authority and secret-admission only route/authorize unchanged host.revoke frames, unaffected. No web/nvim consumers or persisted settlement readers. Keep legacy renderer regression. Update deadline readers in host-revoke tests and stale two-second prose in host-agent and implement skill. No help syntax changes.

### impl-1685 · 2026-11-05T09:46:00.049Z

Consumer sweep correction: native host-revoke line121 explicitly sized its UI frame wait at5000 for the old2s cap. Five loaded assertions passed then sixth failed `no result for host.revoke within 5000ms` (test29.116s), without settlement result. Coordinator authorized migrating only timeout/import and preserving all assertions: frame HOST_SETTLEMENT_MS+3000; whole test named45s setup/teardown plus frame=60s. Repeat preservation and20+20 samples at this source; allowance update authorized after sampling. Original failed attempt retained as diagnostic, not C3 pass evidence.
