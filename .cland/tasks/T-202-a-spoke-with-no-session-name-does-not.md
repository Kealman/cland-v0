---
id: T-202
kind: task
title: A spoke with no session name does not connect, instead of retrying into a
  refusal
state: closed
status: done
criterion_seq: 3
labels:
  - low
  - ready-for-agent
assignee: impl-202
parent: E-229
blocked_by: []
topic: topic-148
branch: t/T-202-a-spoke-with-no-session-name-does-not
created: 2026-10-10T17:49:31.970Z
updated: 2026-10-11T20:51:18.849Z
closed: 2026-10-11T20:51:19.122Z
---

## What to build

A `session-1` with no role connects to the hub about every 15–17 minutes and is refused each time (hub.log refused-role at 16:51, 17:09, 17:26, 17:40Z on 2026-10-10, a new anon id each time). The likely source is Claude Code's background spare pool: spare `claude` processes load the cland plugin before any cland launch binds them, so their spoke has no CLAND_SESSION_NAME. Not proven.

A spoke started without CLAND_SESSION_NAME and without a `cland role` mapping for its name skips connecting. It writes one journal line saying why, and does not retry into a refusal.

## Acceptance criteria

- [x] C1. A spoke with neither a session name nor a role mapping makes no hub connection and writes one journal line.
  - done: impl-202 · 2026-10-11T18:44:57.038Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-202-2 · 2026-10-11T18:51:56.351Z · commit 7b005601238ebf59a59fd452f306aca57655bb62
  - verified: rev-18 [reviewer] · run rev-18-20261011-202-3 · 2026-10-11T19:37:35.452Z · commit a35c6fc6eddac87b30e1e9657809d6037b7a9518
- [x] C2. A spoke with a role mapping, or launched by the hub, connects as today.
  - done: impl-202 · 2026-10-11T18:50:39.533Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-202-2 · 2026-10-11T18:51:56.351Z · commit 7b005601238ebf59a59fd452f306aca57655bb62
  - verified: rev-18 [reviewer] · run rev-18-20261011-202-3 · 2026-10-11T19:37:35.452Z · commit a35c6fc6eddac87b30e1e9657809d6037b7a9518
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-202 · 2026-10-11T20:50:52.022Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-202-3 · 2026-10-11T20:51:05.990Z · commit a35c6fc6eddac87b30e1e9657809d6037b7a9518

## Notes

Size XS. Low priority, not for v0.1 (stand-in, 2026-10-10); the human may promote it.

## Comments

### impl-202 · 2026-10-11T18:41:53.230Z

Claimed at dev fdb8c5c in .cland/worktrees/T-202. Building a real spoke/real hub protocol regression; asked lead to reconcile current no-connection criterion with assignment's actionable-refusal requirement.

### impl-202 · 2026-10-11T18:43:10.292Z

Red protocol regression: node --test hub/test/spoke-identity.test.ts fails in 3.9 s. An unnamed discovering spoke calls who and gets no-role for generated session-1 instead of a skipped-connection response. The test also checks one durable journal record and absence of hello/refused-role/replaced in hub.log. Cause candidate: discovery unconditionally starts HubClient before checking whether this session has a bound name.

### rev-18 · 2026-10-11T18:48:43.907Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261011-202-1
commit: 2c790cb3199ca719e1152befb11df57747e9098a

Medium — hub/src/spoke/spoke.ts:288: the skip guard blocks a known nameless CLAND_SESSION_ID with a live or stored role-mapped identity, bypassing core.hello's documented join/name recovery and violating C2. The lead confirmed this regression was unintended. Preserve mapped identity recovery and cover both live join and offline recovery through the real spoke/project hub seam. C1 inspected successfully; C3 awaits full-suite evidence. Full Standards/Spec review: A-1348 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1348-t-202-review-at-2c790cb-mapped-identity-recovery-regression.md).

Criteria: C2 failed (Nameless known session ids with live/stored role mappings are skipped instead of joining or recovering the mapped identity.).

### impl-202 · 2026-10-11T18:49:45.353Z

Review found C2 regression in fresh nameless spokes with a known session id. Added live/offline mapped identity regression; it went red with connection-skipped at 2c790cb. Correcting admission with a readonly check of the persisted role mapping, leaving actual name recovery/join to core.hello. Obsolete suite cannot be cancelled by this Implementer on the running hub (suite.cancel refused as human-only); waiting for its result before corrected-head full suite.

### rev-18 · 2026-10-11T18:51:56.351Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-202-2
commit: 7b005601238ebf59a59fd452f306aca57655bb62

No high or medium findings remain. The read-only persisted-role lookup restores live and offline nameless mapped identity recovery while unknown unnamed spokes still skip connection and journal once. C1/C2 verified; C3 remains pending a full suite at this corrected head. Standards/Spec evidence: A-1350 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1350-t-202-re-review-at-7b00560-c1-c2-clear-c3-pending.md).

Criteria: C1 verified, C2 verified.

### rev-18 · 2026-10-11T19:37:35.452Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-202-3
commit: a35c6fc6eddac87b30e1e9657809d6037b7a9518

No high or medium findings. Dev merge changes only the already-landed session-stop-races.test.ts; all four reviewed task files remain byte-identical to 7b00560. C1/C2 reverified for the integrated head, including known nameless mapped-session joining/recovery. C3 awaits the fresh exact-head full suite; A-1361 at old 2c790cb is historical. Standards/Spec evidence: A-1362 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1362-t-202-dev-integration-review-at-a35c6fc-c1-c2-clear-c3-pending.md).

Criteria: C1 verified, C2 verified.

### impl-202 · 2026-10-11T20:50:52.256Z

Final cland suite all 39480fb7-077e-4331-b6f1-b8894be259cb passed at a35c6fc6eddac87b30e1e9657809d6037b7a9518 after origin/dev integration: typecheck plus full hub/Neovim suites, 1550/1550 tests pass, zero failed/skipped/cancelled. Durable log A-1385: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1385-suite-39480fb7-077e-4331-b6f1-b8894be259cb-all-at-a35c6fc.log. C3 marked done; C1/C2 already verified at this exact head by rev-18.

### coord · 2026-10-11T20:51:18.849Z

Merged 5608e1279bced727c8005c22723f6e27bcfa44e6 onto dev.
