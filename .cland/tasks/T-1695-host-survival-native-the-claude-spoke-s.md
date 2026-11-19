---
id: T-1695
kind: task
title: "host-survival-native: the Claude spoke's persisted response misses its 15 s window after master loss under load"
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1889
regression_of: T-1686
topic: topic-1663
branch: t/T-1695-host-survival-native-the-claude-spoke-s
created: 2026-11-05T19:05:01.746Z
updated: 2026-11-19T20:31:20.197Z
---

## Summary

`hub/test/host-survival-native.test.ts` "three remote harnesses retain births, forwards and welcomed spokes across 20s hub downtime and master loss" failed in impl-1692's loaded macOS batch (T-1692 evidence, about 13.7 of load, 7 burners, repetition 2). The error was `persisted spoke response cc tunnel: not within 15000 ms` after 56.8 s, for the Claude Code harness. T-1686 found and fixed the same symptom for Codex (`cx`): its confirmed resume path never emitted the reconnect signal, so a refused delivery was never retried. T-1686 judged Claude unaffected at the time, because its authenticated mod bridge already triggers `Sessions.#retry`. This failure suggests a remaining gap for Claude under load. The 15 s wait is a behaviour bound (post-master-loss response), so T-1692 kept it unchanged.

## What to build

Use the bounded bridge, recovery and injection diagnostics in impl-1692's artifact to find why the Claude spoke's persisted response does not arrive within 15 s after master loss under load. Candidates:
- the mod bridge re-attaching later than the window;
- the retry not firing after re-attach;
- a delivery being refused during reconnect and never replayed.

Fix it in the product. If the 15 s is not a real guarantee, derive the bound from the product's reconnect cadence and document it.

## Acceptance criteria

- [x] C1. The cause is named with a reproduction under CPU load or a deterministic held-bridge test (red before the fix).
  - done: impl-1695 · 2026-11-19T19:25:05.512Z
- [ ] C2. After the fix, `host-survival-native` passes 10/10 under CPU load 12–15 on macOS, run in a Coordinator-announced quiet window. On Linux, the native file passes in the configured droplet verification, with its exact platform and repetition count reported (test).
  - failed: rev-36 [reviewer] · 2026-11-19T19:40:01.445Z · note Changed validation callbacks lack whole-caller setup/cancellation joins and the held native-hook oracle can pass without positive processing/close proof; failure diagnostics can replace the primary response error. Loaded macOS and configured Linux evidence remain outstanding.

## Comments

### impl-1695 · 2026-11-19T19:17:13.397Z

Unloaded baseline: unchanged branch, macOS arm64 Node24.21.0, host-survival-native 1/1 pass, 40.775s case, no stress load. A-16907 literal failure was persisted spoke response cc tunnel: not within 15000 ms. Claude is on f1, whereas only f2 master is killed. Added bounded 32 KiB log tail plus exact sent value/process states for the next failure to distinguish queued human-busy from bridge/refused injection; preparing stress reproduction pending Coordinator window.

### impl-1695 · 2026-11-19T19:24:00.313Z

Rule20 state-consumer census covers production Claude interpret, Sessions.signal and injection/approval gates, Core.setSessionState/humanDeliveryBlocked/flushQueued, hook signalPayload/startedAt, mod register, protocol and store state readers, web session row/rail/layer clients and nvim state consumers; plus all tier tests, fixtures, qa and shipped skills. No frame/schema/CLI bytes change: previous ids-only hook and text-bearing mod frames remain accepted. Changed consumer: Claude duplicate native start state interpretation, bounded by durable sessionId and envelope ids; confirmation stays intact. Native-only input regression retained. Existing state/approval/client readers unchanged. Search includes field/event/function names and importers, frozen cli-usage/host-launch fixtures (no byte change needed). Full path census staged for evidence.

### rev-36 · 2026-11-19T19:40:01.445Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1695-source-1
commit: 20ff4522841b8656a79ce3b5c3b1a476343c04f5
scope: full
findings: [{"severity":"medium","text":"Standards M1: the new component callback uses default component/open and raw spoke/bridge/request continuations without an enclosing pre-acquisition, signal-fenced whole-caller owner or named setup bound. The changed host-survival-native callback at line24 likewise leaves held-hook setup/release and detached response observations outside sshHostFixture.runOwned. Resource hooks/rejection catches do not join the caller. Enroll original work and late acquisitions, release holds before joining, and retain root/seam/native ownership until positive drain. Lead703137f1 confirms both gaps.","file":"hub/test/claude-code-schedule.test.ts","line":530},{"severity":"medium","text":"Spec M2: prompt-suffixed 'hooks ... done' can be logged after child.error, nonzero close, or a hook CLI that catches a posting failure; fake-claude.ts:304/316 does not supply successful interpretation/native-close proof. The green test can pass without exercising the held late start. Add structured exact prompt/input/launch-bound processing and native-close receipts with explicit incomplete outcomes, preserving the final response assertion; a processed duplicate need not change state. Lead226bd116 confirms no omitted receipt/disposition.","file":"hub/test/host-survival-native.test.ts","line":159},{"severity":"medium","text":"Standards M3: diagnostic hub.status/rows and open/stat/read/finally-close awaits can reject before the original response error is rethrown, replacing the selected failure. Preserve that primary outcome and attach bounded secondary diagnostics, including close failures. The new32KiB tail read is bounded but not failure-contained. Lead3bbcfdcd confirms no omitted owner/disposition.","file":"hub/test/host-survival-native.test.ts","line":128}]
finding_counts: {"high":0,"medium":3,"low":0}

Source NOT CLEAR at 20ff4522841b8656a79ce3b5c3b1a476343c04f5 / tree89eed07e97abdb92b4e92bc0c9c36f0088163e1e, base03efb0fc1, clean readback. A-21883 supersedes A-21882 only to restore exact producer error spacing. Standards: two medium findings (M1 callback ownership, M3 primary-error preservation). Spec: one medium finding (M2 native hook processing/close receipt). All three confirmed by the lead from pinned source; no Reviewer reproduction.

Production suppression is otherwise coherent: per-session mod envelope history capped at64, cleared on unwatch/detach/close; duplicate native start retains confirmations/prompt bookkeeping while removing state and avoiding later approval resolution; native-only inputs remain effective. Sessions validates launch generation before interpretation. Wire/schema/CLI/tier shapes unchanged. Previous ids-only hook/text-bearing mod and native-only controls retained. Native hold still preserves original 15s response and survival/birth/master/no-stop assertions. The bounded32KiB diagnostic read improves retained bytes but needs containment. Fix only changed paths/necessary seams, with release-before-join and late adoption; require processing evidence without demanding a state-changing applied:true for a legitimate duplicate.

A-21872/A-21879 preserve deterministic native red: 'persisted spoke response cc tunnel: not within 15000 ms', behaviorally unfixed instrumentation with bookkeeping, exit1. Earlier setup failure remains incomplete. Native green1/1 is mixed edit/run provenance: prompt capture changed after worker load; final exact-message observer refinement had no native rerun. This supports a fixture cause, not exclusive historical CPU-load attribution or final-native proof. Whole schedule50/50, six selected T1 files86/86 and four T2 controls75/75; all pinned tiers independently checked. Final full lint/typecheck exit0 after refinement, before commit; no invocation tree/worker/native-signal attestation. Retained normalized/redacted copies are not exact raw-byte archives. Native case/file durations include setup/cleanup, not response latency.

Consumer notes include production state/approval/injection and mod register; its original census-root omission, QA/frozen/skill search limits and deferred native/raw-prefix readers stay explicit. No current configured Linux, loaded10/10 macOS12–15, T4, Web or QA evidence. C1 remains done/unverified; C2failed and outstanding; nothing verified, no ready claim.

Hold released for bounded corrections and required checks, then fresh exact-head source review. C2's Coordinator-announced loaded window and configured native verification must follow source clearance. No additional full run requested. Reviewer read-only task/Git/source/docs/retained-log inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

Criteria: C2 failed (Changed validation callbacks lack whole-caller setup/cancellation joins and the held native-hook oracle can pass without positive processing/close proof; failure diagnostics can replace the primary response error. Loaded macOS and configured Linux evidence remain outstanding.).

### rev-36 · 2026-11-19T20:05:03.735Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1695-source-2
commit: da821d9d80f213b00c7a9001ed55801308ede4e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source CLEAR at da821d9d80f213b00c7a9001ed55801308ede4e2 / tree347b1516959d032488faff5e10a9105c93e522a3, sole parent20ff45228, clean and no dev merge. A-21893 records Standards0/Spec0 and resolution of all three A-21883 findings. C1/C2 remain unverified; this is source only, not ready/final evidence.

M1: T2 whole-case owner precedes acquisition, named setup waits/root adoption and owned hub/spoke/client/frame controller retain original work. Native whole-case plus f.runOwned retain initial setup and all operations, separate80s default setup from15s behavior, register late agent cleanup inside acquisition, arm response/master observers before triggers and cancel/join in finally. Shared fences and incomplete joins retain roots/seams. M3: response diagnostics own their32KiB read and close, contain ancillary/status/read/close/report failures as bounded secondary diagnostics and rethrow selected response failure.

M2: producer child.close receipts carry exact job/prompt/event/PID/code/signal/spawnError. Shared path/validator requires successful close plus independent production interpretation after authenticated Sessions admission; exact durable-input mod completion/idle is separate. Stop then held UserPromptSubmit processing/close are required before unchanged master-loss/15s response controls. Missing metadata is incomplete, never done-text or exit0-only success, and applied:true is not required for a processed duplicate. New single T1 case has positive and negative permutations; no tier move. Production adapter unchanged,64-envelope/confirmation/prompt/approval/native-only behavior retained.

Four reason comments at120/146/180/209 justified: success booleans, job identity and running-status assertions, not elapsed-time comparisons. Setup bound remains enforced; lint policy/baselines/allowances unchanged. Taint follow-up reported separately, id unavailable; no existence claim beyond that report.

A-21890 final local native1/1,38758.865958ms case/39239.54375ms runner, macOSarm64/Node24.21,startload3.04,no burners/browser. Native facts bind sessiona6241b93/input4b7d3ecb/jobeaf9c887/promptbd43516f; Stop PID73367 and UserPromptSubmit PID73648 each code0/signalnull/no-spawn-error with independent turn-end/start processing. Whole intervals include setup/20s downtime/cleanup, not response latency. Independently matched seven before/after SHA256s to committed source bytes, not every dependency/full invocation tree/worker hash. Command was precommit; overall OS signal unknown, distinct from child signalnull.

Focused51/51=50T2schedule+1T1receipt, final full typecheck/lint0. Earlier lint order failure and four taint refusals retained;131 report-only findings/62files not gate passes. Earlier native intermediate/mixed-green/incomplete/red epochs and211 prior selected results stay separate in A21872/A21879. QA/frozen/raw-prefix consumer limits retained. No configured Linux or loaded10/10 macOS12–15, other T3/T4/Web/QA proof. Hold released for Coordinator-announced C2 windows at this fixed head; any changed head needs review. No final-ready claim or additional full run requested. Reviewer read-only inspection only, no edits/tests/probes/scans/generators/native/browser/delegation.

### impl-1695 · 2026-11-19T20:31:20.197Z

Configured exact reviewed-head run 533c7a41-c90e-42a7-8151-175eb462fae0 passed, A-21898: da821d9d80f213b00c7a9001ed55801308ede4e2, canonical verification tree bd19693ff8dd88fdb084c0579628e545081e406c, uncached Linux x64 6.8.0-149-generic droplet c-8 ams3, Node24.21.0/Nvim0.12.5, lifetime1352s/cost$0.0939/workers2. Hub aggregate7025/7025 with zero failures/cancellations/skips/TODO; T0/allT1/fallback allT2 both packages/changed nativeT3 once/Web complete. RemainingT3 deferred; T4 unexecuted. Browser HeadlessShell1248 at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Chrome for Testing156.0.8078.4. Native generated survival case1/1/no repetitions,41.18s; independent structured processing/native-close receipts retained in A-21898 for exact job/prompt/input, both closecode0/signalnull/spawnErrornull. All advisory budgets/lints remain report-only. Source clear A-21893 stands; C2 Linux portion complete, macOS10/10 CPU load12-15 campaign still unexecuted pending Coordinator window. No ready claim or configured resubmit.
