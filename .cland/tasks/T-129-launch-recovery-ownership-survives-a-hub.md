---
id: T-129
kind: task
title: "Launch recovery ownership survives a hub restart: a failed spawn's pending cleanup is persisted and gates reuse until it settles"
state: open
status: backlog
labels:
  - needs-triage
  - hub
  - tech-debt
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T22:17:07.427Z
updated: 2026-10-10T08:01:52.807Z
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

- [ ] A failed spawn with an unverified child, followed by a hub restart: relaunch is refused until the recovery settles, and the files are not reused, which a test proves.
- [ ] A child confirmed dead after the restart leads to cleanup and a released session.
- [ ] `npm run typecheck && npm test` pass.

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
