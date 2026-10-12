---
id: T-102
kind: task
title: "Process termination ownership outside the sweep: overlapping doctors on deleted hubs, direct endProcess calls, and the SIGCONT doc"
state: closed
status: done
criterion_seq: 4
labels:
  - hub
  - tech-debt
  - ready-for-agent
assignee: impl-102
parent: T-229
blocked_by:
  - T-129
topic: topic-158
branch: t/T-102-process-termination-ownership-outside
created: 2026-10-09T19:16:42.280Z
updated: 2026-10-11T23:37:31.875Z
---

## Parent

Part of T-19, a follow-up to T-70 and T-76. Listed by rev-65 in rev-65-76-5 on T-76 (A-168) as pre-existing hazards in the shared termination helper, outside T-76's own scope by the Coordinator's decision.

## What happened

T-76 serialized sweeps per project and gave each sweep's workers atomic capture claims. Two gaps remain beyond that:
- `cland doctor --fix` runs started from different projects, or caller roots, can overlap on the same globally discovered deleted-project hubs. The per-project sweep lock does not cover them.
- Direct `endProcess` calls outside a sweep, from session stop, relaunch and lost-claim cleanup, have no shared termination ownership. Two of them, or one of them and a sweep, can freeze and thaw the same tree.
- A low docs correction from the same verdict: SIGCONT is not "harmless" in every case, because it can run a SIGCONT handler even in a running process. The README sentence on the accepted identity-free CONT needs that qualifier.

## What to build

- One machine-wide owner for terminating a given process tree. For example, a per-pid claim registry shared by every termination path, or a machine-wide lock for deleted-hub cleanup across doctors.
- Correct the CONT sentence in hub/README.md.

## Acceptance criteria

- [x] C1. Two doctors from different projects that both find one deleted hub end it once, without one freezing or thawing the other's tree, which a test proves.
  - done: impl-102 · 2026-10-11T22:30:44.779Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T102-2 · 2026-10-11T23:35:33.402Z · commit a6bb5d734c59ec5e0caa576d782409f574fe2ade
- [x] C2. A session stop that overlaps a sweep on the same tree ends it once and reports one result, which a test proves.
  - done: impl-102 · 2026-10-11T22:38:29.767Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T102-2 · 2026-10-11T23:35:33.402Z · commit a6bb5d734c59ec5e0caa576d782409f574fe2ade
- [x] C3. The README's CONT sentence carries the qualifier.
  - done: impl-102 · 2026-10-11T22:30:45.191Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T102-2 · 2026-10-11T23:35:33.402Z · commit a6bb5d734c59ec5e0caa576d782409f574fe2ade
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-102 · 2026-10-11T23:35:16.114Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T102-2 · 2026-10-11T23:35:33.402Z · commit a6bb5d734c59ec5e0caa576d782409f574fe2ade

## Notes

Size M; triage before scheduling. Follow T-70 and T-76's ownership rules (A-96, class D).

## Comments

### impl-102 · 2026-10-11T22:20:51.080Z

Claimed at ef576e8 in the task worktree. Building on A-1399/T-129 pending-stop receipts and the existing identity-verified endProcess boundary. Agreed test seam: fake-harness protocol with overlapping doctor/stop/sweep callers, observing one termination and no stranded descendants. QA policy none/per-item and no QA criteria.

### impl-102 · 2026-10-11T22:29:58.206Z

Both new fake-harness protocol regressions now fail against production sources pinned to ef576e8: stop/doctor delivers SIGTERM twice to one Codex server, and concurrent doctors from different roots deliver SIGTERM twice to one deleted hub. With per-PID owner reservations they pass with one termination result; the deleted-hub fixture also verifies its fake OpenCode server and TERM-resistant descendant are dead. Existing targeted checks pass: system-processes 18, orphan-servers 24 (including sixteen parallel resistant orphans), launch-recovery 4, lifecycle-serialization 6, and typecheck. Final verification will run after merging origin/dev and requesting review.

### impl-102 · 2026-10-11T22:31:28.567Z

Committed and pushed cf9f5e43486d671ddcbc2eb50769915391fdd872 after fetching/merging origin/dev ef576e8 (already integrated). Evidence A-1416, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1416-t-102-implementation-and-red-green-evidence-at-cf9f5e4.md. C1-C3 done; review requested and delivered to rev-17. Launching final cland suite all on this clean unchanged head; C4 awaits the hub result.

### rev-17 · 2026-10-11T22:34:05.170Z

verdict: review
result: not clear
by: rev-17 [reviewer]
run: rev-20261012-17-T102-1
commit: cf9f5e43486d671ddcbc2eb50769915391fdd872

Medium — hub/src/termination-owner.ts:54: #locks.clear() precedes release results, so a failed AsyncHubLock.release permanently loses the handle. Retrying release returns without removing the live-holder reservation; a new TerminationOwner waits until its deadline. For an incompletely ended tree, subsequent session stop/recovery cannot settle it while the hub remains alive. Preserve failed releases and arrange retry beyond the local owner lifetime; remove only successfully released handles. Add a transient release-failure regression proving another owner can acquire the PID after recovery. Read-only in-memory reproduction and details: A-1419, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1419-t-102-review-failed-reservation-release-strands-a-live-owner-lock.md. Standards: no independent findings. Spec: one medium. C1 overlap implementation/tests and C3 CONT qualifier checked; C2 fails this recovery case, C4 suite pending.

Criteria: C2 failed (A transient reservation release failure loses its nonce-owned handle, stranding the PID lock under a live caller and blocking subsequent stop/recovery attempts until that caller exits.).

### impl-102 · 2026-10-11T22:38:43.978Z

A-1419 corrected and pushed at a6bb5d734c59ec5e0caa576d782409f574fe2ade; origin/dev ef576e8 fetched/merged (already included). Failed release handles survive in the process retry queue; partial acquisition cleanup preserves the primary failure. New real-filesystem fault regression is red on cf9f5e4 and green here. Targeted verification: system-processes 20/20, protocol overlap 2/2, launch-recovery 4/4, typecheck/diff checks pass. C2 done again and re-review requested. Evidence A-1422, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1422-t-102-a-1419-release-recovery-fix-and-regression-evidence.md. Per Coordinator, corrected full suite waits for prior run 0e6fc04d-4bd9-4916-bbb7-ee7d5f90b10e to settle; its old-head result is superseded.

### impl-102 · 2026-10-11T23:02:56.192Z

Old suite 0e6fc04d-4bd9-4916-bbb7-ee7d5f90b10e settled as cancelled because cf9f5e4 changed to a6bb5d7; superseded log A-1430. Re-review A-1423 established C1-C3 with no remaining findings. Fetched/merged origin/dev ef576e8 again (already included), unchanged clean pushed head a6bb5d734c59ec5e0caa576d782409f574fe2ade. Review request sent before corrected final cland suite all; C4 awaits its result.

### impl-102 · 2026-10-11T23:35:16.433Z

Final full suite d3a667e4-0356-42ef-ad62-c6c4a009470a passed at unchanged committed/pushed head a6bb5d734c59ec5e0caa576d782409f574fe2ade: typecheck and 1588/1588 tests, exit 0, zero failures/cancellations/skips. Durable log A-1440, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1440-suite-d3a667e4-0356-42ef-ad62-c6c4a009470a-all-at-a6bb5d7.log. C4 done; C1-C4 await final review verification. Worktree is clean and no head changes followed suite submission. QA policy none/per-item, no QA criteria.

### rev-17 · 2026-10-11T23:35:33.402Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261012-17-T102-2
commit: a6bb5d734c59ec5e0caa576d782409f574fe2ade

No remaining findings (high/medium/low); Standards and Spec clear. C1/C2 verified by distinct-project doctor overlap and session-stop/doctor protocol cases: one TERM/completion, no competing thaw, captured descendants dead. A-1419 release-handle finding resolved with process-owned retry and successful-only handle removal; both real reservation fault regressions pass, with independent read-only recovery reproduction in A-1423. C3 README carries SIGCONT handler qualifier. C4 verified from A-1440: exact unchanged reviewed head, typecheck and full suites pass 1588/1588, zero failures/cancellations/skips, exit 0. All C1-C4 verified at a6bb5d734c59ec5e0caa576d782409f574fe2ade.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T23:37:31.875Z

Merged d2fbb4ee9be62c0b732e6662abbca042dbdf228f onto dev.
