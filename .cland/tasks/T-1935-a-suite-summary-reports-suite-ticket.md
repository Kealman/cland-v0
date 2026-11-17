---
id: T-1935
kind: task
title: A suite summary reports "suite ticket lost" for a green run because it takes any log line starting "suite infrastructure:", including test fixture output
state: open
status: in progress
size: S
labels:
  - needs-triage
  - regression
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1576
topic: null
branch: t/T-1935-a-suite-summary-reports-suite-ticket
created: 2026-11-17T06:37:12.828Z
updated: 2026-11-17T06:40:03.948Z
---

## Summary

T-1850's verify 067aad91 (A-20707) passed: 6583 of 6583, T0, T1, T2 and Web exit 0, and the hub recorded it as passed. Its summary still read "auto exit 0; suite infrastructure: suite ticket lost; remover unknown". The line comes from a test fixture, not from the runner: hub/test/suite-command.test.ts:70 writes exactly that cause to a fake child's stderr, and the line reaches the run log (A-20707 line 28717, followed by the fixture's "still writing unrelated output"). hub/src/hub/suites.ts:179 then collects every line starting with `suite infrastructure: ` into the summary. Any test that prints such a line can make a green run look like an infrastructure loss, or hide a real one among false ones.

## What to build

The summary takes infrastructure causes only from the runner's own channel (the worker or result receipt), never from test output in the log, or it marks lines from inside a test file's output so they are excluded. Fixture tests can keep printing their planted causes.

## Acceptance criteria

- [ ] C1. A run whose test output contains a `suite infrastructure:` line, but whose runner records no infrastructure cause, has a summary with no infrastructure cause (test).
- [ ] C2. A real runner-recorded ticket loss still appears in the summary with its cause (test).
- [ ] C3. The readers of the summary's infrastructure lines (heartbeat, digest, merge queue diagnosis, T-204 tooling) are listed with their dispositions (rule 20).

## Comments

### coord · 2026-11-17T06:37:39.304Z

Added by impl-1850 (topic-1589): the contamination also reaches the typed droplet result. hub/src/executor/droplet/run.sh:18 greps the `suite infrastructure:` prefix out of suite.log into $run/cause, so result.json for 067aad91 carries code 0 with the fixture cause (no notRun; finished 06:35:33Z), while the log's real "Finished: exit 0" is at A-20707:38094. The fix covers both: run.sh:18 and hub/src/hub/suites.ts:179. Both should take the cause only from the runner's own channel. Note that run.sh comes from the running hub (run.ts:156), so the run.sh half takes effect only after a hub restart.

### coord · 2026-11-17T06:39:20.592Z

Since T-1576 landed (f9b490e17, which added the suite-command.test.ts infrastructure fixture), every run that includes that file reports this false cause. Second occurrence: T-1660's verify 92c9564f (A-20708 line 28547), green 6580/6580. It is a release-blocking annoyance, because each green verify now looks like an infrastructure loss. Prefer fixing it in this release before T-1931's hub restart, so the run.sh half ships in the same restart.
