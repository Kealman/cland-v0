---
id: T-694
kind: task
title: Session resume, launch and stop-race matrices run on the in-process fake adapter, with one real proof per harness
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-686
topic: null
branch: null
created: 2026-10-16T19:59:36.176Z
updated: 2026-10-16T20:00:52.108Z
---

## Summary

Three files prove hub bookkeeping through fake harness binaries (memo §2.2 win 8; report-slice4 top 10 #3, report-slice3 #2 and #4):

- `session-resume.test.ts` (59.3 s): an 8-way `fresh × {claim, closed, exclusive, hold}` matrix of launch, stop and resume.
- `session-launch.test.ts` (40.8 s; 7 `startDaemon`, 7 fake-binary sites): brief ordering and cwd resolution, which `launch-admission.test.ts` already proves in-process in milliseconds.
- `session-stop-races.test.ts` (44.0 s): a 3 harness × 2 stop × 2 forced matrix of one hub rule (stopped is not death).

## What to build

- **session-resume.** The matrix runs as a T2 table on T-686's fake adapter: the resume notes are bookkeeping over claims, holds and roles. One native Claude resume and one Codex `--fresh` stay as T3 proofs.
- **session-launch.** Brief composition and cwd resolution (absolute, refused, relative) are asserted on the `SpawnRequest` the fake records. Two frame proofs stay on `projectHub`: the Coordinator launching an Implementer with a brief, and `cland session launch` forwarding text and artifact briefs.
- **session-stop-races.** Manual and graceful × forced runs in-process with a fake whose `stop` resolves after `stopGraceMs`. One real proof per harness (forced stop after merge, the hardest cell) and the two Codex descendant probes stay T3.

## Acceptance criteria

- [ ] C1. The three files' manifest seconds fall from 144.1 s (A-3877) to 55 s or less, T2 and T3 parts together.
- [ ] C2. Their fake-binary call sites fall from 13 to 6 or less and their `startDaemon` sites from 7 to 0.
- [ ] C3. The moved cases are in T2 files that pass the tier lint, and the remaining T3 tests each name the harness behaviour they prove.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-686 (in-process fake adapter).
