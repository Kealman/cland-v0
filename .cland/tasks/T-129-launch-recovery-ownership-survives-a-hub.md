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
updated: 2026-10-10T00:58:18.035Z
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
