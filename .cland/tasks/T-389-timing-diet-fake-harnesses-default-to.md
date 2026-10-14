---
id: T-389
kind: task
title: "Timing diet: fake harnesses default to fast turns and polls with explicit slow opt-ins, timer-bound tests run on env-controlled schedules, and fixed sleeps become event waits"
state: open
status: ready
size: M
criterion_seq: 8
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by: []
topic: topic-264
branch: t/T-389-timing-diet-fake-harnesses-default-to
created: 2026-10-14T12:28:10.336Z
updated: 2026-10-14T23:53:01.007Z
---

## Summary

The fake harnesses think 300 ms per turn and the adapters poll every 200 ms. Push trust is 1000 ms and the fake Codex refuse window is 1500 ms. Those defaults apply to 561 tests worth 2,098 s of test-time, and a handful of tests wait out real production schedules for 15–33 s each. This ticket makes the defaults fast with explicit opt-ins, puts the timer-bound tests on the existing env knobs, and turns positive fixed sleeps into event waits. The research estimates 300–470 s of test-time, 1.3–2.0 minutes of a full run.

## Parent

"Test speed: quick wins" (R-228), tracer bullet 2; research #2 (`docs/research/test-speed.md` §3.9; §2 point 4).

## What to build

**Fast fake defaults (`hub/test/harness.ts`).**

- `fakeClaude` (lines 553–559): `FAKE_CLAUDE_TURN_MS` 300 → 30, `CLAND_ADAPTER_POLL_MS` and `CLAND_CLAUDE_AGENTS_MS` 200 → 50, `CLAND_PUSH_TRUST_MS` 1000 → 100.
- `fakeCodex` (lines 653–654): `FAKE_CODEX_TURN_MS` 300 → 30 and `CLAND_ADAPTER_POLL_MS` 200 → 50. `FAKE_CODEX_REFUSE_MS` gets a harness default of 150 instead of falling through to the fake's 1500 (`hub/test/fakes/codex/fake-codex.ts:642`).
- The OpenCode fake's default (`hub/test/fakes/opencode/fake-opencode.ts:114`): wherever the tests set it, the same 30 ms.

The fakes' own fallbacks (300, 1500) stay as they are for direct use outside the harness. A test that needs a slow turn to stage a race passes `turnMs` / `pollMs` / `pushTrustMs` explicitly with a comment naming the race.

**Timer-bound tests, through existing knobs.** No new seam inside the hub. Use `CLAND_*_MS` and `CLAND_TEST_*` as `hub/src/adapters/index.ts` and `hub/src/executor/droplet/*` already do.

- `claude-code-adapter.test.ts` "Claude discovery and watch share the default 30-second schedule, and stop works before…" (32.3 s) runs today with `CLAND_CLAUDE_AGENTS_MS: ''` so that it waits out the real 30 s. The test proves the default from the resolved schedule the hub reports, as a log or journal field the adapter already writes or gains as plain data. It then proves the sharing and the early stop at a short override. If the adapter writes no such field, adding a log field is allowed; a new injection point is not.
- `executor-safety.test.ts` "prepare, run, fallback, cancel and stopped-hub watchdog…" (33.0 s, `lifetime="20s"`, `run_timeout="18s"`) and "the remote shell and the host deadline both end a timed-out run once…" (15.1 s, `run_timeout="2s"`). Lifetime, run timeout and the watchdog poll go through test-scaled `CLAND_TEST_EXECUTOR_*` / `CLAND_TEST_DROPLET_*` values, for example a lifetime in milliseconds read only under the test env, beside the existing `CLAND_TEST_EXECUTOR_MARGIN_MS`. Config parsing and its validation messages (`lifetime 15m … run_timeout 6m`) stay proven by the config tests.
- `executor-safety.test.ts` "all remote admission refusals…" (21.0 s) and "provider list awaits…" (13.2 s), and `claude-code-accounts.test.ts` "discovery, watch and restart share each live directory schedule…" (15.5 s): the same treatment wherever a production interval is waited out in real time.

**Sleeps of 0.5 s or more.** About 25 exist. Among them: `nvim/test/shell.test.ts:494` (5.5 s), `tracker.test.ts:163` (2.1 s), `claude-code-accounts.test.ts:77` (2.1 s) and its 2.3 s wait, `role-integrity.test.ts:32/116` (1.8 s, 1.0 s), `codex-delivery.test.ts:56/127` (2 × 1.5 s), `human-routing.test.ts:136` (1.5 s), `account-poller.test.ts:106/288` (1.1 s, 3.2 s), `account-limits.test.ts:120`, `orphan-servers.test.ts:428`, `suite-runner.test.ts:227/350`, `adapter-native-boundary.test.ts:364` and `tracker-ready.test.ts:565`.

- A sleep that waits for something to happen becomes `eventually(…)` or a frame or journal wait.
- A sleep that proves nothing happens stays a wait. It is rewritten as a multiple of the interval it spans (for example `4 * pollMs`), so it shrinks with the new defaults and still covers the same number of polls.
- A sleep that waits for a wall-clock second boundary (`pid-identity.test.ts:21`, the lstart resolution) stays and gets a comment saying why.

The Implementer posts the list of every sleep touched with its class.

**Races.** If a fast default exposes a race, the Implementer reports it to `lead T-<n>` as a Bug with a size. The affected test opts into the old timing with a comment naming the bug until the fix lands. Nothing opts in silently.

## Acceptance criteria

- [x] C1. `fakeClaude` and `fakeCodex` default to 30 ms turns, 50 ms polls, 100 ms push trust and a 150 ms Codex refuse window, and every test that passes a slower value has a comment naming the race or behaviour it needs.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:31.616Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-3 · 2026-10-14T21:54:18.308Z · commit dddf97804f795fe226ef48d91daa26e629ce46da
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-5 · 2026-10-14T22:33:40.682Z · commit 5d47648d5dfd4907a4a038052568c95edce02dc6
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-7 · 2026-10-14T23:25:13.138Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.896Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
- [x] C2. Measured alone on an idle machine, the three timer-bound tests ("prepare, run, fallback, cancel…" 33.0 s, "…default 30-second schedule…" 32.3 s, "the remote shell and the host deadline…" 15.1 s) each take under 5 s; before/after times and the one-minute load are posted on the item.
  - done: impl-389 · 2026-10-14T21:58:41.284Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.896Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
- [x] C3. The 30-second default is still asserted, from the resolved schedule the hub reports with the env unset, and the sharing and early-stop behaviour is asserted at a short override.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:34.270Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-3 · 2026-10-14T21:54:18.308Z · commit dddf97804f795fe226ef48d91daa26e629ce46da
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-5 · 2026-10-14T22:33:40.682Z · commit 5d47648d5dfd4907a4a038052568c95edce02dc6
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-7 · 2026-10-14T23:25:13.138Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.896Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
- [x] C4. Every sleep of 0.5 s or more in `hub/test` and `nvim/test` is either an event wait, an interval multiple with its interval named, or kept with a comment, and the classified list is posted on the item.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:35.425Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-3 · 2026-10-14T21:54:18.308Z · commit dddf97804f795fe226ef48d91daa26e629ce46da
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-5 · 2026-10-14T22:33:40.682Z · commit 5d47648d5dfd4907a4a038052568c95edce02dc6
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-7 · 2026-10-14T23:25:13.138Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.896Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
- [x] C5. Measured: the whole-file times of `codex-adapter.test.ts`, `claude-code-adapter.test.ts`, `opencode-adapter.test.ts` and `session-usage.test.ts` on an idle machine fall by at least 25% in sum (median of three runs each), with before/after posted.
  - done: impl-389 · 2026-10-14T21:17:36.179Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.897Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
- [x] C6. No assertion changes its meaning: the review request lists every changed assertion with what it still proves, and no test is skipped or deleted.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:53:04.275Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-3 · 2026-10-14T21:54:18.308Z · commit dddf97804f795fe226ef48d91daa26e629ce46da
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-5 · 2026-10-14T22:33:40.682Z · commit 5d47648d5dfd4907a4a038052568c95edce02dc6
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-7 · 2026-10-14T23:25:13.138Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.897Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
- [x] C7. Any race exposed by the fast defaults is reported as a Bug with its size, and its test's opt-in names that bug.
  - done: impl-389 · 2026-10-14T23:24:31.901Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-7 · 2026-10-14T23:25:13.138Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.897Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
- [x] C8. `hub/README.md` (the fake harnesses) and the comments at the top of the three fakes describe the fast defaults and how to opt into slow turns.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:39.158Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-3 · 2026-10-14T21:54:18.308Z · commit dddf97804f795fe226ef48d91daa26e629ce46da
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-5 · 2026-10-14T22:33:40.682Z · commit 5d47648d5dfd4907a4a038052568c95edce02dc6
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-7 · 2026-10-14T23:25:13.138Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-8 · 2026-10-14T23:52:57.897Z · commit e11eceda8c2d9d71c2510371e4c8ca836324468f

## Comments

### impl-389 · 2026-10-14T19:47:06.205Z

Wait classification and complete changed-assertion inventory: A-2539, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2539-t-389-wait-classification-and-changed-assertion-inventory.md. Includes every touched sleep and C6 meanings. Measurement follows Coordinator amendment 2235f1f7: serial interleaved A/B pairs with per-run load and verify holder, not idle timings. First Claude pair passed: baseline 80.962 s (load 10.255), candidate 44.355 s (load 12.558), same impl-391 holder; remaining pairs/files still running.

### impl-389 · 2026-10-14T20:17:32.343Z

C5 paired measurement result under the Coordinator amendment: all 24 accepted runs green; sum of four medians 309.828 s → 249.643 s, 19.43% lower, below the 25% target. Raw samples, loads, holders and method: A-2547, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2547-t-389-initial-paired-timing-results-19-43-reduction-c5-decision-pending.md. Asked lead T-389 whether a test-only usage publication interval control is within scope or C5 should reflect realized gain. Fast-turn staging race reported as Bugs/XS and isolated to the two pending-steer variants; explicit 300 ms turn with behavior comment restores both, all assertions unchanged. Red/green evidence: A-2540, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2540-t-389-codex-short-turn-staging-race-red-and-green-evidence.md. C2 executor pair and remaining targeted files continue serially.

### impl-389 · 2026-10-14T20:22:49.566Z

C2 loaded A/B evidence under the Coordinator measurement amendment: default Claude schedule median 33.069 → 6.869 s; watchdog/lifetime 34.476 → 18.131 s; shell+host deadline 15.205 → 16.456 s. Executor A/B start loads 10.966 / 12.087, same impl-391 holder 6e61b4b3-e6bf-4b58-b058-5d368a67abb2. Both sides green; no idle under-5-second claim. Detailed ratios/limits: A-2548, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2548-t-389-c2-timer-pairs-loaded-ratios-and-limits.md. Raw C5 and C2 logs/loads/holders, including excluded pre-opt-in and setup attempts: A-2549, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2549-t-389-raw-a-b-logs-loads-holders-and-timer-pair-evidence.gz. Targeted account-limited, account-limits and account-poller files are green; remaining touched files continue serially. C5 remains below target pending the lead's scope decision.

### impl-389 · 2026-10-14T20:36:11.421Z

Approved usage interval change committed as ac63e850; production default and real-window account-limits proof remain 1000 ms, ordinary usage fixtures use 100 ms, and two pending-publication stop cases explicitly keep 1000 ms. Final wait/assertion inventory A-2553 supersedes A-2539's idle-startup row: the original 300 ms negative window is retained as six 50 ms polls (36cc9940). Final source has exactly three existing assertion predicate changes, two added default-proof assertions, and no test declaration/skip/delete changes. Serial targeted checks currently 28 files green; final timing reruns will include Claude and usage plus two more executor pairs for three-pair C2 medians.

### impl-389 · 2026-10-14T21:00:43.672Z

C5 final: 310.177 → 228.694 s sum of four whole-file medians, 26.27% lower under Coordinator loaded A/B method amendment 2235f1f7. All 24 accepted samples passed. Final complete table/raw loads/holders/exclusions: A-2558, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2558-t-389-final-paired-timing-result-26-27-percent-reduction.md. Supersedes initial 19.43% result A-2547; original data retained. Usage control approved in decision 9e94f0db; usage staging race reported Bugs/XS and fixed via real session.usage event wait, preserving every assertion (A-2555, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2555-t-389-usage-publication-staging-race-evidence.md). All other 38 touched test files passed serially, 591 tests. No source change from T-391 is included in these timing samples.

### impl-389 · 2026-10-14T21:13:11.051Z

Source ready at ef57847105ccd2da5851e1dff087075ff2b6ebb1, branch t/T-389-timing-diet-fake-harnesses-default-to, clean and pushed to local origin. Latest origin/dev fetched/merged before review. All 38 other touched files passed (591 cases), plus four final-head whole-file reruns passed: executor-safety 20, session-usage 8, Claude adapter 9, account-limits 3. Typecheck and diff check passed. C2 final medians under Coordinator loaded-ratio amendment: shell+host 16.529→13.521 s; watchdog 33.695→15.811 s; Claude schedule 33.149→7.005 s. Baseline first executor pair failed the existing lease-readiness assertion; retained in all raw data/median, never claimed green. All three final candidate executor pairs passed. Detailed C2 evidence A-2563, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2563-t-389-final-c2-paired-medians-and-baseline-failure-disclosure.md. Final C5 A-2558 meets 25% at 26.27% reduction without T-391 gains. Final waits/assertions inventory A-2560; targeted check table A-2561; complete raw archive A-2564, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2564-t-389-complete-raw-checks-and-timing-evidence.gz. Race evidence A-2540, A-2555, A-2559; reported Bugs/XS and fixed via explicit turn opt-in or public readiness waits. Review requested next; official local no-mode verify will run only after clear source verdict. QA policy is none/after-stage.

### impl-389 · 2026-10-14T21:14:00.559Z

Coordinator measurement amendment — direct decision text from coord, decision 2235f1f7-18db-41df-9c6c-a222d0b9a7a7, topic-264, 2026-10-14T19:37:46.336Z (addressed to impl-389):

"The queue won't idle tonight, so measure C2 and C5 as interleaved A/B pairs instead.

- For each of the four files, alternate baseline (the merge-base, in a scratch worktree) and candidate whole-file runs: A, B, A, B, A, B. Run them serially, one process at a time, back to back, so each pair sees the same load.
- Record the 1-minute load before each run, plus the holder from cland verify queue.
- Judge C2/C5 on the paired deltas: the median of the candidate against the median of the baseline per file, with every raw number reported. If a criterion names an absolute idle-machine number, report the paired ratio and mark it under this Coordinator amendment. Don't claim idle timing.
- Don't use the human-queue slot for this. Six runs on each of four files would hold the local queue for too long."

Additional Coordinator decision 9e94f0db-666f-4333-9578-7872297ddee8 (2026-10-14T20:25:32.209Z) explicitly approved CLAND_TEST_USAGE_EVENT_MS, 100 ms only in session-usage fixtures, keeping production1000 and the real-window account-limits test; required usage remeasurement the same A/B way. It offered to amend C5's percentage only if the remeasurement still missed25%; no percentage amendment is needed because final measured reduction is26.27%. C2 is presented as loaded paired ratios with all raw numbers, never as under-five-second idle proof.

### rev-23 · 2026-10-14T21:17:11.827Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-1
commit: ef57847105ccd2da5851e1dff087075ff2b6ebb1
scope: full

No high or medium Standards/Spec findings across 54 files. Fast shared/local fixtures and commented slow opt-ins, direct fallback preservation, resolved 30000 default proof, full wait classification and unchanged assertion meanings verified. Exactly three existing timing predicates follow configured intervals; no test/skip deletion. Existing executor timers and Coordinator-approved usage timer control retain production defaults. C7 three staging races reported with real readiness or explicit 300 ms opt-in, no weakened assertions. Direct 2235f1f7 loaded-pair amendment and 9e94f0db usage approval read. Raw 24 C5 samples recalculate 310.177282→228.694178 s (26.269849%); C2 ratios improve with one failed baseline executor sample explicitly retained, no idle/under5/all-green-baseline claim. 38 targeted files/591 cases and four final-head reruns checked. C2/C5 final marks pending normal same-head local gate; claimant done marks currently absent. A-2565: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2565-t-389-source-review-fast-fixtures-preserved-assertions-and-loaded-timing-proof.md.

Criteria: C1 verified, C3 verified, C4 verified, C6 verified, C7 verified, C8 verified.

### impl-389 · 2026-10-14T21:17:57.957Z

Source review clear rev-2026-10-14-389-1 / A-2565 at ef578471; C1/C3/C4/C6/C7/C8 verified. Recorded C1–C8 claimant done marks as requested, preserving C2 amendment/no-idle limitation. Submitted exact-head local no-mode verification 4b2735cc-9a05-4866-96db-928f1ea94a0d, queue position1, result recipients rev-23 and impl-389. No source changes after verdict. Idle awaiting hub result and Reviewer final C2/C5 marks.

### rev-23 · 2026-10-14T21:43:59.462Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-2
commit: ef57847105ccd2da5851e1dff087075ff2b6ebb1
scope: evidence

Medium — hub/test/executor-safety.test.ts:299: live recursive sentinel scan races transient executor spend-lock directory removal; A-2572 has ENOENT on spend.json.lock.break.*.owner.tmp after parent enumeration. Local full 4b2735cc exits 1, 1679/1680 hub cases pass, no skips/cancellations; Neovim not reached. No sentinel-found or cleanup-assertion failure inferred. This changed lifecycle case is not eligible for the untouched-test retry rule. Bugs/XS reported; proposed public-daemon quiescence correction needs source review and must retain resource/result/journal/sentinel proofs. Source criteria A-2565 retained; C2/C5 final marks/readiness remain pending complete accepted gate. A-2573: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2573-t-389-verification-blocked-by-live-executor-state-scan-race.md.

### impl-389 · 2026-10-14T21:53:06.841Z

Corrective source ready at dddf97804f795fe226ef48d91daa26e629ce46da (pushed/clean; latest origin/dev merged, including T-385/T-431). Fix3a5b59c0 adds an asserted public stop after live resource/result/journal proofs, before the unchanged complete persisted-state sentinel audit, so periodic spend-ledger sweeps cannot remove a lock-owner directory during readdir. No filesystem error ignored, no file skipped, all original assertions retained;1 new stop-success assertion. Failed official run4b2735cc/A-2572 and Reviewer A-2573 supplied the red. Focused pre/post observations and final-head checks: A-2574, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2574-t-389-corrective-audit-boundary-and-87-green-targeted-cases.md. Full executor-safety20/20 and suite67/67 passed serially; typecheck/diff check green. Raw logs/diff A-2575, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2575-t-389-audit-boundary-fix-raw-validation.gz. Watchdog case observed16.479s in this full run; historical C2 medians retain explicit prior-head provenance (A-2563), no new median/idle claim. C5 executor-independent26.27% result A-2558 unchanged. New-head review requested next; no new verification before source clear.

### rev-23 · 2026-10-14T21:54:18.308Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-3
commit: dddf97804f795fe226ef48d91daa26e629ce46da
scope: delta

No high/medium Standards/Spec findings. A-2572 live-tree scan finding corrected by asserted public stop after live resource/result/journal and original process-command credential proofs, before unchanged complete persisted-byte/provider-request sentinel audit. Dispatcher clears/awaits sweep work; no files skipped, ENOENT ignored, predicate weakened or deadline changed. Clean dev T-385/T-431 integration preserves timing controls. A-2575 raw whole files pass 20/20 executor and 67/67 suite plus typecheck. Source C1/C3/C4/C6/C7/C8 refreshed; C2/C5 final marks await same-head local gate. C5 measured files unaffected. C2 historical A-2563 executor median predates added timed stop: refresh three loaded A/B pairs for that changed watchdog case before final current-head timing mark, preserving raw loads/holders; unchanged measured cases need no repeat for this correction. A-2576: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2576-t-389-corrective-source-review-quiescent-persisted-byte-audit.md.

Criteria: C1 verified, C3 verified, C4 verified, C6 verified, C7 verified, C8 verified.

### impl-389 · 2026-10-14T21:58:41.699Z

Corrected-source review clear rev-2026-10-14-389-3 / A-2576 at dddf9780. Submitted same-head local no-mode verify fa8df54b-3be7-48e0-8fb2-b94e91933153, queue position1, recipients rev-23/impl-389. Reviewer-requested changed-watchdog refresh complete: all6 serial loaded A/B samples green; per-case median33.688→16.829s,50.04% lower, including final asserted stop. A times33.291583,33.875533,33.688431; B16.829445,17.107907,16.257523. Full timing/load/holder/commit table A-2577, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2577-t-389-corrected-head-watchdog-three-pair-timing-refresh.md. Raw logs/data/scripts A-2578, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2578-t-389-watchdog-refresh-raw-six-samples-loads-and-holders.gz. This supersedes only A-2563's old watchdog median; unchanged cases and C5 did not repeat as requested. C2 claimant note updated, no idle/under5 claim. No source change after verdict; now idle for gate result.

### rev-23 · 2026-10-14T22:15:12.211Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-4
commit: dddf97804f795fe226ef48d91daa26e629ce46da
scope: evidence

Medium gate finding — hub/test/session-holds.test.ts:160: untouched pending-verifier restart channel timeout matches known T-441 native/observer defect. Local full fa8df54b/A-2582 exits 1, 1687/1688 hub cases pass, zero skips/cancellations; Neovim not reached. Corrected sentinel/lifecycle case passes 16.259 s. A-2577/A-2578 six current-head loaded watchdog samples checked, median 33.688→16.829 s including stop, exact head/load/holder retained; no idle claim. Source A-2576 stands, no T-389 causal defect inferred. T-441 replacement gate 44a4159f remains pending. C2/C5 final marks/readiness await accepted gate; no unconditional unchanged retry, changed head/adoption needs delta review. A-2583: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2583-t-389-corrected-audit-passes-gate-blocked-by-t-441.md.

### impl-389 · 2026-10-14T22:15:55.418Z

Gate fa8df54b/A-2582 failed1/1688 solely on known T-441 session-holds:160 observer-restart race; corrected executor audit passed, no T-389 source regression inferred (Reviewer A-2583). Coordinator decision20be7a7b-eb79-444c-8a61-7929ec807568 (22:15:33Z): wait for T-441 to land; after Coordinator posts its merge commit, cherry-pick only that one shared-fix commit, do not merge all dev; request rev-23 delta review of cherry-pick alone, then rerun local no-mode verification. Remain idle at unchanged clean dddf9780 until announced commit. Subscribed to T-441 task events; claim retained.

### impl-389 · 2026-10-14T22:33:09.823Z

Shared blocker resolved as Coordinator directed: T-441 landed41f9d59b; cherry-picked only that commit as5d47648d5dfd4907a4a038052568c95edce02dc6, no full dev merge (specific decisions20be7a7b/2982cf84). Clean and pushed to local origin. One-file7-line delta only, resulting session-holds.test.ts identical to merged fix; no original assertion/deadline changed. Whole session-holds7/7 passes (restart case9.387s), full hub/Neovim typecheck and diff check green. Complete delta/output A-2586, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2586-t-389-shared-t-441-cherry-pick-and-seven-green-tests.md. T-389 timing/audit source and measured cases unchanged. Requesting rev-23 delta review of cherry-pick alone before new same-head local no-mode verification.

### rev-23 · 2026-10-14T22:33:40.682Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-5
commit: 5d47648d5dfd4907a4a038052568c95edce02dc6
scope: delta

No high/medium Standards/Spec findings. Sole session-holds delta exactly matches reviewed f303e8d0 and landed T-441 41f9d59b; direct Coordinator 20be7a7b shared-fix-only disposition followed. Observer/native restart ordering restored, assertions/event cursors/deadlines unchanged. A-2586 whole file 7/7 and root typecheck pass; clean current tip/diff confirmed. T-389 timings, fake defaults, audit and measured cases unchanged; source A-2565/A-2576 retained, source criteria refreshed. Corrected watchdog pairs A-2577/A-2578 and C5 A-2558 retain provenance, no timing repeat needed for independent test delta. C2/C5/readiness await complete same-head local no-mode gate; fa8df54b/A-2582 remains earlier red on corrected T-441. A-2587: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2587-t-389-source-delta-exact-landed-t-441-patch.md.

Criteria: C1 verified, C3 verified, C4 verified, C6 verified, C7 verified, C8 verified.

### impl-389 · 2026-10-14T22:34:19.902Z

Delta source clear rev-2026-10-14-389-5 / A-2587 at exact5d47648d; reviewer refreshed source criteria and confirmed unchanged paired measurements remain applicable. New same-head local no-mode verify67ff8613-6f30-414f-a121-35d3967e34ab submitted, queue position2 behind integrated Coordinator run/current impl-432 holder, result recipients rev-23/impl-389. No mode/force override; clean pushed head unchanged after verdict. Idle pending hub gate result, final C2/C5 verdict and supervising merge; claim retained.

### rev-23 · 2026-10-14T23:19:33.670Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-6
commit: 5d47648d5dfd4907a4a038052568c95edce02dc6
scope: evidence

Medium — hub/test/session-model.test.ts:59/:79: parent sub-agent test expects busy but sees idle. It injects synthetic turn-start, runs journal CLI, then checks state under 100 ms push trust/50 ms fallback; fallback overriding staged busy is the source-supported hypothesis, not proof that child hooks mutated parent state. Local full 67ff8613/A-2593 exits 1, 1687/1688 hub cases pass, zero skips/cancellations; Neovim not reached. Bugs/XS reported. Changed file/shared fixture timings make untouched-test retry inapplicable. C7 failed pending reproduced staging correction with original attribution/model/state assertions preserved, then fresh source review and claimant done mark. C2/C5/readiness remain pending accepted exact-head gate. A-2594: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2594-t-389-gate-blocked-by-synthetic-parent-state-staging.md.

Criteria: C7 failed (Parent sub-agent fixture loses synthetic busy state under fast defaults; reproduce and explicitly stage the parent-state proof without weakening its assertion.).

### impl-389 · 2026-10-14T23:24:33.319Z

Corrected C7 parent-state staging race at pushed clean e11eceda8c2d9d71c2510371e4c8ca836324468f (fix37d48fa1 + fresh tracker-only origin/dev merge; application/test tree identical to tested37d48fa1). Controlled250ms-gap public-frame red trace idle/hook→busy/hook→idle/poll; actual overwrite is native fallback. Changing only this fixture's pushTrustMs to120000 gives green under the same diagnostic gap. Permanent delta is race comment + one fixture opt-in, no poll/turn/default/production or assertion/deadline changes. All tracing/subscription/delay removed. Full session-model11/11 and hub/Neovim typecheck pass; diff check clean. C7 re-marked done. Causal proof/diff/full outputs A-2595, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2595-t-389-parent-busy-state-overwritten-by-polling-red-and-green-proof.md; raw diagnostic sources/logs A-2596, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2596-t-389-parent-state-race-raw-diagnostic-and-final-checks.gz. C2/C5 files/runtime unchanged; source review requested before any new local no-mode gate.

### rev-23 · 2026-10-14T23:25:13.138Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-7
commit: e11eceda8c2d9d71c2510371e4c8ca836324468f
scope: delta

No high/medium findings. C7 corrected: A-2595/A-2596 controlled red trace idle/hook→busy/hook→idle/poll proves fallback overwrote synthetic parent busy. Identical 250 ms diagnostic gap green with only fixture pushTrustMs120000; permanent race comment names it, diagnostics removed. Original parent model/state and exact child-attribution assertions/deadlines retained. Full session-model11/11 and root typecheck pass. Sole non-tracker delta is this commented opt-in; final merge only three tracker files, tested application tree identical. Shared defaults/timers/audit and C2/C5 measured cases unchanged. Claimant C7 done renewed; source criteria refreshed. C2/C5/readiness await same-head local no-mode gate; prior67ff8613/A-2593 red retained. A-2597: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2597-t-389-source-correction-isolate-synthetic-parent-busy-state.md.

Criteria: C1 verified, C3 verified, C4 verified, C6 verified, C7 verified, C8 verified.

### impl-389 · 2026-10-14T23:25:51.385Z

Corrected source clear rev-2026-10-14-389-7 / A-2597 at e11eceda; C7 verified and source criteria refreshed. New exact-head local no-mode verification7e936a2a-4167-4f2d-b486-74cdbbe17e17 submitted, queue position1 behind impl-432, recipients rev-23/impl-389. Clean pushed head unchanged after verdict; all diagnostics removed. Idle awaiting accepted gate/final C2/C5 marks/merge, claim retained.

### impl-389 · 2026-10-14T23:52:24.769Z

Exact reviewed-head local no-mode verification7e936a2a-4167-4f2d-b486-74cdbbe17e17 passed at e11eceda: full mode,2075/2075 pass,0fail/cancel/skip/todo; hub and Neovim phases complete. Darwin arm64,Node24.21.0,Neovim0.12.5; queue619.43s, suite967.44s, peak1m load14.86. Result A-2600, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2600-suite-7e936a2a-4167-4f2d-b486-74cdbbe17e17-auto-at-e11eced.log. Clean source unchanged after source verdictrev-2026-10-14-389-7. C2 corrected watchdog refresh A-2577/A-2578 and C5 26.27% paired reduction A-2558 already checked by reviewer; awaiting final marks/verdict and supervising merge. Claim retained, no new source change.

### rev-23 · 2026-10-14T23:52:57.897Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-389-8
commit: e11eceda8c2d9d71c2510371e4c8ca836324468f
scope: evidence

Final clear; all C1–C8 claimant done marks confirmed, unchanged clean head. Local no-mode full 7e936a2a/A-2600 passes root typecheck and 2075/2075 (37 free, 1651 hub, 387 Neovim), zero failures/cancellations/skips/todo. Source A-2565/A-2576/A-2587/A-2597 retained; corrected audit, observer, parent-state and timing cases pass. C2/C5 judged under direct Coordinator2235f1f7 loaded A/B amendment, not idle/absolute under5. Refreshed watchdog A-2577/A-2578 median33.688→16.829s including stop, six green; unchanged shell/host16.529→13.521s and Claude33.149→7.005s keep A-2563 provenance, historical failed baseline disclosed. C5 raw24 green samples A-2558/A-2564 recalculate310.177282→228.694178s,26.269849% reduction; later independent corrections do not change measured cases/controls, no whole-suite or idle claim. Earlier4b2735cc/A-2572 scan race, fa8df54b/A-2582 T-441 and67ff8613/A-2593 parent-state failure all retained with reviewed corrections. All original assertions preserved, no high/medium findings. A-2601: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2601-t-389-final-exact-head-gate-and-loaded-timing-criteria.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
