---
id: T-695
kind: task
title: Hub rules proven once per harness through three binaries collapse to one in-process table and one real frame proof
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-691
  - T-692
  - T-693
  - T-686
  - T-687
topic: topic-449
branch: t/T-695-hub-rules-proven-once-per-harness
created: 2026-10-16T19:59:36.269Z
updated: 2026-10-17T15:58:58.417Z
---

## Summary

`for (const harness of ['claude-code', 'codex', 'opencode'])` wraps tests whose assertions concern a hub rule (memo §2.3 anti-pattern 8; report-slice2 anti-pattern C, top 10 #6–#7):

- `session-model.test.ts` (48.9 s): model journalling, explicit × default and live × fresh × native resume.
- `session-usage.test.ts` (41.6 s): totals and cost per harness; it also shells out to `jq`.
- `progress.test.ts` (35.0 s): progress digest, 19 spoke spawns and four `sleep(400)`.
- `crew-launch.test.ts` (39.4 s): pool handoff, 3 harnesses × 2 `keep_context`.

## What to build

Each hub rule runs as a T2 table over T-686's fake adapter flavours: model and usage journalling, digest holding and release, pool handoff and `keep_context`. What differs per harness (how usage and model are parsed, steer versus next turn, native cwd and thread) is proven once per harness: in its contract file (T-691 to T-693) or, for the per-harness launch, in the crew-launch scenario (T-708). The `jq` check reads the journal in-process. Every fixed sleep is replaced by a barrier event.

## Acceptance criteria

- [ ] C1. The four files' manifest seconds fall from 164.9 s (A-3877) to 85 s or less.
- [ ] C2. Their fake-binary call sites fall from 23 to 6 or less, `spawnSpoke` sites from 21 to 4 or less, and numeric sleeps from 4 to 0.
- [ ] C3. Each hub rule has one T2 table test over the three flavours that passes the tier lint, and each per-harness difference names the contract-file or scenario test that proves it.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-686, T-687 (in-process spoke).
