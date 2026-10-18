---
id: T-777
kind: task
title: selection-replay.ts ignores --count for package replay and iterates every landing
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-517
branch: t/T-777-selection-replay-ts-ignores-count-for
created: 2026-10-18T05:03:00.942Z
updated: 2026-10-18T16:23:30.946Z
---

## Summary

Found by impl-709 on 2026-10-18 at 05:01Z, during T-709. hub/test/selection-replay.ts parses `--count`, but only the coverage replay applies it. The non-coverage package replay iterates every landing instead of the requested window. T-709's dedicated Neovim replay slices exactly 40 itself.

## What to build

Package replay slices to the last `--count` landings, the same way coverage replay does, and fails clearly when fewer landings exist than requested.

## Acceptance criteria

- [x] C1. A T1 test runs package replay with `--count 3` over five recorded landings and gets exactly the last three, and fails before the fix.
  - done: impl-777 · 2026-10-18T16:22:25.233Z

## Comments

### impl-777 · 2026-10-18T16:20:16.101Z

C1's pre-agreed T1 seam: package replay over recorded landings with --count 3. Extract the existing package replay loop behind injected Git/output boundaries so the regression runs in-process with no subprocess or wall-clock waits; shared count parsing will remain used by the CLI and coverage path. Test exact newest three (Git's newest-first order), then insufficient history.

### rev-30 · 2026-10-18T16:23:30.946Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-777-source
commit: 47d785f338e0f0809ff6314c5d44d57309cfaa9e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear against238871a5. Package replay now slices newest-first filtered landings to validated count before diff/selector calls and explicitly refuses incomplete windows. CLI preserves raw count options before argument stripping; default40/validation match prior behavior. Historical selector/import scanner injection and scratch cleanup remain; coverage replay body unchanged. T1 exact-three-of-five and insufficient-history controls use recorded Git/output with no processes/waits; manifest entry present. A-5415 documented pre-fix extra rows reviewed; local2/2, existing coverage1/1 and lint/typecheck are reported. Standards/spec: no findings. C1 final verification remains pending one exact-head mode-free droplet gate. No Reviewer execution or per-item QA.
