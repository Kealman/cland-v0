---
id: T-389
kind: task
title: "Timing diet: fake harnesses default to fast turns and polls with explicit slow opt-ins, timer-bound tests run on env-controlled schedules, and fixed sleeps become event waits"
state: open
status: planned
size: M
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-386
blocked_by: []
topic: null
branch: null
created: 2026-10-14T12:28:10.336Z
updated: 2026-10-14T12:28:23.777Z
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

- [ ] C1. `fakeClaude` and `fakeCodex` default to 30 ms turns, 50 ms polls, 100 ms push trust and a 150 ms Codex refuse window, and every test that passes a slower value has a comment naming the race or behaviour it needs.
- [ ] C2. Measured alone on an idle machine, the three timer-bound tests ("prepare, run, fallback, cancel…" 33.0 s, "…default 30-second schedule…" 32.3 s, "the remote shell and the host deadline…" 15.1 s) each take under 5 s; before/after times and the one-minute load are posted on the item.
- [ ] C3. The 30-second default is still asserted, from the resolved schedule the hub reports with the env unset, and the sharing and early-stop behaviour is asserted at a short override.
- [ ] C4. Every sleep of 0.5 s or more in `hub/test` and `nvim/test` is either an event wait, an interval multiple with its interval named, or kept with a comment, and the classified list is posted on the item.
- [ ] C5. Measured: the whole-file times of `codex-adapter.test.ts`, `claude-code-adapter.test.ts`, `opencode-adapter.test.ts` and `session-usage.test.ts` on an idle machine fall by at least 25% in sum (median of three runs each), with before/after posted.
- [ ] C6. No assertion changes its meaning: the review request lists every changed assertion with what it still proves, and no test is skipped or deleted.
- [ ] C7. Any race exposed by the fast defaults is reported as a Bug with its size, and its test's opt-in names that bug.
- [ ] C8. `hub/README.md` (the fake harnesses) and the comments at the top of the three fakes describe the fast defaults and how to opt into slow turns.
