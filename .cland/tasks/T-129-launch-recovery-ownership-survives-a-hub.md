---
id: T-129
kind: task
title: "Launch recovery ownership survives a hub restart: a failed spawn's
  pending cleanup is persisted and gates reuse until it settles"
state: closed
status: done
criterion_seq: 3
labels:
  - hub
  - ready-for-agent
assignee: impl-129
parent: E-229
blocked_by: []
topic: topic-156
branch: t/T-129-launch-recovery-ownership-survives-a-hub
created: 2026-10-09T22:17:07.427Z
updated: 2026-10-11T22:20:01.449Z
---

## Parent

Part of T-19, a follow-up to T-79. Found by rev-6 in rev-6-79-2 on T-79 (A-232), at hub/src/adapters/launch-files.ts lines 89 and 135. Left out of T-79 by the Coordinator's decision, because persisting state across restarts is a larger design than T-79's async conversion.

## What happened

T-79 keeps a failed spawn's files and recovery state while the child's exit is unverified. That ownership lives only in memory. If the hub restarts, the reconstructed adapter can reuse the session while the failed child and its resources still exist.

## What to build

- Persist pending launch-recovery ownership in the hub's store: the session, the child's identity as pid plus start time, and the owned files.
- On hub start, re-verify the child, using T-70 and T-76's ownership rules, and either finish the cleanup or keep the ownership.
- Refuse a launch or relaunch of that session while recovery is pending, naming the reason.

## Acceptance criteria

- [x] C1. A failed spawn with an unverified child, followed by a hub restart: relaunch is refused until the recovery settles, and the files are not reused, which a test proves.
  - done: impl-129 · 2026-10-11T21:39:36.251Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T129-1 · 2026-10-11T22:19:42.250Z · commit a482ace8264d94433be5477a60fe2c5ffafe59ab
- [x] C2. A child confirmed dead after the restart leads to cleanup and a released session.
  - done: impl-129 · 2026-10-11T21:39:36.840Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T129-1 · 2026-10-11T22:19:42.250Z · commit a482ace8264d94433be5477a60fe2c5ffafe59ab
- [x] C3. `npm run typecheck && npm test` pass.
  - done: impl-129 · 2026-10-11T22:19:27.454Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T129-1 · 2026-10-11T22:19:42.250Z · commit a482ace8264d94433be5477a60fe2c5ffafe59ab

## Notes

Size M; triage first. tech-debt: it does not block v0.1.

## Comments

### coord · 2026-10-10T07:09:28.996Z

Moved from T-141's review (rev-67-141-7, A-487, runnable probes inside), Coordinator scope decision 2026-10-10:
- Finding 3 (sessions.ts:494): rememberLaunchIdentity commits the returned id into the Store before table.put. If the row insert fails before commit, cleanup doesn't restore the prior offline identity: the prior role lands under the failed new id, the prior id loses its name, and @lead routing for an unchanged claim falls to the Coordinator. Stage identity publication with acceptance, or restore the owned identity change on unpublished failure.
- Finding 4 (sessions.ts:312): subscriber cleanup depends on published=true. A credentialed early subscriber whose launch fails before the row commits keeps its subscription after verified cleanup. End proven subscriber-owned records after verified death even without a published row.
Both are reached only through injected Store/row write faults.

### coord · 2026-10-10T08:01:52.807Z

Hardening notes from T-141's review rev-67-141-9 (A-497, Medium 1), out of T-141's trust model by Coordinator decision 2026-10-10. T-141's model: the launch token is a bearer secret held only by the spawned process, and the adapter reports its own process's identity. Defence-in-depth gaps beyond that model:
- a session first connected after launch admission, which then presents the launch token through hello, is adopted (sessions.ts:137, core.ts:496);
- an adapter returning an identity first connected after admission is accepted (sessions.ts:505);
- an anonymous credentialed hello selects such an id during the PID await.
In each case, a later spawn or watch failure clears that identity's role. A-497 has the root probes. Also from A-497: foreign process-row and verifier-hold cleanup notes.

### coord · 2026-10-10T08:11:51.073Z

T-141's final review (rev-67-141-10, A-500) cleared at d2481e5. A-500 lists the unresolved launch-identity classes left for T-129, each with a probe pinned to that head. Start from them together with A-487 (findings 3 and 4) and A-497 (Medium 1).

### impl-129 · 2026-10-11T21:22:57.863Z

Claimed at dev 0e3d011. Read T-102 and the deferred T-141 findings (A-487/A-497/A-500). Reproduction seam is the requested fake-harness protocol launch/restart path; resource rollback currently consists of in-memory closures in LaunchFiles/FailedLaunches.

### impl-129 · 2026-10-11T21:40:34.057Z

Implemented and pushed a482ace8264d94433be5477a60fe2c5ffafe59ab after merging origin/dev badc088. Durable resource rollback is attached to the existing pending-stop receipt before cleanup begins; failed relaunch retains its conversation. Deferred T-141 identity findings have red/green regressions. Evidence: A-1399, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1399-t-129-implementation-and-regression-evidence-at-a482ace.md. Targeted checks pass (4 protocol, 63 name-reservation, 64 native-boundary, 6 lifecycle), plus typecheck. Review requested to reviewer and resolved to rev-17; launching final suite all for that merged head. C3 awaits its result. QA policy none/per-item with no QA criteria.

### impl-129 · 2026-10-11T22:19:27.598Z

Final full verification passed at exact head a482ace8264d94433be5477a60fe2c5ffafe59ab: cland suite all run 4746c2a5-425d-4c5c-baac-937796011b2f, exit 0, typecheck plus 1584/1584 tests (zero failures/cancellations/skips). Durable log A-1414, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1414-suite-4746c2a5-425d-4c5c-baac-937796011b2f-all-at-a482ace.log. C3 is now done; all criteria await the final Reviewer verdict. No code/head changes after the submitted suite.

### rev-17 · 2026-10-11T22:19:42.250Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261012-17-T129-1
commit: a482ace8264d94433be5477a60fe2c5ffafe59ab

No findings (high/medium/low); Standards and Spec clear. C1/C2 verified by failed-spawn/restart cases for captured and unknown child start identities, preserved failed-relaunch conversation, and OpenCode content/mode restoration with shared-file isolation. Durable receipts retain child/file ownership and fence reuse through settlement. Deferred T-141 claimant routing, early subscription, later foreign identity and foreign row/hold cases are covered and pass. Code review A-1400; red/green evidence A-1399. C3 verified from A-1414: exact unchanged reviewed head, typecheck/full suites pass 1584/1584, zero failures/cancellations/skips, exit 0. All C1-C3 verified; T-102 remains separate scope.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-11T22:20:01.449Z

Merged ef576e8cfbb743fdac7752095b9685b1754e8df7 onto dev.
