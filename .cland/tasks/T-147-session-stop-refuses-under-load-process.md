---
id: T-147
kind: task
title: "Session stop refuses under load: 'process identity cannot be verified' on a session the hub launched"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T03:55:04.116Z
updated: 2026-10-10T10:47:03.493Z
---

## Parent

T-19 (follow-ups). Seen live and in tests.

## What to build

Under machine load, `session stop` sometimes refuses with "its process identity cannot be verified; it is still watched". The hub fails closed when it cannot confirm that a pid still belongs to the session it launched; that is the right default (T-61, T-78), but the check itself appears load-sensitive.
- Live: the Coordinator's first `cland session stop impl-118` on 2026-10-09 failed with this message, and an immediate retry succeeded.
- Test: `hub/test/claude-code-sessions.test.ts:325` ("stop kills a Claude Code process that ignores SIGTERM and waits for its exit") failed once in T-139's root suite at peak load 10.2 (A-403). It passed six of six isolated runs on both T-139's head and dev 8b2349d (A-404).

Find why identity verification fails under load (the process start-time read or its parsing, a timeout, or a race with the process's own state), and make it reliable while still failing closed on a genuinely foreign or recycled pid.

## Acceptance criteria

- [ ] The cause is identified with evidence: what the verification read and why it disagreed.
- [ ] Under induced load (for example parallel CPU stress), `stop` on a live session the hub launched verifies its identity in every one of 50 attempts.
- [ ] A recycled or foreign pid is still refused.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S–M. Not a v0.1 prerequisite, but it affects the human's stop action; raise priority if it recurs.

## Comments

### coord · 2026-10-10T10:47:03.493Z

Seen twice more on the live hub on 2026-10-10 (pid 4553). 'cland session stop' refused with 'its process identity cannot be verified; it is still watched' for impl-165b (~10:13Z) and for impl-167 (~10:46Z), both Codex Implementers the hub launched. A retry 5 seconds later stopped each one.
