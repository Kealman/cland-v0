---
id: T-79
kind: task
title: "Harness adapters do synchronous fs while spawning a session: Codex
  mkdirSync, rmSync, openSync and closeSync on launch"
state: closed
status: done
labels:
  - hub
  - ready-for-agent
assignee: null
parent: E-19
blocked_by: []
topic: topic-40
branch: t/T-79-harness-adapters-do-synchronous-fs-while
created: 2026-10-09T18:47:17.580Z
updated: 2026-10-10T00:58:17.878Z
---

## Parent

Part of T-19. Found by impl-77 on 2026-10-09 at 18:46Z while extending the launch guard for T-77. T-77 guards the shared launch layer with a fake adapter. The adapters' own spawn paths were left out by the Coordinator's decision.

## What happened

Launching a session runs synchronous fs inside the harness adapters. In the Codex adapter, hub/src/adapters/codex.ts lines 353–379 call `mkdirSync`, `rmSync`, `openSync` and `closeSync`, and its workspace and policy helpers do more. The other adapters, OpenCode and Claude Code, are likely similar. session.launch and relaunch are request paths, so these calls block every connected session for their duration (A-96, class A).

## What to build

- Audit every adapter's launch, relaunch, resume and stop paths for synchronous fs and process calls, and convert them to async, keeping their ordering and rollback on failure.
- Extend the native-boundary guard from T-70, T-75 and T-77 to each real adapter's spawn path, not only the fake adapter.

## Acceptance criteria

- [ ] No synchronous fs call is reachable from session.launch, relaunch or resume through any real adapter, which the guard proves.
- [ ] A launch that fails part-way leaves no half-made workspace or log file, which a test proves for each adapter.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Start after T-77 merges. Can run beside T-78.

## Comments

### coord · 2026-10-09T20:23:19.252Z

Added scope, from rev-6-104-2 on T-104 (A-185), a low: the start of the launch's cwd stat, and the error timing of role assignment, are not yet timed consistently with the surrounding resumed scopes. They are bounded, so there is no stall risk. Fold this into T-79's launch-path timing pass.

### impl-79 · 2026-10-09T21:40:01.962Z

Auditing Codex, OpenCode and Claude Code launch/resume/stop dependencies. Will preserve ordered role admission and termination helper, add real-adapter native guards and staged failure cleanup evidence, then run typecheck and one full npm test.

### impl-79 · 2026-10-09T21:52:44.294Z

Implementation and targeted checks are complete: async Codex policy/socket/log helpers, async OpenCode config/password/log preparation and resume reads, launch rollback for created directories/files and identity-checked owned children. Real adapter native guards pass spawn/watch/live-resume/stop/relaunch and detect planted sync calls in all three. Failure injections cover directories, config/password partial writes, permissions, log snapshot/open/close/read, native spawn, readiness/exit/timeout, thread/session creation and logging; failed relaunch restores prior bytes/modes. Cwd-stat initiation and role-assignment error conversion timing regressions pass while T-104 admission ordering remains unchanged. Running the one required full npm test next.

### impl-79 · 2026-10-09T21:54:18.161Z

Committed implementation head 110943870a2b1236bd5291d504b39e5f284a3ef1 and pushed to local territory origin. Evidence A-217: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-217-t-79-native-guards-timing-and-failure-stage-table.md. Typecheck and targeted checks pass; one full npm test is queued behind the machine-wide suite lock.

### rev-6 · 2026-10-09T21:59:45.334Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-79-1
commit: 110943870a2b1236bd5291d504b39e5f284a3ef1

Medium — hub/src/adapters/launch-files.ts:40: path-based rm/truncate/restore undo is unfenced; concurrent same-session relaunches are admitted by Sessions.resume, so A failing after B commits can remove B's socket/config or truncate B's new log. Serialize by stable session identity or fence resource ownership.
Medium — hub/src/adapters/launch-files.ts:71: failed/unverified child termination does not stop file undo, and :78 clears recovery state; a still-running failed spawn loses its resources and supervision. Preserve resources/recovery ownership until child exit is verified, without weakening the unchanged termination helper.
Medium — hub/src/adapters/opencode/server.ts:30: a partial wx .gitignore write leaves incomplete shared metadata; rollback preserves it and retries accept EEXIST, leaving generated config/password without the wildcard exclusion. Safely repair/remove an owned partial write; add partial-ignore coverage.
Low — hub/src/adapters/sessions.ts:272: post-fresh authorization and cwd/stat initiation remain adjacent separate resumed scopes; a 150+150 ms probe gives zero slow records for a 300 ms uninterrupted stretch. Combine them.

All findings reproduced with production helpers/Sessions and in-memory fixtures (no files/sockets). Native real-adapter guard coverage is meaningful; ticket-before-await admission and the termination helper are unchanged. Hub typecheck and diff check pass; no reviewer tests/full suite run. Separate Standards/Spec reports and exact probes: A-218, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-218-t-79-review-rev-6-79-1-at-1109438.md.

### impl-79 · 2026-10-09T22:02:05.958Z

Fix round rev-6-79-1: cancelled the queued 1109438 suite before it acquired the lock. Addressing stable-session lifecycle serialization, termination-before-file-undo with retained supervision/recovery, atomic shared .gitignore publication with partial-write coverage, and merged post-fresh authorization/stat initiation timing.

### impl-79 · 2026-10-09T22:08:17.501Z

Fix-round head b2549644e5b4c6ed5f2ca87deeb9a37a0a3d4797 committed and pushed to origin. Stable-identity lifecycle slots release on all exit paths; child verification precedes any file undo and pending failures retain supervised recovery; shared OpenCode .gitignore is staged/renamed atomically and managed partial prefixes are repaired; post-fresh authorization/stat start share one scope. Typecheck, diff check, 52 adapter regressions, 4 serialization cases and 15 admission/timing cases pass. The old queued suite exited 130 before taking the lock; a new full suite starts on this head.

### rev-6 · 2026-10-09T22:16:45.960Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-79-2
commit: b2549644e5b4c6ed5f2ca87deeb9a37a0a3d4797

Medium — hub/src/adapters/sessions.ts:381 (and requests.ts:97): queued stop drops the authorization callback; a revoked Coordinator CLI grant can stop the replacement after relaunch completes. Forward and recheck the grant before adapter.stop.
Medium — hub/src/adapters/launch-files.ts:89,135: pending cleanup ownership exists only in memory; reconstructing the adapter after restart permits reuse while the failed child and resources survive. Persist recovery ownership and gate reuse until recovery settles.
Medium — hub/src/adapters/opencode/server.ts:38: unconditional rename overwrites custom .gitignore content created or edited after the initial read; fence publication against the observed absent/managed contents.
Low — hub/src/adapters/sessions.ts:396: stop publication and immediate slot release split one continuation into adjacent resumed scopes.

Evidence and separate Standards/Spec reviews: A-232, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-232-t-79-resolution-review-rev-6-79-2-at-b254964.md. Original timing, serialization, termination-refusal and staging probes rerun with production code and memory boundaries. Serialization avoids self-deadlock and releases slots on failure; post-fresh timing is fixed. Hub typecheck and diff check pass; termination helper unchanged. No full suite run by Reviewer.

### impl-79 · 2026-10-09T22:17:43.747Z

Second fix round rev-6-79-2: interrupted the b254964 full suite before completion because later hub groups and nvim remain. Will forward/recheck queued-stop authorization, combine stop publication and slot release, fence ignore publication against concurrent edits, and add the Coordinator's T-129 restart limitation note only.

### impl-79 · 2026-10-09T22:21:15.218Z

Second fix-round head 0fca1530e70c2a9e4b671eaca723ca130aa83671 committed and pushed to origin. Forwarded stop authorization and recheck after lifecycle wait; stop publication and release share one resumed scope; OpenCode preserves/warns on staged-ignore conflicts and publishes absent targets without clobber; T-129 restart limitation documented. Typecheck/diff check and targeted adapter (56), lifecycle (6), admission/timing (15), role refresh (2) tests pass. b254964 suite ended 130 by requested interruption before completion; starting one new full npm test on this head.

### rev-6 · 2026-10-09T22:23:15.024Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-79-3
commit: 0fca1530e70c2a9e4b671eaca723ca130aa83671

Medium — hub/src/adapters/opencode/server.ts:47: an existing managed partial .gitignore is still replaced by unconditional rename after the final async read; a custom edit made in that gap is overwritten without warning. Root production probe reproduces it. Preserve/refuse replacement of the existing target and add a late-edit regression. The absent-target no-clobber branch and staging-time edit detection are fixed.

Grant recheck after the lifecycle slot, slot release on failures, no self-deadlock and combined stop timing pass the rerun A-232 memory probes. Original post-fresh timing and termination-first rollback remain fixed. Accepted known limitation — launch-files.ts:89,135: recovery ownership across restart remains in memory; this larger durability design is T-129 and documented in hub/README.md, and does not block this review.

Hub typecheck/diff check pass; termination helper untouched. No native tests/full suite run by Reviewer. Separate Standards/Spec reports and exact evidence: A-235, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-235-t-79-resolution-review-rev-6-79-3-at-0fca153.md.

### impl-79 · 2026-10-09T22:26:31.035Z

Third fix-round head a2ec3ceae16b38b5ac52793ecd52158f798d089c committed and pushed to origin. Existing OpenCode ignore files are repaired only with append-only missing-wildcard writes; never renamed over or truncated. Existing/late-created custom edits survive, existing wildcard bytes stay untouched, append failure and partial-append retry are covered. All 58 adapter guard/failure tests, typecheck and diff check pass. 0fca153 suite cancelled before acquiring the lock (exit 130, no tests ran); starting one full npm test on the new head.

### rev-6 · 2026-10-09T22:27:47.002Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-79-4
commit: a2ec3ceae16b38b5ac52793ecd52158f798d089c

No high, medium or low findings remain. Append-only existing-ignore repair resolves the late-edit overwrite: production memory probes preserve custom bytes, leave existing wildcard bytes untouched and repair a partial append on retry. Absent-target publication remains no-clobber. A-235 serialization, revoked grant, slot release, child verification and timing probes still pass.

Accepted known limitation — hub/src/adapters/launch-files.ts:89,135: pending recovery ownership is in memory and lost across restart; persistent recovery is a larger design outside T-79's async conversion, tracked in T-129 and documented in hub/README.md. This does not block the verdict.

Hub typecheck/diff check pass. No native integration tests/full suite run by Reviewer; implementer's full suite is starting. Separate Standards/Spec reports and exact probes: A-237, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-237-t-79-resolution-review-rev-6-79-4-at-a2ec3ce.md.

### impl-79 · 2026-10-09T22:48:03.184Z

Implementation complete at clean head a2ec3ceae16b38b5ac52793ecd52158f798d089c, pushed to local origin. npm run typecheck passes. Full npm test on this committed head exited 0: hub 704/704 and nvim 104/104 passed, zero failures/cancellations/skips; runtime 640.26 s, lock wait 624.22 s. Durable full-suite evidence A-244: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-244-t-79-full-npm-test-at-a2ec3ce-808-passed.log. Current append-only fix evidence A-236: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-236-t-79-append-only-ignore-fix-at-a2ec3ce.md; earlier guard/failure table A-217 and serialization/recovery/authorization notes A-226/A-234 are superseded only for ignore publication. Reviewer rev-6-79-4 is clear on this head. Restart-persistent recovery remains the accepted/documented T-129 limitation. No merge performed.

### coord · 2026-10-09T22:48:13.385Z

Merged 508a42443c73ea3e8521d4de3769619f518015a1 onto dev.

### coord · 2026-10-09T22:48:16.894Z

Merged by the Coordinator through `cland merge T-79`, after `cland push`. Gate: review rev-6-79-4 clear on a2ec3ce. Earlier rounds:
- rev-6-79-1: concurrent same-session relaunches, undo before a verified exit, a partial .gitignore, split timing;
- rev-6-79-2: a revoked grant on a queued stop, the restart limitation, a staged .gitignore overwrite;
- rev-6-79-3: a rename over an edited .gitignore.
Final design:
- async adapter launch, relaunch, resume and stop, serialized per session;
- file undo only after a verified exit, with recovery state kept otherwise;
- the grant rechecked after the queue;
- .gitignore published without clobbering, and repaired only by an append-only write.
Accepted limitation: recovery ownership across a hub restart is T-129. Full suite on a2ec3ce: 704 hub and 104 Neovim tests passed (A-244). impl-79 stopped.
