---
id: T-808
kind: task
title: record-nvim-frames treats a skipped Neovim file as a success and can replace the catalog with zero recordings
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
regression_of: T-709
topic: topic-716
branch: t/T-808-record-nvim-frames-treats-a-skipped
created: 2026-10-18T14:48:39.460Z
updated: 2026-10-20T10:13:46.767Z
closed: 2026-10-20T10:13:46.767Z
---

## Summary

Found by impl-774 while reading the recorder. `hub/test/record-nvim-frames.ts` `run()` checks only the exit code, and a Neovim test file that skips (no binary available) exits 0. A full `test:nvim-fixtures` refresh on a machine without Neovim can therefore rewrite the main catalog with zero recordings, then skip its own final live check as well.

## Acceptance criteria

- [x] C1. A capture whose files were skipped, or that recorded zero frames for a file that had frames before, refuses before any fixture is replaced, naming the file. A T1/T2 test with a fake unavailable-binary control proves it.
  - verified: rev-31 [reviewer] · run rev-20261020-808-final · 2026-10-20T10:07:25.006Z · commit 3b2228d675f2a21d227ab01c9c1191cf7ba2b881
  - done: impl-808 · 2026-10-20T10:07:39.339Z
- [x] C2. The final live check fails closed: the shared runner refuses any successful-exit run that lacks a complete nonzero zero-skip receipt, including the final workbench producer check, so an unavailable Neovim or a skipped file can never pass it.
  - verified: rev-31 [reviewer] · run rev-20261020-808-final · 2026-10-20T10:07:25.006Z · commit 3b2228d675f2a21d227ab01c9c1191cf7ba2b881
  - done: impl-808 · 2026-10-20T10:07:40.487Z

## Comments

### impl-808 · 2026-10-20T09:43:00.142Z

A-7125 row confirmed. C2 is moot as written: final recorded-protocol test in nvim/test/scenarios/workbench.test.ts has no skip option and uses projectHub (no Neovim binary). C1 implementation will validate all captures before replacing fixtures, including skips and expected per-file/catalog frame counts.

### rev-31 · 2026-10-20T09:57:40.319Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-808-source
commit: 3b2228d675f2a21d227ab01c9c1191cf7ba2b881
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7303: full source review clear. Standards and Spec: no findings. All captures validate before fixture publication; skip/zero/reduced receipts refuse with file attribution. Four new T1 identities require actual same-head 5/5 load receipts. C2 remains unverified: the final selected live producer check uses projectHub with no Neovim skip; lead reconciliation is requested separately.

### rev-31 · 2026-10-20T10:07:25.006Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-808-final
commit: 3b2228d675f2a21d227ab01c9c1191cf7ba2b881
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7355: final evidence clear. C1 and Coordinator-reconciled C2 verified: exact-head 741b0300/A-7344 passes 1950 ordinary tests and all four new identities 5/5 (twenty repetitions), maximum owned body 0.005817559 s. No resource/duration failures; new file has a report-only missing baseline, recorded explicitly. No real recorder/T3 run is claimed.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:13:46.767Z

Merged 071bc44547cf9368d4cbd1463ed5f8405e962a67 onto dev.
