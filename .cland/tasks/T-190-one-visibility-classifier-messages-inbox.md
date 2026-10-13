---
id: T-190
kind: task
title: "One visibility classifier: messages, inbox events, sessions, items and
  artifacts placed by the default table, [visibility] overrides; thread, top bar
  and palette move onto it"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-115
blocked_by: []
topic: topic-92
branch: t/T-190-one-visibility-classifier-messages-inbox
created: 2026-10-10T16:25:05.955Z
updated: 2026-10-10T23:09:50.132Z
---

## Parent

T-115, slice 1 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

A module that places messages, inbox events, sessions, items and artifacts in a layer by the default table, overridable by `[visibility]`; the thread, the top bar and the palette move onto it.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-190 · 2026-10-10T16:55:23.615Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-2 · 2026-10-10T16:56:43.493Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-190-1 · 2026-10-10T17:36:06.942Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-190-3 · 2026-10-10T18:42:47.570Z
- [x] C2. Demo: a project's `[visibility]` raises long idles to now, and the top bar counts them.
  - done: impl-190 · 2026-10-10T16:40:37.670Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-1 · 2026-10-10T16:52:58.987Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-2 · 2026-10-10T16:56:43.493Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-190 · 2026-10-10T16:40:37.787Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-1 · 2026-10-10T16:52:59.081Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-2 · 2026-10-10T16:56:43.493Z
  - verified: rev-13 [reviewer] · run rev-13-20261010-190-1 · 2026-10-10T17:36:06.942Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - verified: rev-13 [reviewer] · run rev-13-20261011-190-1 · 2026-10-10T22:28:48.708Z
  - done: impl-190 · 2026-10-10T22:29:03.692Z

## Comments

### impl-190 · 2026-10-10T16:26:50.169Z

Implementation seams are the epic's agreed ones: real daemon frames/MCP, fake harness idle signals, then headless Neovim on the stub hub. Classifier will live in the hub: project config and authoritative needsYou are hub-owned; additive layer fields on outgoing frames let every Lua surface consume one decision without duplicating policy.

### impl-190 · 2026-10-10T16:48:55.775Z

Self-review fixes: task events publish the classifier's complete item-layer map so a current-release change updates cached palette rows without reloading; real daemon and headless regressions pass. Artifact creator role is captured at final authorized publication and retained across role changes/restart; shared verdict predicate removes duplication. T-134 message verdict exception preserved per Coordinator and annotated T-171. Focused hub visibility 5/5, headless current-release 1/1 and typecheck pass. Full suite pending.

### rev-12 · 2026-10-10T16:52:59.186Z

verdict: review
result: not clear
by: rev-12 [reviewer]
run: rev-12-20261010-190-1
commit: 98be6204465c684b990bc9d0014b49ead556b02f

Medium — hub/src/hub/visibility.ts:174: session.state classification omits authoritative process status. Stop/exit publishes a background session.process, then state unknown, which falls back to idle/watch (now with sessions.idle="now"). nvim/lua/cland/state.lua:395 overwrites the cached terminal process layer, leaving it undimmed and potentially counted as now until refresh. §3.5 requires stopped sessions background. Include terminal status in state-event classification, preserve the Aide exception, and cover stop/exit live updates through fake harness/headless UI.

Standards: no material findings. Other requested classification/override consumers, task-layer refresh and artifact-role capture are supported. Authorized T-134/T-169/T-171 steering remains intact. C2/C3 verified separately; C1 failed. Independent typecheck/diff check passed, and direct read-only classifier probes confirmed the conflicting terminal projections. C4 remains unverified pending full suite; writing E2E tests were inspected rather than independently rerun.

Review A-672: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-672-t-190-review-at-98be620-terminal-session-layers-regress.md.

Criteria: C1 failed (Terminal session.state frames omit process status and overwrite stopped/exited background layers with idle/watch or now, breaking live palette dimming and session counts.).

### impl-190 · 2026-10-10T16:54:50.220Z

Review rev-12-20261010-190-1 reproduced with real fake-harness stop/exit and headless palette/session-count regressions: a following unknown state event lost terminal process facts and became now under sessions.idle="now". Classifier state projection now uses authoritative cached status and launch role; Aide terminal exception retained. Targeted verification underway; full-suite result for 98be620 remains pending and will not establish the new head.

### rev-12 · 2026-10-10T16:56:43.493Z

verdict: review
result: clear
by: rev-12 [reviewer]
run: rev-12-20261010-190-2
commit: 23707720396c1c969d7eb4ca184d1f85e3439bfe

No remaining high or medium findings. A-672 is fixed: session.state projections use cached process status/role by sessionId, preserving stopped/exited Implementer background placement and the stopped-Aide exception. Process publication refreshes those facts across role changes/resume. Daemon/fake-harness and headless regressions cover stop/exit/Aide layers, cached palette dimming and session counts. Separate Standards and Spec delta reviews found no material issues; prior full-item checks remain applicable.

C1–C3 verified. Independent typecheck, diff check and read-only terminal-classifier probes passed at 2370772. A-673 reports daemon 3/3 and headless 3/3 targeted tests green; writing E2E tests were inspected rather than independently rerun in reviewer sandbox. C4 remains unverified pending the full suite on this head.

Review A-675: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-675-t-190-re-review-at-2370772-terminal-session-fix-clear.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-190 · 2026-10-10T17:34:17.765Z

Full-suite A-691 at 2370772: typecheck clean, hub 1028/1030 pass; final-removal task event's layers:{} regression fixed at d611a3752d2818e97c709e8e40f41d4deeee4a51, optional map now omitted for empty item index and documented. Exact tracker regression and populated live-layer-map regression both pass, plus typecheck. Request-guard timing failure left unchanged as T-172 per Coordinator. Delta review requested from rev-13 citing prior clear A-675; fresh full suite pending.

### rev-13 · 2026-10-10T17:36:06.942Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-190-1
commit: d611a3752d2818e97c709e8e40f41d4deeee4a51

No high or medium findings in the requested 2370772...d611a37 delta. The empty-index guard (hub/src/hub/visibility.ts:174) preserves the exact final-removal frame while populated maps and current-release reclassification remain intact; the Lua consumer independently removes the cached item. Documentation matches. Separate Standards and Spec reviews found no issues.

Independent typecheck, git diff --check and direct read-only classifier probes passed. Exact tracker-removal and populated-map integration regressions inspected; A-692 reports both passing after the fix. C1 verified for this delta; C3 verified. C2 retains prior A-675 verification and is unaffected. C4 unverified pending fresh full suite at this head; unchanged request-guard timing failure is outside this delta per T-172 steering.

Review A-693: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-693-t-190-delta-review-d611a37-empty-map-correction-clear.md.

Criteria: C1 verified, C3 verified.

### rev-13 · 2026-10-10T18:39:07.656Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261010-190-2
commit: d611a3752d2818e97c709e8e40f41d4deeee4a51

Medium — nvim/test/palette.test.ts:86: session chip expects 2 and receives 1; the expectation/fixture must match now-layer counts while preserving live transitions.
Medium — nvim/test/palette.test.ts:303: split topic content wait times out; the classified message is folded.
Medium — qa/cases/PANELS-009.lua:22: now count/waiting-chip QA assertion fails.
Medium — nvim/test/qa.test.ts:96: THREAD-005 and THREAD-006 both fail closed-message fold-count assertions (8 folded in evidence).
Medium — nvim/test/thread.test.ts:685: retained-answer history has 0 messages rather than 200.

C4 failed. A-710 has typecheck exit 0; hub 1029/1030 with only request-guard's 584ms timing failure, then sequential Neovim 231/237 with six failures. The request's T-172-only exception cannot cover these additional failures. Resolve the policy-specific fixture/expectation or implementation issues while retaining meaningful behavior coverage; re-review any delta and validate the final head. Prior C1–C3 marks remain; no new failure assigned to them solely from these possibly outdated assertions.

Review A-712: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-712-t-190-c4-review-d611a37-six-neovim-failures-remain.md. Full writing suite inspected from durable log, not independently rerun in read-only sandbox.

Criteria: C4 failed (A-710 Neovim phase failed 6/237 tests beyond the authorized unchanged T-172 request-guard timing exception.).

### impl-190 · 2026-10-10T18:41:31.981Z

C4 findings from A-712 resolved at eeb4b3ae16354ea00e1d2ab76f6c1305d017bd07: six headless checks pass after now-only chip expectations, Coordinator-to-human split metadata, hub-side Aide fixture presence and deterministic held/released retention history. Existing fold boundaries/counts, selection/live updates and standalone-answer assertions retained. No production policy change. Typecheck/diff check pass; delta review and fresh final-head full-suite validation requested.

### rev-13 · 2026-10-10T18:42:47.570Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-190-3
commit: eeb4b3ae16354ea00e1d2ab76f6c1305d017bd07

No high or medium findings in d611a37...eeb4b3a. The fixture/expectation delta matches the classifier contract without weakening behavior coverage: now-only chip with idle transition assertion, split history/live report metadata, hub-known Aide recipient before projection with seven never-fold boundaries, and explicit history hold/release before retention eviction. The unique append marker and all window/standalone-answer/day-rule/delivery assertions remain. No production policy changes. Separate Standards and Spec delta reviews found no issues.

Independent typecheck/diff check and read-only classifier probes passed. The lead reports six focused headless checks passing; writing tests inspected rather than independently rerun in read-only sandbox. C1 verified for coverage; C2/C3 prior verification remains applicable. C4's failed mark from A-712 remains pending final-head package evidence; it is not verified by focused checks.

Review A-717: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-717-t-190-delta-review-eeb4b3a-behavior-coverage-preserved.md.

Criteria: C1 verified.

### rev-13 · 2026-10-10T19:25:47.166Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261010-190-4
commit: eeb4b3ae16354ea00e1d2ab76f6c1305d017bd07

C4 verified under the explicit Coordinator T-172 timing exception. A-719 records typecheck exit 0 and hub 1029/1030, with only the unchanged request-guard other-client 573ms assertion (hub/test/request-guard.test.ts:59). Coordinator message 440fd410-3cfe-4060-9f47-38b0d48081f5 independently confirmed: if request-guard is the only failure, rev-13 may accept C4 citing T-172. The fairness cancellation occurred before Neovim tests; its authorized same-head relaunch A-723 is complete: npm run test:nvim exit 0, 237/237, zero failed/cancelled/skipped/todo. All six previous Neovim failures pass. This is acceptance under the named exception, not a claim that npm test itself exited 0.

No new high or medium findings or code delta. Clean unchanged head matches A-717; prior C1–C3 and separate Standards/Spec reviews A-675/A-693/A-717 remain applicable. Full writing suite evidence inspected, not independently rerun in the read-only sandbox. C4 was marked done again by the lead against these logs, clearing A-712's stale failure.

Review A-724: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-724-t-190-final-c4-review-eeb4b3a-clear-under-t-172-exception.md.

Criteria: C4 verified.

### impl-190 · 2026-10-10T19:26:23.846Z

Final-head validation at eeb4b3a: A-719 typecheck passed and hub 1029/1030, sole unchanged T-172 request-guard 573ms timing failure under confirmed Coordinator 440fd410 exception; A-723 Neovim fairness relaunch 237/237. C4 done and verified by rev-13-20261010-190-4 (A-724); prior C1-C3 verifications carry forward. Final handover artifact records hub ownership rationale, exact [visibility]/inbox.idle instance lines, policy exceptions, docs, commit heads and durable validation paths.

### impl-190 · 2026-10-10T19:29:40.738Z

Merged fetched origin/dev 3c77313 into the task branch at e512ec2; pushed local origin, clean worktree. Daemon retains crew and visibility; Lua uses hub placement; thread retains dev’s coordinator/crew cases plus T-190 hub fixture/age behavior. Targeted visibility 8/8, daemon 14/14, thread 23/23 and typecheck pass. Delta review requested from rev-13; fresh full suite on merge head pending.

### rev-13 · 2026-10-10T20:30:59.046Z

verdict: review
result: not clear
by: rev-13 [reviewer]
run: rev-13-20261010-190-5
commit: e512ec22d8583aa4cc0db0ae529441c587110d7d

Medium — nvim/test/shell.test.ts:651 (hub/test/process-cleanup.ts:165): Terminal-mode test teardown fails with kill EPERM; establish cause and repair/validate cleanup.
Medium — nvim/test/vboard.test.ts:178: rank-operation assertion receives undefined instead of T-14; establish fixture/implementation cause while retaining meaningful reorder/cursor/operation checks.

C4 failed. A-779 typecheck0,hub1050/1051 with sole unchanged request-guard511ms timing failure; sequential Neovim237/239,2fail,zero cancel/skip/todo. Coordinator440fd410 T-172 exception cannot cover extra Neovim failures. Prior C1–C3 and merge integration A-730 remain supported; prior A-724 C4 applies only to eeb4b3a. Durable writing-suite evidence inspected rather than rerun in readonly sandbox.

Review A-783: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-783-t-190-merged-head-c4-at-e512ec2-two-neovim-failures.md.

Criteria: C4 failed (A-779 merged-head Neovim237/239 has Terminal teardown kill EPERM and vboard rank-operation assertion failure beyond the T-172-only hub exception.).

### impl-190 · 2026-10-10T20:35:05.695Z

A-783 rank failure reproduced in isolated run: early snapshot T/J only, later correct K before:T-14 with cursor unchanged. Fix a3cd609 uses existing held rank-result barriers and changed sibling-order wait; original operation/authoritative-event/cursor/refusal assertions retained. Eight rank repetitions pass. Fresh fetched dev 8783ac3 merged cleanly at 788114a (T-187 plan view/T-196 epic QA); pushed, clean worktree. Final-head typecheck, classifier 8/8 and entire vboard 7/7 pass. A-787 captures diagnosis. Unchanged Terminal teardown EPERM left to T-172 per Coordinator 4f29764f; fresh full suite pending.

### rev-13 · 2026-10-10T22:28:48.708Z

verdict: review
result: clear
by: rev-13 [reviewer]
run: rev-13-20261011-190-1
commit: 788114ab082e4746504b8065d4a0c5c12cc632ce

No remaining high or medium findings. C4 verified under Coordinator4f29764f's explicit T-172 exception. A-850: typecheck0; hub1063/1064 with sole unchanged request-guard578ms timing assertion at hub/test/request-guard.test.ts:59; sequential Neovim243/243 exit0. Both phases zero cancelled/skipped/todo; rank correction and Terminal test pass. This is named-exception acceptance; npm test itself exited1.

Clean unchanged reviewed head; prior C1–C3 and separate Standards/Spec integration A-730/A-788 stand. A-783's C4 failure is superseded by complete corrected-head evidence. Writing suite inspected rather than rerun. Claimant C4 done mark remains separate if absent.

Review A-851: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-851-t-190-final-c4-at-788114a-clear-under-t-172-timing-exception.md.

Criteria: C4 verified.

### coord · 2026-10-10T22:29:12.731Z

Merged 59742a3f42b2adb868b2e268cc88c04a216f67fc onto dev.
