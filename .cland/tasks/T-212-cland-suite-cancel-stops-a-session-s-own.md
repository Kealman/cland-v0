---
id: T-212
kind: task
title: cland suite cancel stops a session's own queued or running suite and
  posts the cancellation
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
assignee: impl-212
parent: E-230
blocked_by: []
topic: topic-144
branch: t/T-212-cland-suite-cancel-stops-a-session-s-own
created: 2026-10-11T05:16:28.859Z
updated: 2026-10-11T18:40:59.055Z
closed: 2026-10-11T18:40:59.163Z
---

## What to build

`cland suite` (T-203) can only start a run. Cancelling one means sending SIGTERM to the worker by pid. That works because the worker forwards the signal to its npm/runner group and writes an interrupted receipt, but sessions have to find and verify the pid themselves. Seen on 2026-10-11, when impl-182 cancelled an obsolete run after a review fix.

Add `cland suite cancel [<suite id>]`. It cancels the caller's own queued or running suite (the latest one by default) through the hub, releases its queue ticket or lock, and posts one 'cancelled' result to the original recipients. It refuses another session's suite.

## Acceptance criteria

- [x] C1. A queued suite cancelled before admission leaves the queue at once; a running one is interrupted cleanly with its receipt.
  - done: impl-212 · 2026-10-11T18:08:52.524Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T212-2 · 2026-10-11T18:40:40.694Z · commit df1a485498795d2cacd8ac05d7348513828d0dc3
- [x] C2. Exactly one result reaches the original recipients, marked cancelled.
  - done: impl-212 · 2026-10-11T17:58:15.702Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T212-2 · 2026-10-11T18:40:40.694Z · commit df1a485498795d2cacd8ac05d7348513828d0dc3
- [x] C3. Cancelling another session's suite is refused with the reason.
  - done: impl-212 · 2026-10-11T17:58:15.954Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T212-2 · 2026-10-11T18:40:40.696Z · commit df1a485498795d2cacd8ac05d7348513828d0dc3
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-212 · 2026-10-11T18:40:03.687Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T212-2 · 2026-10-11T18:40:40.696Z · commit df1a485498795d2cacd8ac05d7348513828d0dc3

## Notes

Size XS.

## Comments

### impl-212 · 2026-10-11T17:50:24.876Z

Claimed in the generated task worktree from dev 22c80d6. Inspecting suite worker, FIFO locks and CLI routing; implementation will preserve original recipients and persist cancellation for exactly-once recovery.

### impl-212 · 2026-10-11T17:55:34.290Z

CLI/frame cancellation is implemented with stable-session ownership, human explicit-id override, persisted exit 143/cancelled outcome, verified SIGTERM and existing cleanup/report deduplication. Five targeted regressions passed: running child/receipt, cross-session refusal and human cancellation, FIFO ticket removal preserving the holder, running runner/root/lease cleanup, and held cancellation reporting across restart. Typecheck passed. Running the complete existing suite.test.ts file next.

### rev-17 · 2026-10-11T18:01:49.436Z

verdict: review
result: not clear
by: rev-17 [reviewer]
run: rev-20261011-17-T212-1
commit: 045dc193b133d6b197a7d226b859c154a14fe15f

Medium — hub/src/hub/suites.ts:53: cancel awaits every pending submission and then the global inspector before selecting/persisting the target; another session's slow Git/start or cleanup/reporting can delay the caller's queued cancellation past admission or the CLI timeout. A controlled public Suites.start/cancel reproduction confirms the known target stays uncancelled until the unrelated start resolves. Reconcile only the selected job and cover an existing queued cancellation while another submission is held. Full evidence: A-1327 if assigned; see the review artifact posted in topic-144. Standards: no findings. C4 full suite remains pending; this verdict fails C1.

Criteria: C1 failed (Cancelling an already queued run waits for unrelated pending suite submissions and the global inspection pass, so it cannot leave the queue promptly.).

### coord · 2026-10-11T18:02:21.418Z

Evidence-pointer correction for rev-17's verdict on 045dc193: the review artifact is A-1328 (.cland/artifacts/A-1328-t-212-review-unrelated-submissions-block-cancellation.md), not A-1327 as the verdict text says. Recorded by the Coordinator at rev-17's request; reviewers can only comment verdicts.

### impl-212 · 2026-10-11T18:06:48.063Z

Fixing review finding A-1328/C1. Extended the existing FIFO CLI/socket regression to hold an unrelated caller’s real Git submission. It reproduced delayed ticket removal before the fix and passed after per-job inspection replaced global cancellation waits. Added admission checks and preserved cancellation for launches in progress. Typecheck passed; running all suite.test.ts regressions before pushing a fresh review head.

### rev-17 · 2026-10-11T18:40:40.696Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261011-17-T212-2
commit: df1a485498795d2cacd8ac05d7348513828d0dc3

Standards: no findings. Spec: no findings remain; A-1328/C1 is resolved by target-only reconciliation and deduplicated per-job cleanup. The held-unrelated-Git CLI/FIFO regression passes before release, preserving the holder and preventing admission. C1 running/queued cleanup and receipt, C2 original-recipient exactly-once cancellation across retry/restart, and C3 stable-session refusal/human override all pass in A-1345. C4: exact-head full suite 1381d788 typecheck plus 1532/1532 tests, exit 0, no failures/cancellations/skips. All four criteria verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T18:40:59.055Z

Merged fdb8c5c8558ce42f933bb4d296950ea03181e8f3 onto dev.
