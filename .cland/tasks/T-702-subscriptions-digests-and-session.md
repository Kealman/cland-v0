---
id: T-702
kind: task
title: Subscriptions, digests and session archive move to T2 on the fake clock, with restarts as projectHub stop and serve
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-685
  - T-686
  - T-687
topic: topic-465
branch: t/T-702-subscriptions-digests-and-session
created: 2026-10-16T19:59:37.198Z
updated: 2026-10-17T22:08:59.890Z
---

## Summary

These files prove hub rules (digest ordering, steering, usage thresholds, archive windows, journal replay) through harness matrices, real archive windows and hub restarts (report-slice2 #6 and anti-patterns A and D, report-slice3 anti-pattern 8, report-slice4 anti-pattern A):

| File | Seconds | Note |
|---|---:|---|
| `subscription-hygiene.test.ts` | 57.4 | "digest now steers" ×3 harnesses: 18.4 s |
| `default-subscriptions.test.ts` | 54.7 | double restarts in loops |
| `subscriptions.test.ts` | 51.9 | harness permutations × restart: 18 s |
| `session-archive.test.ts` | 57.2 | four fake launches and a real 2 s archive window |
| `agents-journal.test.ts` | 24.6 | six stop/start round trips |

## What to build

- **One proof, then a table.** Digest and steer rules keep one Claude Code frame proof (T3) and run as a T2 table over T-686's flavours.
- **Windows on the clock.** Archive windows, idle-notify windows and usage thresholds are advanced on T-685's `FakeClock`.
- **Persistence.** Durability is proven by `projectHub` stop and serve on the same root, or by reopening the `Store`.
- **What stays T3**, with a header: `default-subscriptions`' real-pid SIGKILL cases.
- **Replay.** `agents-journal`'s replay-after-crash and no-replay-after-prune tests merge into `agents-checkpoint.test.ts` (T1).

## Acceptance criteria

- [x] C1. The five files' manifest seconds fall from 245.8 s (A-3877) to 130 s or less.
  - done: impl-702 · 2026-10-17T22:08:35.171Z
- [x] C2. Their fake-binary call sites fall from 22 to 5 or less, `startDaemon` sites from 37 to 6 or less, and numeric sleeps from 8 to 0.
  - done: impl-702 · 2026-10-17T22:08:35.721Z
- [x] C3. The moved rules pass the tier lint as T1 or T2, and the remaining T3 tests each name their process behaviour.
  - done: impl-702 · 2026-10-17T22:08:38.462Z
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-702 · 2026-10-17T22:08:38.995Z
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-685 (hub Clock seam), T-686, T-687. Starts after T-575 merges (it touches `session-archive` and `agents-journal`).

## Comments

### impl-702 · 2026-10-17T22:00:48.749Z

Implementation now migrates the five rule files to T2, adds T1 checkpoint replay/prune proofs, and retains native PID recovery, Git review/QA and merge boundaries plus one Claude digest frame in named T3 splits. Typecheck/tiers pass; test lint has no findings in touched files. Running every touched file whole-file 5/5 serially under load <15; C4 audit inventories all 53 original declarations and 522 assertion sites.
