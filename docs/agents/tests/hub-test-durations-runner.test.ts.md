# hub/test/durations-runner.test.ts

The fixture-guard bootstrap regression uses the real `runSuite` path with one
ordinary guard case and five sequential fresh-process load-gate repetitions.
Every guard acknowledges IPC registration and supplies a positive native exit;
six durable exit rows plus five completed repetition receipts are required.
Its explicit five-second test watchdog bounds the IPC regression, not a speed
assertion. The disposable runner owns all fixture roots and native cleanup.
Dedicated guard forks clear inherited `execArgv`: runner `--import` admission
bootstraps must not execute inside a reaper whose sealed environment omits their
worker/start controls. The scripted fixture exposes an already-settled exit
promise and still creates no guard process.

The shared-contract fixture imports a registration helper from its `.test.ts`
wrapper. Its completed run must retain five passing wrapper identities, one
ordinary timing, and a report-only duration overage classified as T1 for that
same wrapper. The unchanged direct-registration load fixture remains the control.
Every outer case uses `suiteCase` before fixture acquisition. The fixture helper's named
`fixture setup` deadline covers acquisition and source/manifest writes;
`native runner completion` separately bounds each original native run. Caller
configuration and assertions remain owned through teardown. Signal observations
use shared load-scaled condition waits and separately bound the runner exit.
Shared teardown fences admission and joins both original continuations before
removing their roots; failed drainage retains the fixture. Each fixture checks
that its root was removed after cleanup. A guard-only acquisition control checks
one setup entry and positively exercises launch denial before and after setup;
native lifecycle cases keep their explicit native opt-in and the file stays T3.
The shared `durations-runner-fixture.ts` checks admission before its native
launch. Each captured child enrolls an early stop action before the case joins
pending completion; completion waits for native close and captured-owner
cleanup. The fake-only close regressions live in case-deadlines.test.ts (T2).
The optional `CLAND_LOAD_GATE_SLOW_PROBE=1` eight-identity probe keeps its
existing 600-second bound through `suiteCase`'s explicit `timeoutMs` option;
ordinary callers retain the shared default. The probe's journal asserts six
completions per identity, sequential repeats and at most two repetition lanes.

The task duration fixture runs a disposable package with a T3 marker and T4 marker, plus an unchanged process file. Wait for the child exit receipt, then assert each marker appears once, the soak prerequisite was enabled, and no load repetition started. Assert the summary names the printed allowance stanza even beside T4's no-budget label. Retain the full JSON allowance in suiteSummary and verify durations.json bytes are unchanged. Native processes use fixtureEnvironment and owned cleanup. These local fixtures prove the runner contract; live Linux evidence requires the hosting hub capability and droplet receipt.

The prerequisite receipt fixture includes a conditional platform skip targeting
the other supported OS. Its positive-only run must exit zero and report exactly
`5/5 skipped` with the reason, retained by `suiteSummary`, without `5/5 passed`.
The mixed run retains reasonless boolean, blank-reason, TODO and mixed-outcome
negative controls. Run this case with
`node --test --test-name-pattern='one load-gate fixture' hub/test/durations-runner.test.ts`.
