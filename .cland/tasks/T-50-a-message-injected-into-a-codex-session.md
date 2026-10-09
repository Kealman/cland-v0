---
id: T-50
kind: task
title: A message injected into a Codex session in the last second of its turn is marked injected but never acted on
state: open
labels:
  - slice-1
  - ready-for-agent
assignee: impl-50
parent: T-19
blocked_by: []
topic: topic-9
branch: t/T-50-steer-lost-at-turn-end
created: 2026-10-09T07:04:04.157Z
updated: 2026-10-09T09:38:41.809Z
---

## Parent

Part of T-19. Seen once by impl-48 while building T-48 (2026-10-09, a real Codex 0.160.0 session launched by its own hub): a message steered into the session's clause turn about a second before that turn ended was recorded by the hub as `injected`, and the session never acted on it.

## What is known

- The hub's delivery stages are queued, delivered, injected; `injected` means the harness confirmed the inject (hub/README.md, the Codex adapter: `turn/start` or steer into the running turn).
- Not reproduced. The suspicion: a steer accepted by the app-server at the very end of a turn is dropped with the turn, while the hub counts the acceptance as injected.

## What to do

- Reproduce against the fake app-server first (a steer accepted while the turn is completing), then once against the real Codex if the fake does not show it.
- If real: the adapter must not report `injected` for a steer the turn did not consume (re-deliver as a new turn when the turn ends without it), or the hub must re-queue the message when the session goes idle with an unconsumed inject.

## Acceptance criteria

- [ ] A test shows a message delivered in the last moment of a turn is acted on in the next turn, or stays `delivered` (never `injected`) until it is
- [ ] `hub/README.md` says what `injected` guarantees for Codex
- [ ] `npm run typecheck && npm test` pass

## Comments

### impl-48 · 2026-10-09T08:43:37.444Z

Done on `t/T-50-steer-lost-at-turn-end` (worktree `.cland/worktrees/T-50`, from main b8368b3): 86e877a (the change and its test), 4c1f7cd (docs). Not pushed.

**The original observation was not a lost steer.** I re-read what I saw in T-48: the steered message was among the inputs of the session's clause turn, and that turn had failed with `failed to load workspace requirements` (the T-48 profile bug of that moment). The session did not act because its turn failed, not because the steer was dropped. T-46's failed-turn notice covers that case today.

**What the app-server guarantees, measured** (Codex 0.160.0, a bare app-server, 11 steers sent 5 to 120 ms after a turn's final answer, and one at the final answer):
- Accepted (`{turnId}`): the steer becomes a `userMessage` item of the turn (announced with `item/completed`), the turn goes on and the model answers it. 8 of 8.
- Too late: `no active turn to steer`, from about 1 ms before the `turn/completed` notification onwards. 4 of 4. The adapter already turns that into a `turn/start`.
- None was accepted and lost. `turn/completed` itself lists no inputs (`items: []`); `thread/read {includeTurns: true}` does.

**What changed**: the adapter holds each accepted steer as owed until the turn announces it among its inputs. A turn that ends well with one still owed is read back, and what is not among its inputs is handed over again as a `turn/start` of its own (everything owed, when the turn cannot be read): possibly twice, never not at all. Log and journal: `harness-redelivered`; Agents: `redelivered`; a redelivery that fails is reported as a failed turn. A failed turn is not redelivered (T-46 reports its messages).

**Not as the brief preferred**: the stage is still `injected` at the steer's acceptance, not held at `delivered` until the turn takes it up. A turn takes a steer up at its next step, which can be minutes into a long command; waiting for that would turn ordinary steers into timeouts and `uncertain` deliveries. Since acceptance was never seen to lose a steer, I kept the stage and added the guard.

**Tests**: typecheck clean; hub 270 passed, Neovim 62 passed, 0 failed, 0 skipped (run before the docs commit). New: the fake accepts a steer and drops it; the message is answered in a turn of its own, once; a steer the turn takes up is not redelivered; the journal and Agents records.

**Real Codex through the hub** (scratch hub on this branch, a launched QA session, a message sent 4 s into its clause turn, as in T-48): `harness-steered`, `injected`, the session answered in that turn 9 s later, no redelivery.

**Left out**: a steer that lands in a turn which then fails is reported, not re-sent (T-46's rule). The redelivery path was exercised only with the fake: the real app-server never produced the case.

### coord · 2026-10-09T08:44:20.844Z

Implementer report (impl-48, Claude Code claude-opus-5-5, 08:43Z): 86e877a (change and test) and 4c1f7cd (docs) on `t/T-50-steer-lost-at-turn-end` from main b8368b3. Correction of the original observation: the T-48 case was not a lost steer; the steered message was among the clause turn's inputs and that turn had failed (the profile bug of that moment), which T-46's failed-turn notice now reports. Measured on Codex 0.160.0 with 12 real steers around a turn's end: an accepted steer is taken up by the turn (8 of 8); a late steer is refused with "no active turn to steer" (4 of 4), which the adapter turns into a new turn; `turn/completed` lists no inputs, `thread/read` does. Change: the adapter holds each accepted steer as owed until the turn announces it among its inputs; a turn that ends well with one still owed is read back and the missing message is delivered again as a turn of its own (possibly twice, never not at all); journal `harness-redelivered`, an Agents `redelivered` record, a failed redelivery reported like a failed turn. Tests: typecheck clean, 270 hub + 62 Neovim, 0 skipped; real Codex through a scratch hub: a message steered 4 s into the clause turn was answered in that turn, no redelivery. Accepted deviations: the stage stays `injected` at acceptance (waiting for the turn's next step would turn ordinary steers into timeouts), with the README stating the guarantee; the redelivery path is proven at the fake seam only. Review requested from rev-3 at 08:45Z; QA from a fresh session under the new policy. The branch meets T-51's in codex.ts and the fake app-server: main merges forward after T-51 lands.

### qa-6 · 2026-10-09T09:00:07.320Z

verdict: qa
result: not clear
by: qa-6 [qa]
run: qa-2026-10-09-6-T50-4c1f7cd

Checked branch t/T-50-steer-lost-at-turn-end at 4c1f7cdb0651519abb141129a858c5afe15c982c (86e877a change/test, 4c1f7cd docs). Working tree remained clean; no product fixes made.

Ran:
- task.view T-50 and topic-9 history, including the Coordinator's accepted deviations.
- `node hub/bin/cland.ts task list --state open --json` and `node hub/bin/cland.ts task view T-50 --json`: both succeeded; T-50 present on the expected branch.
- `npm run typecheck && npm test` once: typecheck passed; hub 270 total / 263 passed / 0 failed / 7 skipped; Neovim 62 total / 61 passed / 1 failed / 0 skipped. Six hub skips require ps identity checks; one requires nested sandbox-exec. The additional ps-dependent CLI permissions test explains the difference from docs' six-skip count.
- `node --test hub/test/codex-adapter.test.ts` (exercises the changed fake app-server): 9 total / 8 passed / 0 failed / 1 ps-dependent skip. Accepted-and-consumed steer not redelivered; accepted-and-dropped steer answered once; Agents redelivered record verified.
- `node --test --test-name-pattern='the tree follows task events' nvim/test/shell.test.ts`: isolated rerun of the sole full-suite failure passed (1/1). The Neovim harness uses nvim_input and screenstring.
- `node --test --test-name-pattern='QA probe:' /tmp/qa-T50-probes/probe.test.ts`: 2/2 passed. Scratch fixture only: forced the recovery turn/start to refuse. Verified actual .cland/journal.jsonl harness-redelivered on success; harness-redelivery-failed plus turn-failed in Agents and inbox on refusal.
- Read hub/README.md:592 and recovery code. Documentation matches accepted semantics: injected records app-server acceptance; inputs establish uptake; completed successful turns with missing inputs are read back and missing messages redelivered; failed turns are reported. This is the Coordinator-approved deviation from waiting at delivered.

Findings:
- medium: `npm run typecheck && npm test` did not pass. nvim/test/shell.test.ts:1142 timed out after 10000 ms waiting for T-13 to disappear. Captured screen showed the original list restored (T-13 present, T-14 absent, T-7 claim absent), despite earlier update assertions passing. Isolated rerun passed. This is an unresolved full-run failure in unchanged Neovim code, not established as a T-50 regression.
- medium: hub/test/codex-adapter.test.ts:426 covers successful recovery only; no committed test exercises the new recovery request failure path at hub/src/adapters/codex.ts:573 and verifies its journal/Agents/inbox reporting. My temporary probe passed, so no runtime defect was observed in that path, but the branch lacks regression protection requested in this brief.
- low: hub/test/codex-adapter.test.ts:450 reads hub.log while the test claims journal coverage. My separate actual-journal probe passed; this is an assertion gap, not a missing record.
- low: no explicit test found anywhere under hub's *test.ts for exact `no active turn to steer` refusal becoming a new turn. That fallback predates T-50. The pending-steer rejection test exercises a different refusal string.

Evidence limits: a nested real Codex app-server cannot run under this QA policy, so I did not independently repeat real-Codex measurements. Relying on impl-48's item report: Codex 0.160.0 accepted 8/8 steers and consumed them; refused 4/4 late steers; real through-hub steer answered in the same turn. Actual accepted-but-dropped recovery is proven only at the fake boundary, as accepted by the Coordinator.

Evidence files: /tmp/qa-T50-full.log, /tmp/qa-T50-focused.log, /tmp/qa-T50-nvim-recheck.log, /tmp/qa-T50-probes.log; scratch probe and fixture under /tmp/qa-T50-probes/. CLI outputs: /tmp/qa-T50-list.json and /tmp/qa-T50-view.json.

### rev-3 · 2026-10-09T09:00:32.372Z

verdict: review
result: not clear
by: rev-3 [reviewer]
run: rev-20261009-50-4c1f7cd

Reviewed pinned head 4c1f7cd against b8368b3, T-50 and the Coordinator's accepted deviations. Rechecked the unchanged head after relaunch; no new sub-agent threads in this turn. Three medium findings remain.

Medium (Spec and documented contract) — hub/src/adapters/codex.ts:618: Pending steers enter #steers before acceptance, and successful completion starts recovery at line 409 without waiting for admission. Readback can finish and line 569 replay the message before its original steer RPC is rejected or times out. That violates the requirement to track accepted steers and the documented rule that uncertain injections are never replayed on their own (contract.ts:143; README contract/inject rows). Reconcile admission with completion before recovery, preserving consumption evidence; cover successful completion before late rejection/timeout.

Medium (Spec) — hub/src/adapters/codex.ts:567: Another turn can start during readback; turn/start with input then steers that active turn, as the existing inject path documents. Redelivery never registers this envelope in #steers. If the newer turn also accepts/drops it, its completion finds no obligation and the message is permanently lost, contrary to 'possibly twice, never not at all' and redelivery as a new turn. Queue a separate turn or retain bounded obligation tracking with a surfaced failure outcome; cover an active newer turn during readback.

Medium (Spec) — hub/src/adapters/codex.ts:569: Redelivery bypasses #admissions. If its turn fails before the turn/start reply, completion reports no input messages and retains no completed-turn record; late #admitInput creates an orphan entry and never notifies the original sender. Use normal admission reconciliation; cover failure-before-redelivery-response. The new fake test covers consumed/missing steers and successful replay, but these orderings and failed redelivery are not covered.

Read-only in-memory evaluation of the branch's actual methods in my main thread confirmed all three: one turn/start before the original RPC became InjectUncertain; replay into T1 left no owed entry and no recovery on T1 completion; failed T1 before its response emitted failure with messages [] and left orphan turnInputs S:T1=[M], no sender notification. These are control-flow evaluations, not harness integration-suite runs.

Standards: 1 medium documented-contract violation (the first finding), 0 actionable heuristic smells. Spec: 3 medium findings. Ordinary journal/Agents recovery, approved injected-at-acceptance stage and README otherwise match the decisions. No .cland/tasks changes; git diff --check passed. No edits or full-suite rerun. Earlier status/task.comment failed with 'this spoke was replaced ... it will not reconnect'; the earlier verdict was not recorded. Current hub reads/send succeeded after relaunch. Git reads succeeded with the documented Xcode cache warnings.

### impl-50 · 2026-10-09T09:02:01.389Z

Fix round: reproducing review's pending-admission, active-newer-turn and failure-before-response races at the assigned fake app-server seam. Will add committed recovery failure and actual journal assertions; preserve injected-at-acceptance semantics.

### impl-50 · 2026-10-09T09:10:35.581Z

Reproduced all three review races through the assigned fake app-server boundary: pending requests were replayed before acceptance (2 red tests), recovery dropped in a newer turn was lost (red timeout), and recovery failure before reply omitted sender notice (red timeout). Fixed with accepted-only obligations, pending uptake evidence keyed by turn, common admission reconciliation for recovery, and bounded recovery attempts with visible failure. Focused newer-turn/failure-before-response tests now 2/2 pass; request-refusal journal/Agents/inbox/sender regression 1/1 pass. Actual-journal assertion corrected. Remaining coverage and full suite underway. Note: impl-48's d1c9db1 captured my in-progress edits as well as its README tweak; preserving it per Coordinator.

### impl-50 · 2026-10-09T09:18:38.307Z

Fix round complete on t/T-50-steer-lost-at-turn-end at 735248d (clean worktree), atop d1c9db1. Review d1c9db1 + 735248d together against 4c1f7cd: impl-48's last commit swept part of my in-progress adapter/test/fake edits into its README commit; preserved per Coordinator.

Resolved review findings: an input becomes owed only after the RPC accepts it, with early consumption evidence preserved by actual turn id; completion before late acceptance/rejection/timeout reconciles without replaying uncertain admissions. Accepted recovery into a newer active turn retains its obligation; after two accepted recovery attempts still missing, failure is surfaced rather than looping. Recovery shares the original admission reconciliation, so failure before its reply notifies the original sender and creates no orphan turnInputs entry. Recovery request errors are journalled, shown in Agents/inbox, and notify senders. Actual destination/turn is journalled and Agents says when recovery joined a running turn.

Coverage: nine new fake-boundary tests for pending timeouts, late rejected/accepted/consumed/dropped steers, newer active turn during readback, failed recovery before response, refused recovery request, bounded repeated drops. Existing successful recovery test now reads .cland/journal.jsonl, not hub.log. README documents accepted-only tracking, shared reconciliation, newer-turn obligations and the bound. The injected-at-acceptance and fake-only recovery decisions remain unchanged.

Validation: npm run typecheck passed. Focused adapter + delivery suites: 23 total, 22 passed, 0 failed, 1 ps-dependent skip. Full npm run typecheck && npm test: hub 279 total, 272 passed, 0 failed, 7 documented sandbox skips; Neovim 62 total, 61 passed, 1 timeout, 0 skipped. The unchanged nvim/test/shell.test.ts:647 case ('a session.state unknown event shows unknown; a process that died shows unknown · died') timed out waiting for coord-1 unknown; isolated rerun passed 1/1 in 384 ms. Thus the full command exited 1 despite all T-50 checks passing; no unrelated Neovim fix made. git diff --check passed.

Evidence: /tmp/impl-T50-pending-red.log, /tmp/impl-T50-newer-red.log, /tmp/impl-T50-early-failure-red.log (the last reproduced prior recovery bookkeeping by temporarily removing only recovery admission registration, then restored it), /tmp/impl-T50-focused-final.log, /tmp/impl-T50-full.log, /tmp/impl-T50-nvim-recheck.log. No new real-Codex run: nested app-server is outside this sandbox's policy; prior measurements remain on this item. No merge or push; no tracker files edited in this worktree.

### rev-4 · 2026-10-09T09:24:36.830Z

verdict: review
result: clear
by: rev-4 [reviewer]
run: rev-20261009-50-735248d

Reviewed pinned head 735248d3d5dfa724ee1eb8313647b95c9d3f974a: d1c9db1 and 735248d together against 4c1f7cd, plus the full change against merge-base b8368b30ac10ac892422c272831aafeedfed625d. Read T-50, both earlier verdicts, measurements and the Coordinator's accepted deviations. Main thread only; no implementation edits.

High: none found.
Medium: none found in the reviewed implementation. All three prior review races are resolved.
Low (Spec/docs) — hub/README.md:329: the Agents table still describes redelivery only as a new turn, although recovery can now join a running turn; the detailed inject paragraph correctly explains both outcomes.

Standards: no remaining documented-contract violation or actionable smell finding. Spec: accepted-only obligations preserve early uptake by actual turn id; completion before the reply is retained for admission reconciliation. Timeout/uncertain admission creates no replay obligation. A recovery accepted into a newer turn is tracked there with its recovery count, with failure surfaced after two accepted recoveries still missing. Recovery uses #withAdmission/#acceptedInput/#admitInput, so failed completion before its response notifies the original sender and does not create an orphan input entry.

The nine new committed fake-boundary regressions cover two pending requests crossing the timeout, late rejection/consumed acceptance/dropped acceptance, recovery into a newer turn, recovery failure before its response, request refusal, and bounded repeated drops. The refusal regression checks actual journal harness-redelivery-failed, no successful-redelivery record, Agents, inbox and sender notice. The earlier successful-recovery assertion now reads .cland/journal.jsonl. Journal filtering and the Agents turn-failed → inbox path include the recovery failure event. README retains injected-at-acceptance semantics and documents pending uncertainty, uptake, newer-turn recovery and the bound.

Independent read-only evaluation of the extracted notification/admission/recovery methods passed eight deterministic cases with stubbed RPC responses: pending timeout; late rejection; consumed and dropped late acceptance; recovery accepted/dropped in a newer turn then consumed; failure before recovery reply; recovery refusal; and repeated drops ending after two recoveries. No premature replay, orphan turnInputs, remaining obligation, or admission entry remained in these cases; sender notification arrived for early failure/refusal/bounded exhaustion. This is control-flow evidence, not a harness integration run.

Both diff checks passed; the reviewed worktree was clean at the pinned head. No suite rerun in the Reviewer sandbox. Current-head typecheck, 272 hub passes with 7 skips, and 61 Neovim passes plus one unchanged timeout passing alone are Implementer-reported evidence. The full npm run typecheck && npm test command remains reported exit 1; its full-run acceptance criterion is therefore not established by this review, despite no T-50 regression found.

### impl-50 · 2026-10-09T09:25:59.168Z

Resolved review's low documentation finding in 9776a85: hub/README.md's redelivered notice table now covers a new turn or a newer running turn and says the notice identifies the destination. Documentation-only change; git diff --check passed. Prior implementation/test results unchanged; worktree clean.

### impl-50 · 2026-10-09T09:26:11.038Z

Correction to my preceding comment: the documentation commit is 9fa1656, not 9776a85 (mistyped before reading the command result). Verified HEAD and clean worktree; the description of the change is unchanged.

### qa-10 · 2026-10-09T09:38:41.809Z

verdict: qa
result: clear
by: qa-10 [qa]
run: qa-2026-10-09-10-T50-9fa1656

Checked branch t/T-50-steer-lost-at-turn-end at 9fa165632901a963207bea56cf17bc28dcdc2431 (fix round d1c9db1 + 735248d, documentation 9fa1656). Working tree remained clean; no product changes made.

Ran:
- task.view T-50: read original QA/review findings, fix-round report, clear review and accepted deviations.
- `node hub/bin/cland.ts task list --state open --json` and `node hub/bin/cland.ts task view T-50 --json`: succeeded; T-50 present with expected branch.
- `npm run typecheck && npm test` once: exit 0. Typecheck passed. Hub 279 total / 272 passed / 0 failed / 7 skipped (six ps-dependent cases, one nested sandbox-exec case). Neovim 62 total / 62 passed / 0 failed / 0 skipped, using the project's headless harness with nvim_input and screenstring(). Hub duration 508.7 s, Neovim 48.0 s under high machine load (sampled load average 112.86). No timing failures or isolated reruns needed.
- `node --test hub/test/codex-adapter.test.ts hub/test/codex-delivery.test.ts`: 23 total / 22 passed / 0 failed / 1 ps-dependent skip, 56.9 s. The adapter harness launches the fake app-server at the external process boundary.
- Read all nine new adapter regressions and their fake controls: pending timeout (two cases); late rejection, consumed acceptance and dropped acceptance; recovery accepted/dropped in a newer turn; failed recovery before its response; request refusal; bounded repeated drops. All passed both in the full suite and focused run.
- Verified hub/test/codex-adapter.test.ts:450 reads .cland/journal.jsonl for successful recovery. The refusal test at :540 verifies actual journal harness-redelivery-failed, absence of harness-redelivered, Agents turn-failed, inbox notification and original sender notice. The late-rejection fixture returns exact `no active turn to steer` and the regression proves fallback is answered once.
- Read hub/README.md:592: injected guarantees app-server acceptance; only accepted inputs become owed; pending/uncertain requests are not replayed; uptake and completion before admission reconcile; accepted recovery into a newer turn stays tracked; two missing accepted recoveries end in surfaced failure. README:329 now correctly describes both new-turn and running-turn destinations.
- `git diff --check` and final `git status --short`: clean. Scratch-hub harness strips inherited CLAND_* variables; no management commands were run against the project's live hub.

Findings, ranked by severity:
- High: none.
- Medium: none.
- Low: none. The earlier QA assertion/coverage gaps and review's README table mismatch are resolved; the earlier Neovim timeout did not recur.

Evidence limits: sandbox skips are not passes. A nested real Codex app-server cannot run under this role profile, so this pass did not repeat impl-48's real-Codex measurements. Accepted-but-dropped recovery remains proven at the fake boundary, as accepted by the Coordinator. The injected-at-acceptance semantics remain the approved deviation.

Evidence: /tmp/qa-10-T50-full.log (npm test output), /tmp/qa-10-T50-focused.log; CLI outputs /tmp/qa-10-T50-list.json and /tmp/qa-10-T50-view.json. Typecheck success and both command exit codes were observed directly in the shell tool output.
