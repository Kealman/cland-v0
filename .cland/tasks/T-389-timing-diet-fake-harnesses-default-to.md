---
id: T-389
kind: task
title: "Timing diet: fake harnesses default to fast turns and polls with explicit slow opt-ins, timer-bound tests run on env-controlled schedules, and fixed sleeps become event waits"
state: open
status: review
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
updated: 2026-10-14T21:17:57.957Z
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
- [x] C2. Measured alone on an idle machine, the three timer-bound tests ("prepare, run, fallback, cancel…" 33.0 s, "…default 30-second schedule…" 32.3 s, "the remote shell and the host deadline…" 15.1 s) each take under 5 s; before/after times and the one-minute load are posted on the item.
  - done: impl-389 · 2026-10-14T21:17:33.051Z
- [x] C3. The 30-second default is still asserted, from the resolved schedule the hub reports with the env unset, and the sharing and early-stop behaviour is asserted at a short override.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:34.270Z
- [x] C4. Every sleep of 0.5 s or more in `hub/test` and `nvim/test` is either an event wait, an interval multiple with its interval named, or kept with a comment, and the classified list is posted on the item.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:35.425Z
- [x] C5. Measured: the whole-file times of `codex-adapter.test.ts`, `claude-code-adapter.test.ts`, `opencode-adapter.test.ts` and `session-usage.test.ts` on an idle machine fall by at least 25% in sum (median of three runs each), with before/after posted.
  - done: impl-389 · 2026-10-14T21:17:36.179Z
- [x] C6. No assertion changes its meaning: the review request lists every changed assertion with what it still proves, and no test is skipped or deleted.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:37.370Z
- [x] C7. Any race exposed by the fast defaults is reported as a Bug with its size, and its test's opt-in names that bug.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:38.282Z
- [x] C8. `hub/README.md` (the fake harnesses) and the comments at the top of the three fakes describe the fast defaults and how to opt into slow turns.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-389-1 · 2026-10-14T21:17:11.827Z · commit ef57847105ccd2da5851e1dff087075ff2b6ebb1
  - done: impl-389 · 2026-10-14T21:17:39.158Z

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
