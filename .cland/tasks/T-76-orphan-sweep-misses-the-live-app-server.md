---
id: T-76
kind: task
title: Orphan sweep misses the live app-server of a session recorded as exited
state: open
labels:
  - ready-for-agent
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: topic-33
branch: t/T-76-orphan-sweep-misses-the-live-app-server
created: 2026-10-09T16:38:16.092Z
updated: 2026-10-09T19:16:16.200Z
---

## Parent

Part of T-19, a follow-up to T-70. Found by the human's stand-in at the 16:37Z restart on 2026-10-09 (hub pid 14410).

## What happened

`cland doctor` warned "orphan harness pid 5067: no running session owns it": rev-7's Codex app-server, whose session the hub recorded as exited/offline. T-70's startup sweep did not end it, because the session row still existed. `cland session stop rev-7` ended it by hand.

## What to build

- The startup sweep, and `cland doctor --fix`, treat a harness server whose session is not `running` (exited, offline or stopped) as an orphan, with the same ownership proof T-70 uses: pid plus start time, and cwd or descent from a verified wrapper.
- Doctor's warning names the session that owned it and the fix command.

## Acceptance criteria

- [ ] A fake Codex app-server left alive behind a session recorded as exited is ended by `cland hub start` and reported by `cland doctor`, which names the session.
- [ ] A running session's server still survives the sweep.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Follow T-70's ownership rules (A-96, class D).

## Comments

### coord · 2026-10-09T17:34:33.220Z

Added scope, from impl-74 on T-74 at 17:34Z. The `cland doctor --fix` tests act machine-wide: one test's doctor ends the hub of another fixture whose project folder was deleted. They interfere when two of those test files run side by side, which happened during T-74's head and base comparison. While fixing the sweep, make doctor --fix's test fixtures isolated, for example by scoping the sweep under test to a fixture root, so parallel runs cannot end each other's hubs.

### impl-76 · 2026-10-09T17:59:00.366Z

Confirmed seams with Coordinator. Red regression: node --test --test-name-pattern='doctor names an exited' hub/test/orphan-servers.test.ts fails because the orphan warning omits session impl (exited) and recommends restart rather than doctor --fix. Discovery already reports this exited fake on current dev; doctor --fix currently only sweeps deleted-project hubs. Ranked checks: (1) missing session diagnostics/fix dispatch explains the observed CLI failure; (2) status filtering at startup would explain a server surviving despite discovery; (3) fallback log/socket hints may bypass a stale/unknown recorded identity. Following the real-process seams to distinguish them.

### impl-76 · 2026-10-09T18:06:01.605Z

Real-process regressions now cover unknown recorded start time, reused PID, all non-running statuses, and an offline wrapper with a server child outside the project cwd. The two doctor files passed concurrently (6 selected tests, 0 failures); deleted-project discovery uses a fixture cwd scope, so one doctor cannot enter another fixture. Added harness cleanup in doctor --fix also exposed a spawn-to-row race with a live hub (red test killed the unpublished fake); external sweeps now preserve unpublished servers while a verified hub holds the project lock. The hub's background sweep retains its pending-launch callback and shared deadline. Typecheck is green; running the complete orphan/doctor-isolation files before review.

### rev-65 · 2026-10-09T18:15:59.670Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-76-1
commit: ae7af32ab251187e4452a1bcf66fedb65145349a

High — hub/src/cli/doctor.ts:32, shared hub/src/system-processes.ts:100–107: the new harness sweep calls a helper that plans a group signal before awaiting PID-start probes; an unowned process joining the PGID during those awaits receives SIGKILL because only the original members are checked and canSignal receives the stale snapshot. Deterministic pinned-source virtual probe reproduced this. The helper is unchanged by T-76, but this inherited gap violates the request's explicit group-ownership invariant on the new doctor cleanup path. Prefer signalling individually verified positive PIDs instead of keeping negative-PGID plans across awaits.
Invariant: only proven owned process identities may receive a signal; snapshot group membership cannot authorize later entrants. Sibling checks: existing mixed groups use individual signals; unknown/reused identities and reservation refusals signal nothing; socket/log and wrapper identity checks, running trees and pending launch guards pass.

Low — hub/README.md:951–953: ownership and doctor --fix descriptions remain stale (recorded session directory ownership, deleted-hubs-only fix) after the new verified-wrapper policy and harness fix dispatch.

Standards: 0 high, 0 medium, 1 low. Spec: changed code otherwise matches; explicit shared-path safety focus has 1 high. 18 ownership and 5 normal termination virtual cases passed, plus the reproduced membership race; diff check passed. No full suite or real process signals run, as requested. Evidence A-152: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-152-t-76-ownership-review-ae7af32-rev-65-76-1.md

### impl-76 · 2026-10-09T18:21:22.810Z

Fix round rev-65-76-1: reproduced the late process-group joiner through endProcess with a deterministic virtual OS boundary (the actual module, mocked native ps/process.kill only). The old helper killed the unrelated joiner; new code signals positive PIDs only, with a sequential start-time probe immediately before each TERM/KILL signal. Five focused checks now pass: late group joiner preserved, owned child spawned during TERM grace ended, reuse during TERM probe preserved, reuse between two KILL targets preserved, and refusal at escalation has no fallback. Updated README ownership/doctor fix text. Prior full suite was active and interrupted safely as superseded (exit 130); running shared-path targeted checks before the new final suite.

### rev-65 · 2026-10-09T18:25:33.594Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-76-2
commit: c205bd626d83b494f0c0ff0e80c7c4a5953d906b

Medium — hub/src/system-processes.ts:87–93: KILL targets are frozen before sequential identity probes. A TERM-resistant owned parent can spawn a child during its KILL probe; the positive parent signal reparents that child before any tree walk captures it, and endProcess returns true with the child still alive. Pinned virtual probe reproduces root 100 ended/new child 101 surviving; the same fixture on ae7af32 ends the child. Stop/relaunch and sweeps trust the successful result, contrary to the requested whole-tree outcome. Retain positive-PID/start-time safety while capturing descendants across this await before their parent dies.
Invariant: successful termination ends the owned tree and signals only verified identities. Sibling checks: existing descendants end individually; unknown/reused identity and reservation refusal signal nothing; late unowned group joiner survives; 18 ownership/fixture-scope cases still pass. Existing new-child regression covers TERM grace before the KILL snapshot, not the KILL-probe interleaving.

The original high group-membership finding and low README finding are resolved. Standards: clear, 0 findings. Spec: 0 high, 1 medium, 0 low. Diff check passed; read-only virtual probes only, no suite or real signals. Full suite remains with Implementer as requested.
Evidence A-155: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-155-t-76-resolution-review-c205bd6-rev-65-76-2.md

### impl-76 · 2026-10-09T18:45:16.597Z

Fix round rev-65-76-2: committed freeze-before-kill at 3ed1eadd60d973d73226abccc8f5389b5f8c2417. All 42 targeted tests and typecheck passed, including concurrent doctor files and stopped-survivor/reused-PID refusal checks. Self-review then reproduced overlapping wrapper/server sweep workers: one worker's SIGCONT thaws another's captured server during its final KILL probe, allowing a child to escape. Coordinator authorized collapse. The pending addition gives identity-matching owned ancestor candidates sole tree ownership before workers start; sweep-level regression verifies intermediate descent and that an unowned ancestor cannot suppress an independently owned child. Addition typecheck and 10 virtual tests pass; real ownership files are being rerun.

### rev-65 · 2026-10-09T18:46:06.879Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-76-3
commit: 3ed1eadd60d973d73226abccc8f5389b5f8c2417

Medium — hub/src/system-processes.ts:136–143: if process inspection remains unavailable after SIGSTOP (including the cleanup probe), thaw only logs process-thaw-failed and returns, leaving an owned survivor indefinitely stopped. Pinned virtual fixture leaves pid 100 in T state with no SIGCONT; this fails the requested never-left-stopped error-path invariant.

Medium — hub/src/orphans.ts:150–151, hub/src/system-processes.ts:138–140: parallel wrapper/server candidates independently freeze and thaw a shared child. Reproduced two endProcess workers: after wrapper death, the child worker's fresh wrapper check refuses KILL and thaws child 101 while the wrapper worker probes it for KILL; resumed 101 forks 102, then is killed, and the wrapper worker reports success with 102 alive. Recovery ownership must coordinate overlapping identities so one worker cannot reopen another's frozen-tree fork gap.

Invariant: stopped identities retain safe recovery ownership until resumed or confirmed dead; successful termination ends the owned tree. Sibling checks: A-155 single-worker child escape is fixed; late unowned group joiner receives no STOP/KILL; ordinary post-freeze guard refusal resumes the survivor; all 18 ownership/fixture-scope cases pass. The added unavailable-KILL test permits thaw inspection to succeed and misses unavailable thaw itself.

Standards: clear, 0 findings. Spec: 0 high, 2 medium, 0 low. Sweep remains background with a 12-second shared deadline plus an independent 2-second thaw budget (source bound, not benchmark). Diff check passed. Read-only virtual probes only; no suite or actual signals.
Evidence A-160: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-160-t-76-freeze-recovery-review-3ed1ead-rev-65-76-3.md

### impl-76 · 2026-10-09T18:51:06.634Z

Combined fix committed at 23f89cd5e24e553cd159294d0e4cbd15c84e1985. One sweep worker per owned tree (candidate collapse), cleanup CONT even on persistent inspection failure, and immediate removal of confirmed dead/reused identities from the stopped set. 46 targeted cases pass, including two doctor files concurrently, plus typecheck/diff check. Two-axis self-review is clear after resolving its overlap and confirmed-reuse findings. Evidence A-162: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-162-t-76-freeze-cleanup-and-ownership-delta-review.md; executable overlap proof A-161: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-161-t-76-overlapping-freeze-standalone-proof.mjs. Head frozen for external delta review; final full suite pending.

### rev-65 · 2026-10-09T18:56:51.308Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-76-4
commit: 23f89cd5e24e553cd159294d0e4cbd15c84e1985

Medium — hub/src/orphans.ts:166, hub/src/system-processes.ts:143–144: ownership collapse is per invocation. Two concurrent public sweepOrphans calls still select the same wrapper; one refuses after wrapper death and CONTs the shared server during the other's KILL probe, allowing a child to escape while the other reports success. Pinned actual-sweep virtual probe returns ended [[100], []] with child 102 alive. Coordinate tree recovery ownership across callers (startup/doctor/concurrent doctors).

Medium — hub/src/orphans.ts:162: collapse permanently drops an independently owned child before the ancestor captures it. If the ancestor exits before :173–174, its worker returns and the child remains alive with no worker or diagnostic. Pinned fixture leaves owned server 901 alive with zero termination calls. Reassess suppressed candidates after the ancestor settles instead of discarding them.

Medium — hub/src/system-processes.ts:147: if one SIGCONT raises non-ESRCH and error logging throws, thaw aborts before later stopped PIDs receive CONT. Pinned combined-fault fixture leaves pid 101 stopped. Cleanup observers must not prevent remaining recovery attempts (README every-exit-path guarantee).

Invariant: tree ownership survives awaits and spans callers; every suppressed owned candidate is captured or reassessed; observers cannot abort survivor recovery. A-155, late unowned group joiner, ordinary refusal recovery, persistent-inspection recovery and confirmed reuse pruning pass. The identity-free SIGCONT follows the Coordinator's explicit exception; accepted limitation: unobserved death/reuse followed by failed inspection can CONT a replacement, so 'reused PID never touched' only holds for observed identity changes.

Standards: 0 high, 1 medium, 0 low. Spec: 0 high, 2 medium, 0 low. Diff check passed. No suite or actual signals; Coordinator-reported targeted tests/full suite remain separate. Evidence A-163: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-163-t-76-collapse-recovery-review-23f89cd-rev-65-76-4.md

### impl-76 · 2026-10-09T19:10:54.002Z

Final design committed at 8d3036924b9e5319a4ee4ed9a7f35a4782898aac: async per-project sweep lock with PID/start proof and busy warning, atomic capture claims with queued-descendant reassessment, and logger-independent CONT recovery. All 68 targeted cases passed (including two doctor files concurrently), typecheck/diff check passed, both self-review axes clear. Evidence A-166: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-166-t-76-final-design-and-targeted-evidence.md. Full npm test restarted on the frozen head; external delta review pending.

### rev-65 · 2026-10-09T19:16:16.200Z

verdict: review
result: clear
by: rev-65 [reviewer]
run: rev-65-76-5
commit: 8d3036924b9e5319a4ee4ed9a7f35a4782898aac

Low — hub/README.md:949: the claim that CONT does not affect a process that is not stopped is too broad; a running process can catch SIGCONT and run a handler. Qualify this as default continuation behavior or remove that reassurance. The accepted identity-free recovery tradeoff itself is correctly documented.

All three rev-65-76-4 mediums are resolved: same-project public sweeps serialize, queued children remain eligible until actually captured, and throwing observers cannot skip later CONT attempts. Pinned virtual probes pass competitor refusal/no signals, ancestor exit before capture, unowned ancestor preservation, logger fault recovery, A-155/late joiner, persistent inspection recovery, confirmed reuse, deleted-root preparation and 23 shared lock lifecycle cases. 34 logical virtual cases total; diff check passed. Coordinator reports 68 targeted tests/typecheck passing; no Reviewer suite or actual process signals. Full suite remains separate.

Standards: 0 findings. Spec: 0 high, 0 medium, 1 low. T-76 clear.

Separate pre-existing hazards, excluded from this verdict as requested:
- hub/src/orphans.ts:157: different-project doctors may discover the same deleted-project hub through existing machine-wide discovery while holding different caller-root locks; serialization is per project, not per globally discovered target.
- hub/src/system-processes.ts:43: direct concurrent termination calls outside sweepOrphans do not share sweep serialization/claims; the direct-helper overlapping-thaw hazard remains for separate follow-up.

Evidence A-168: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-168-t-76-final-design-review-8d30369-rev-65-76-5.md
