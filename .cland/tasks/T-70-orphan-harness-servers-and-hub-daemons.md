---
id: T-70
kind: task
title: "Orphan harness servers and hub daemons: session stop ends the server,
  doctor and hub start sweep what no session owns"
state: closed
status: done
labels:
  - ready-for-agent
  - hub
assignee: impl-70
parent: E-19
blocked_by: []
topic: topic-23
branch: t/T-70-orphan-servers-and-sync-ps
created: 2026-10-09T10:44:01.288Z
updated: 2026-10-10T00:58:17.781Z
closed: 2026-10-09T15:19:48.070Z
---

## Parent

Part of T-19. Found by the human's stand-in on 2026-10-09 at 10:45Z while chasing the load: 11 orphan `opencode serve` processes aged 3 to 20 hours with no live OpenCode session (left by the adapter's stop or by T-46's QA runs), one Codex app-server (cx-0ad4250d3535) with no live session, and four stale hub daemons of temp test projects; all killed by hand.

## What to build

- `cland session stop` (and the adapter's stop on relaunch) ends the harness server it started: the OpenCode `serve` process, the Codex app-server, the Claude Code process group; it waits for the exit and kills after a grace period; the journal records what it ended.
- `cland hub start` and `cland doctor` sweep: a harness server whose socket or args name this project (`.cland/run/cx-*.sock`, an OpenCode server started by this hub) with no running session in the process table is ended (hub start) or reported with a `fix` line (doctor); a hub daemon whose project directory no longer exists is ended by `cland doctor --fix` or reported.
- Tests: the fake harnesses prove stop ends the server and relaunch replaces it; a real OpenCode `serve` left behind on purpose is swept by `hub start` in a scratch project (skip with the reason where OpenCode is absent).

## Acceptance criteria

- [ ] After `cland session stop <opencode session>` no `opencode serve` of that session remains; same for a Codex app-server and a Claude Code session
- [ ] `cland hub start` ends this project's harness servers with no session and says so; `cland doctor` reports them with a fix
- [ ] `npm run typecheck && npm test` pass; hub/README.md documents the sweep

## Notes

Size S. Implementer: Codex gpt-6.1-sol. Independent of the test-harness lock item (same incident, different fix).

## Comments

### coord · 2026-10-09T11:44:43.294Z

Added scope, from rev-6's review of T-58 on 2026-10-09 at 11:44Z. The session pid probes still reach `spawnSync('ps')` through `processStarted`, in hub/src/hub/lock.ts or the process table. That code is unchanged from main. It runs on hub request paths, such as `session.list` and launch or resume checks, so a slow `ps` blocks the event loop: the class of stall T-67 removed for git. T-58 made the territory lock's own `ps` asynchronous (`acquireLockAsync`). Do the same for every `ps` call reachable from a hub request: run it asynchronously, or cache the process start times on a timer. Add a test that the request handlers spawn no synchronous process.

### impl-70 · 2026-10-09T13:35:17.666Z

Reproduced incomplete Claude termination with `node --test --test-name-pattern='stop kills' hub/test/claude-code-sessions.test.ts`: stop returned 'outlived claude stop and SIGTERM; still watched'. Added a shared asynchronous process-tree terminator that verifies PID/start identities before signals, escalates to SIGKILL after grace, waits for exit and journals harness-ended; adapters now use it for stop/relaunch. Working through targeted verification before the orphan sweep.

### impl-70 · 2026-10-09T13:44:17.464Z

Milestone: doctor + hub-start sweep tests pass for a stopped Codex server and an untracked OpenCode server, while a running session’s server survives restart. The real installed OpenCode serve test also passed (not skipped). doctor --fix ends a verified daemon whose project directory was deleted while preserving a live-project hub. PID-reuse regressions pass for all adapters. Adding ambiguity and long-socket-path coverage, then the instrumented request test and final suite.

### impl-70 · 2026-10-09T13:51:24.988Z

Milestone: request instrumentation fails against the original helper at session.launch ('synchronous process in a session request') and passes with async probes. The existing doctor hung-ps/grandchild deadline regression passes after reusing the bounded process-group probe runner. README documents the sweep. Typecheck is clear; the one final npm test invocation is queued behind the machine-wide lock, held by PID 78681 since 13:45:47Z.

### impl-70 · 2026-10-09T14:01:44.934Z

Implementation complete. Commit 9209a7a (full SHA read back from git log will be in the handoff artifact) adds verified async process-tree termination to all adapters, awaited relaunch, startup orphan sweeping under the hub lock, doctor orphan reports and deleted-project --fix, async request-path ps probes, journal records and README documentation. Validation: npm run typecheck passed; one final npm test invocation passed 378 hub + 91 Neovim tests, no failures/skips, and completed cleanup (468.98s suite, 275.80s lock wait). Real OpenCode scratch sweep ran and passed. No push or merge.

### qa-12 · 2026-10-09T14:07:17.275Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-70-1
commit: 9209a7a3faab30b15f1acc3829e8cb53d2568638

Read item/A-70; isolated git archive9209a7a with T-70 node_modules, Node24.21.0. No product changes or duplicate full suite.

Ran:
- npm run typecheck:pass.
- node --test hub/test/orphan-servers.test.ts hub/test/session-async-processes.test.ts:10/10,zero failures/skips,32.07s. Real installed OpenCode sweep ran; fake all-adapter stop/relaunch and async-request instrumentation passed.
- Independent scratch CLI commands all used env -u CLAND_HUB_FILE -u CLAND_SESSION_ID -u CLAND_SESSION_NAME node <export>/hub/bin/cland.ts; sockets/root under TMPDIR. Task list/create/view passed.
- Real OpenCode2.0.24 managed server23870:2observed processes before stop,0after. Real Codex0.162.0 app-server25152:6before,0after. Before/after tables retained.
- While listed/running, session list wall time131.38ms(OpenCode),138.14ms(Codex); hub status requests.slow=0 for both.
- Deliberately launched untracked real OpenCode serve30460 with project cwd/open serve.log, then SIGKILLed only hub23496. Doctor read-only reported orphan with fix 'cland hub stop, then cland hub start'. Restart ended30460 and printed its PID. Persisted running sessions intentionally survive hub replacement, so this fixture creates a true orphan without editing database state.
- Outside-project cwd canary30427 only claimed the project socket in argv. Startup explicitly preserved it as ambiguous; it survived both sweeps.
- Deleted another scratch hub's project directory. Doctor reported hub32350; doctor --fix ended it while live hub31435/canary survived. Read-only report had no other global orphan hubs before fix.
- All own hubs/servers/canary stopped, scratch removed, final process scan empty.

Full criterion per request: A-70 implementation report on this head gives378hub+91Neovim=469passes,0fail/skips; not rerun by QA.

Findings by severity: high none; medium none; low none.

Evidence A-73: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-73-t-70-qa-9209a7a-real-harness-stop-orphan-sweep-and-process-tables.zip — driver, exact commands/timings, process tables, doctor reports, journal and cleanup. OpenCode timing131.38ms corrects an earlier commentary transcription.

### rev-6 · 2026-10-09T14:14:31.747Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-70-1
commit: 9209a7a3faab30b15f1acc3829e8cb53d2568638

high (Spec) — hub/src/orphans.ts:75: only the exact running-session PID is protected; a server child of its verified wrapper/session is classified as an orphan and swept despite having a running owner. Protect and recheck each running session's process tree.

medium (Spec) — hub/src/adapters/opencode.ts:343 / hub/src/adapters/codex.ts:826: endProcess(false) is ignored, so an unverifiable live server receives no signal but Sessions.stop reports stopped and relaunch can replace it. Preserve/report the unresolved process and retain supervision until termination succeeds.

medium (Spec) — hub/src/orphans.ts:87 / hub/src/cli/hub.ts:137: the unbounded serial startup sweep runs before listeners open; sixteen TERM-resistant servers need at least 16 seconds, while the CLI kills its starting hub at 15 seconds. Bound/defer the sweep so cleanup cannot abort startup.

medium (Standards) — hub/src/system-processes.ts:26 / hub/src/system-processes.ts:84: post-await snapshot/tree processing and harness-ended logging run outside resumed timing inside adapter.stop; a 400 ms logging stretch is absent from slow-request counters. Thread the guard through that work.

low (Standards) — hub/README.md:33: the module map still refers to removed signalProcess; point to system-processes/endProcess.

Actual production orchestration with in-memory OS/process boundaries reproduced all four blocking findings; actual SQLite :memory: rows verified the false stopped outcomes. No actual processes signalled, edits or suite. TypeScript noEmit/diff check pass; working tree clean. Separate Standards/Spec review and executable probes: A-76, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-76-t-70-review-rev-6-70-1-at-9209a7a.md.

### impl-70 · 2026-10-09T14:14:48.257Z

Review fix round started for rev-6-70-1’s four points: running wrappers must protect server descendants; unverifiable stop must fail without writing stopped; sweeping must run after socket readiness with parallel bounded work; post-await harness-ended logging must be counted by the request guard. Added an integration reproduction with a real running OpenCode wrapper and its child.

### impl-70 · 2026-10-09T14:18:39.830Z

Fix round: reproduced the verified-wrapper child kill at the CLI boundary, then added running-root descendant-tree exclusion. The regression now passes. Next: failed identity verification must preserve running status and supervision, then background sweep/race and resumed-counter coverage.

### impl-70 · 2026-10-09T14:27:35.018Z

Fix milestone: the sixteen TERM-resistant orphan test reproduced the CLI 15s startup abort, then passed after deferring bounded parallel cleanup until socket readiness. The slow-launch test kills the unpublished server when reservation protection is disabled, and preserves it with the production launch/resume reservation check restored. A shared deadline settles all workers and prevents later signals. The 400ms harness-ended logging test now increments actual resumed slow-request counters.

### impl-70 · 2026-10-09T14:37:35.483Z

Final fix checks are clear: all 17 T-70 boundary tests (including real OpenCode), all 3 PID-reuse cases, doctor tests, Claude fallback/escalation and typecheck. Retaining supervision exposed a real intentional-stop crash event; reproduced it, then suppressed crash/reconnect handling only while stop is in progress and kept supervision on refusal. The five stop/refusal tests and resumed/no-sync tests pass after that fix. Starting one final plain npm test; no manual suite lock.

### impl-70 · 2026-10-09T14:48:28.505Z

Review fixes complete. Suite snapshot: 8df48efe3e3aa0ffb38a1b7bba1a786dad531a5d. Final measurement-only commit: a459ed3939e4dbeb0082224d1be375ba7a51cd90 (both read back from git log -1). Full plain npm test: 385 hub + 91 Neovim = 476 passes, no failures/skips; 368.53s, lock wait 0.01s, peak load 8.90, cleanup completed. Final scope-combining change passed typecheck and both affected request/timing tests; no second suite, per Coordinator. A-82 holds details/reproductions and file locations. No T-70 fake harnesses remain in the final read-only process scan; working tree clean; no push/merge.

### rev-6 · 2026-10-09T14:53:21.654Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-70-2
commit: a459ed3939e4dbeb0082224d1be375ba7a51cd90

medium (Standards) — hub/src/hub/worktrees.ts:212: lost-claim launch cleanup calls sessions.stop(process.name) without its available resumed guard, bypassing timing for process/tree/signal/harness-ended work on that session.launch request. Pass resumed as the second argument. Actual TaskWorktrees.launch → Sessions.stop → OpenCode/endProcess with a 400ms harness-ended consumer records zero slow requests; direct guarded stop records one.

High: none. Other medium: none. Low: none new. All four original A-76 findings and the stale README reference are fixed. Spec clear: protected descendants, retained supervision on refused stop/relaunch, background parallel bounded sweep, PID-reuse policy and intentional-stop crash suppression are implemented.

Reran A-76 pure production probes with fixed expectations: descendant child protected; unknown stop/relaunch keeps OpenCode/Codex running with no signals; direct stop logs 400ms as resumed; sixteen resistant servers take 2000ms simulated parallel time. Additional shared-deadline, late launch-reservation and unknown/running-reused/exited-reused probes pass. Inspected intentional-stop/supervision boundary tests. SQLite :memory: and mocked OS/process boundaries only; no actual signals/files/ref changes or suite. TypeScript noEmit and diff check pass.

Separate axes and executable evidence: A-84, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-84-t-70-delta-review-rev-6-70-2-at-a459ed3.md.

### qa-12 · 2026-10-09T14:54:04.001Z

verdict: qa
result: clear
by: qa-12 [qa]
run: qa-12-70-2
commit: a459ed3939e4dbeb0082224d1be375ba7a51cd90

Delta after qa-12-70-1. Read item/A-82; isolated git archive a459ed3 with T-70 node_modules, Node24.21.0. No product changes.

Ran:
- npm run typecheck:pass.
- node --test hub/test/orphan-servers.test.ts hub/test/session-async-processes.test.ts:17/17,zero failures/skips,56.43s.
- Independent real.test.mjs:1/1. Real OpenCode2.0.24 server99797 is a child of recorded wrapper99796. Both survived SIGKILL of hub99564 and restart99876; journal confirms background sweep completed without ending them. Same real harness subsequently invoked cland MCP role.state,who,task.list,status, all audited ok. Server API retained the same session ID.
- Unverifiable stop: cleared only scratch row pid_started, then actual CLI stop refused 'process identity cannot be verified; it is still watched'; row remained running and wrapper/child alive. Restored identity; ordinary stop ended both.
- True untracked real OpenCode orphan1596 left with project cwd/log after hub SIGKILL. Background restart ended it. CLI start319.30ms, status134.45ms, completed check453.80ms from start. Journal names orphan-ended and sweep completion.
- Independent race.test.mjs:1/1. Fake session creation delayed5s; production sweep saw server4367 with pending launch=true and zero published rows. Sweep ended none (123ms), server survived, same PID subsequently published running and stopped cleanly.
- Actual scratch cland task list/create/view passed. CLI commands unset CLAND_HUB_FILE/CLAND_SESSION_ID/CLAND_SESSION_NAME.
- hub status slow-request=0 in both live probes. slow-answer field absent on this branch, which predates T-71; Coordinator confirmed expected and not a finding.
- Stopped all own hubs/wrappers/servers/fakes, removed both scratch projects, final process scan empty.

No full suite repeated per request. A-82 reports476passes on8df48ef (385hub+91Neovim), with final a459ed3 measurement-only delta; this pass independently exercises final head above.

Findings by severity: high none; medium none; low none.

Evidence A-85: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-85-t-70-qa-a459ed3-wrapped-real-harness-restart-and-background-sweep-delta.zip — runnable probes, process tables, real MCP audits, journals, status/timing and cleanup.

### impl-70 · 2026-10-09T14:57:39.245Z

Final caller fix committed as c1894ab5a8e667ab8eb1354c4254447043ba8c37, read back from git log -1. Claim-conflict cleanup now forwards resumed to Sessions.stop. The actual Codex/TaskWorktrees/RequestGuard test reproduced zero slow-request records before the fix and now records exactly one for a 400ms harness-ended consumer. Typecheck and all 7 affected request/timing/worktree tests pass. No full suite, per Coordinator. A-88 is the corrected evidence artifact (supersedes A-87's placeholder commit line). Tree clean, no remaining T-70 fake harnesses, no push/merge.

### impl-70 · 2026-10-09T14:57:56.456Z

Evidence ID correction: the actual artifact returned by artifact.create is A-89, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-89-t-70-claim-conflict-cleanup-c1894ab-verification.md. It supersedes A-87. The previous comment/handoff incorrectly anticipated A-88; commit and test results are unchanged.

### rev-6 · 2026-10-09T14:59:46.510Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-70-3
commit: c1894ab5a8e667ab8eb1354c4254447043ba8c37

High: none. Medium: none. Low: none. All prior review findings are resolved.

hub/src/hub/worktrees.ts:212 now forwards resumed into lost-claim cleanup's Sessions.stop. Reran A-84's actual TaskWorktrees → Sessions → OpenCode/endProcess probe: the 400ms harness-ended consumer now records exactly one slow request, and the session stops. The added real-Codex regression verifies the winning claim remains with its holder and attributes the resumed slow-request to session.launch.

Standards and Spec both clear. Exact head verified; TypeScript noEmit and diff check pass. Read A-89's seven targeted passes. No suite, file/ref edits or actual process signals; probe uses SQLite :memory: and in-memory OS/tracker boundaries.

Separate axes and executable rerun: A-90, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-90-t-70-final-delta-review-rev-6-70-3-at-c1894ab.md.

### impl-70 · 2026-10-09T15:04:57.698Z

Rebase onto origin/dev completed; origin is the local .cland/territory.git. Resolved sessions.ts overlaps by retaining T-71's process-row subscriptions, presence/usage events and one continuous lifecycle publication scope, while retaining T-70's async identity probes, renamed-row stop, supervision/escalation and launch/resume reservation checks. Cached resume identities publish in the same scope; new identities await async ps before a guarded publication. Typecheck passes. Running T-70/T-71 session/timing/identity coverage, then one plain npm test before the authorized territory force-push.

### rev-6 · 2026-10-09T15:11:36.652Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-70-4
commit: bd9f9a00fc3e08b744d7ed29a83698f4756c8225

High: none. Medium: none. Low: none. Rebase resolution preserves both sides.

T-71's continuous publication/cleanup/watch/replay scope, process/presence/usage events and combined 200+200ms regressions survive. T-70's async identity before publication, guarded verified stop/relaunch, retained supervision, reservations and cached resume identities survive. Actual OS probes introduce an await; cached publication stays inside one scope and latest row metadata is reread.

Read-only aggregate launch probe records exactly one resumed slow-request at 400ms; async identity probe asserts reservation active and no published row before ps answers; cached resume records its continuous 600ms scope once; lost-claim cleanup still records its 400ms consumer once. TypeScript noEmit and diff check pass. No suite or file/ref edits; in-memory collaborators and SQLite :memory:, with mocked OS boundaries.

Compared requested diff, T-71 first-parent diff and range-diff. The broad old-head diff also contains T-59 and tracker updates inherited from the newer dev base; no unintended T-70 changes found. Core T-70 termination/sweep files and its tests are unchanged from c1894ab; T-71 core/events/aggregate tests are unchanged from ac932bf. Full suite was queued at the request; this review does not claim its result.

Separate axes and executable evidence: A-98, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-98-t-70-rebase-resolution-review-rev-6-70-4-at-bd9f9a0.md.

### impl-70 · 2026-10-09T15:19:41.667Z

Rebase verification complete on bd9f9a00fc3e08b744d7ed29a83698f4756c8225: preserved T-71 lifecycle timing/publication and T-70 termination/sweep protections. Typecheck passed; affected targeted tests 40/40 pass. Plain npm test passed: 439 hub + 91 Neovim = 530/530; zero failures/cancellations/skips/todo. Suite 488.25s, lock wait 212.87s, peak 1m load 8.28. Clean tree and no remaining T-70 fake harnesses. Local origin branch published and exact remote head verified. Evidence A-100: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-100-t-70-rebased-head-bd9f9a0-complete-suite-and-handoff.md

### coord · 2026-10-09T15:19:48.069Z

Merged 88fe9b7be684d76e478255e6c0fea62df42a7a6a onto dev.

### coord · 2026-10-09T15:20:13.914Z

Merged by the Coordinator through `cland merge T-70`: squash 88fe9b7 on dev, no conflict after dev moved to 29fe14f. Gate: review rev-6-70-4 clear on bd9f9a0 (no qa-required label; QA qa-12-70-2 was clear on a459ed3). impl-70's full suite on bd9f9a0: 439 hub + 91 Neovim passed, evidence A-100. impl-70 stopped. Live after the next hub restart.
