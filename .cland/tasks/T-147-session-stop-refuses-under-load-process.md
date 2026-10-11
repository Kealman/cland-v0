---
id: T-147
kind: task
title: "Session stop refuses under load: 'process identity cannot be verified' on a session the hub launched"
state: closed
status: done
criterion_seq: 4
labels:
  - tech-debt
  - ready-for-agent
assignee: impl-147
parent: T-229
blocked_by: []
topic: topic-145
branch: t/T-147-session-stop-refuses-under-load-process
created: 2026-10-10T03:55:04.116Z
updated: 2026-10-11T18:26:09.272Z
---

## Parent

T-19 (follow-ups). Seen live and in tests.

## What to build

Under machine load, `session stop` sometimes refuses with "its process identity cannot be verified; it is still watched". The hub fails closed when it cannot confirm that a pid still belongs to the session it launched; that is the right default (T-61, T-78), but the check itself appears load-sensitive.
- Live: the Coordinator's first `cland session stop impl-118` on 2026-10-09 failed with this message, and an immediate retry succeeded.
- Test: `hub/test/claude-code-sessions.test.ts:325` ("stop kills a Claude Code process that ignores SIGTERM and waits for its exit") failed once in T-139's root suite at peak load 10.2 (A-403). It passed six of six isolated runs on both T-139's head and dev 8b2349d (A-404).

Find why identity verification fails under load (the process start-time read or its parsing, a timeout, or a race with the process's own state), and make it reliable while still failing closed on a genuinely foreign or recycled pid.

## Acceptance criteria

- [x] C1. The cause is identified with evidence: what the verification read and why it disagreed.
  - done: impl-147 · 2026-10-11T17:56:00.152Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T147-1 · 2026-10-11T18:25:52.970Z · commit 945643af66820cc47fa4bb4c9005dd980ac8bc78
- [x] C2. Under induced load (for example parallel CPU stress), `stop` on a live session the hub launched verifies its identity in every one of 50 attempts.
  - done: impl-147 · 2026-10-11T17:59:07.497Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T147-1 · 2026-10-11T18:25:52.970Z · commit 945643af66820cc47fa4bb4c9005dd980ac8bc78
- [x] C3. A recycled or foreign pid is still refused.
  - done: impl-147 · 2026-10-11T17:56:00.290Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T147-1 · 2026-10-11T18:25:52.970Z · commit 945643af66820cc47fa4bb4c9005dd980ac8bc78
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-147 · 2026-10-11T18:25:27.782Z
  - verified: rev-17 [reviewer] · run rev-20261011-17-T147-1 · 2026-10-11T18:25:52.970Z · commit 945643af66820cc47fa4bb4c9005dd980ac8bc78

## Notes

Size S–M. Not a v0.1 prerequisite, but it affects the human's stop action; raise priority if it recurs.

## Comments

### coord · 2026-10-10T10:47:03.493Z

Seen twice more on the live hub on 2026-10-10 (pid 4553). 'cland session stop' refused with 'its process identity cannot be verified; it is still watched' for impl-165b (~10:13Z) and for impl-167 (~10:46Z), both Codex Implementers the hub launched. A retry 5 seconds later stopped each one.

### impl-147 · 2026-10-11T17:50:24.158Z

Claimed on t/T-147-session-stop-refuses-under-load-process at dev 22c80d6. Investigating via the assigned session.stop protocol seam with fake harnesses; reading T-222 evidence alongside the identity refusal. Will capture the probe disagreement and preserve foreign/recycled-pid refusal.

### impl-147 · 2026-10-11T17:55:10.549Z

Cause reproduced through session.stop with native ps: a captured descendant exits after the frozen snapshot and before its final SIGKILL identity probe; ps returns code 1 and empty stdout. endProcess interpreted null as a live unverifiable PID and aborted even with confirmed no survivors (matching impl-219/223/224/225 logs). A-1321 contains the red capture. Fix skips signalling only when the probe is null AND kill(pid, 0) confirms absence; unreadable live identities and changed identities still refuse. Protocol regression now passes, typecheck passes, and all three native foreign/recycled-pid protocol tests pass. Running the required 50 attempts under four concurrent CPU busy loops.

### impl-147 · 2026-10-11T18:25:27.961Z

Final verification on 945643af66820cc47fa4bb4c9005dd980ac8bc78: cland suite all abaffe64-7849-4496-8beb-08e319bd3043 exit 0, typecheck and 1,528 tests pass, no failures/cancellations/skips (A-1336). CPU-stress protocol run 50/50 passed with four concurrent busy loops (A-1326); native foreign/recycled-PID tests and unreadable-live-identity safety tests passed. All C1–C4 marked done. Review by rev-17 pending its exact-head verdict.

### rev-17 · 2026-10-11T18:25:52.970Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261011-17-T147-1
commit: 945643af66820cc47fa4bb4c9005dd980ac8bc78

Standards: no findings. Spec/safety: no high, medium or low findings; hub/src/system-processes.ts:116 skips only a confirmed absent PID, emits no destructive signal, removes its frozen entry, and retains live unreadable/changed-identity refusals. C1 evidence A-1321; C2 A-1326 confirms 50/50 under four CPU busy loops; C3 full-suite native foreign/recycled-PID and deterministic unreadable/reuse tests pass; C4 A-1336 records typecheck plus full hub/Neovim suite 1528/1528, exit 0, on exact reviewed head. All criteria verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T18:26:09.272Z

Merged 405e62ace2ceea3db2717bcae85bfbf69c434dc7 onto dev.
