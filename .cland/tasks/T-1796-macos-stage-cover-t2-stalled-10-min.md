---
id: T-1796
kind: task
title: macOS stage cover T2 stalled 10 min after its last file passed (command end 1, no failing test)
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1547
branch: t/T-1796-macos-stage-cover-t2-stalled-10-min
created: 2026-11-09T18:33:53.922Z
updated: 2026-11-16T09:54:35.262Z
---

## Summary

The macOS local stage cover e50b7ddb at dev 700f88ce (A-18171) ended `exit 1; stalled: no output for 10 min` in T2 with no failing test: 1611 pass, 0 fail. The last T2 files, web-tunnel-guide.test.ts and web-upload.test.ts, both ran to `finish … outcome pass`. Then the log shows `suite command end … 1` and nothing more until the 10-minute stall guard fired. So the T2 command didn't exit after its last file completed: a handle or child process survived the file teardown, or the runner waited on something. Its "last started tests" list names files that had in fact finished. Alone, both files pass 5/5 in about 1 s each on macOS at the same commit.

## Acceptance criteria

- [ ] C1. Identify what kept the T2 command alive after its last file finished: a live handle, a child process or a runner wait. Retain the evidence in the stall report (for example the active handles or child processes at the stall) (test).
- [ ] C2. The stall report's "last started tests" lists only tests that started without finishing (test).

## Comments

### impl-1796 · 2026-11-16T09:54:35.262Z

Consumer sweep (rule 20): suiteCommand callers hub/src/hub/suite-worker.ts and hub/src/release-web.ts retain {code,cause}; hub/src/hub/suite-cover.ts and hub/src/hub/suites.ts classify the unchanged stall prefix. suite-log.ts parses command end, unchanged. suite-timeouts.test.ts (T3), suite-worker-cause.test.ts, suite-cover.test.ts, executor-run-rules.test.ts and suite-summary.test.ts retain existing cause/prefix compatibility. suite-progress.ts, suite-progress.test.ts and suite-runner.test.ts consume unchanged reporter progress frames. CLI suite.ts, heartbeat, Neovim and web render log/cause text; no structured stall field changed. Searched field, text, frame and function names across hub, nvim, web, shared, qa, docs and shipped .agents skills (all tiers included); no QA/skill parser of last-started text found. Updated running.md/tests.md to unfinished-only semantics. New log-only process census is additive; no wire/result fields removed.
