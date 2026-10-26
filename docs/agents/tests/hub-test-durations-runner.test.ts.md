# hub/test/durations-runner.test.ts

The task duration fixture runs a disposable package with a T3 marker and T4 marker, plus an unchanged process file. Wait for the child exit receipt, then assert each marker appears once, the soak prerequisite was enabled, and no load repetition started. Assert the summary names the printed allowance stanza even beside T4's no-budget label. Retain the full JSON allowance in suiteSummary and verify durations.json bytes are unchanged. Native processes use fixtureEnvironment and owned cleanup. These local fixtures prove the runner contract; live Linux evidence requires the hosting hub capability and droplet receipt.

The prerequisite receipt fixture includes a conditional platform skip targeting
the other supported OS. Its positive-only run must exit zero and report exactly
`5/5 skipped` with the reason, retained by `suiteSummary`, without `5/5 passed`.
The mixed run retains reasonless boolean, blank-reason, TODO and mixed-outcome
negative controls. Run this case with
`node --test --test-name-pattern='one load-gate fixture' hub/test/durations-runner.test.ts`.
