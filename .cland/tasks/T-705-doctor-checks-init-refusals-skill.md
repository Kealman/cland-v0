---
id: T-705
kind: task
title: Doctor checks, init refusals, skill template commands and worktree discovery run in-process, with three real CLI runs each at most
state: open
status: planned
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: null
created: 2026-10-16T19:59:37.526Z
updated: 2026-10-16T20:00:52.576Z
---

## Summary

These files spawn the CLI once per matrix cell, for logic that their modules export (memo §2.2 win 4; report-slice4 #2 and #8, report-slice3 #7, report-slice2 territory-cli):

| File | Seconds | Note |
|---|---:|---|
| `doctor.test.ts` | 66.0 | ~40 `cland doctor` runs; its 45.5 s test is 13 subtests of pure check logic. `runDoctor` is already importable (`orphan-sweep-lock.test.ts`) |
| `init.test.ts` | 35.1 | ~45 `cland init`/`update` runs; an 8-manifest rejection loop and a 4-root symlink matrix |
| `skills-tracker.test.ts` | 31.8 | ~20 CLI runs that all exit `no hub running`; 4 parent kinds × a 3-ticket scenario |
| `worktree-cli.test.ts` | 35.1 | 4 commands × 4 cwds compared to the root |
| `territory-cli.test.ts` | 25.8 | 9 of 14 `cland init` runs are refusals |

## What to build

- **doctor.** The check matrix (Ghostty variants, version ranges, OpenCode majors, auth and config states) runs through `runDoctor` in-process. Three real CLI runs stay: the healthy machine in text and JSON with its exit code, the hanging-probe process-group kill, and the no-hub warning.
- **init and territory-cli.** Manifest rejections, the symlink matrix and the refusal cases call the init module directly; two or three real `cland init`/`update` runs keep the `git status` contract.
- **skills-tracker.** Template commands are parsed by the CLI's argv parser in-process. The parent-kind loop is one scenario plus a table on parent resolution.
- **worktree-cli.** One discovery proof per cwd (`hub status --json`) and one write command; the stale-discovery stop test stays.

## Acceptance criteria

- [ ] C1. The five files' manifest seconds fall from 193.8 s (A-3877) to 95 s or less.
- [ ] C2. CLI subprocesses started by the five files fall by at least two thirds, counted by the spawn census's per-file row before and after.
- [ ] C3. The moved matrices are T1 or T2 tests that pass the tier lint, and the kept CLI runs each name the CLI behaviour they prove.
- [ ] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
