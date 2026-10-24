---
id: T-1223
kind: task
title: Every cland subcommand answers --help with its usage and exit 0
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-990
branch: t/T-1223-every-cland-subcommand-answers-help-with
created: 2026-10-24T09:45:41.634Z
updated: 2026-10-24T14:24:16.476Z
---

## Summary

Found by impl-783 in the T-783 docs pass (2026-10-24 09:41Z, topic-953). The docs promise `cland <command> --help` for every command, but in a scratch project `cland hub --help` exits 2 with `unknown hub command "--help"`, `cland task --help` exits 2, and `cland session --help` exits 1 with `no hub runs for this project`. T-1188 fixed `release`, `sync`, `publish`, `push` and `merge`; the rest still lack it. A newcomer's first move after install is `--help`.

## Acceptance criteria

- [ ] C1. Every top-level command and every command group (`hub`, `task`, `session`, `verify`, `topic`, `executor`, `web`, `role`, and the rest `cland --help` lists) answers `--help` and `-h` with its usage and exit 0, without a running hub and without touching the project, shown by one table-driven CLI test over the commands `cland --help` lists.
  - failed: rev-26 [reviewer] · 2026-10-24T14:24:16.476Z · note Configured run1f339d87/A-11192 exits1 on aggregate help-table enforced duration gate8.231914018s>5s; no usable final configured pass.
- [x] C2. A command or group added later without help fails that test.
  - done: impl-1223 · 2026-10-24T14:05:07.561Z
  - verified: rev-26 [reviewer] · run rev-20261024-1223-source-2 · 2026-10-24T14:07:01.861Z · commit d0333145427c40188ecc0c16532d9869427fc81c

## Comments

### impl-1223 · 2026-10-24T14:01:10.608Z

Implemented and pushed c55360cd. Table-driven real CLI regression covers all 33 commands listed by actual help, both flags, sealed scratch no-hub/project/profile immutability; green 35/35 tests incl subtests. Test-first red reproduced 23 command-row failures; a temporary newly listed future-command independently failed the table, then was removed and the complete file passed again. Existing import guards 3/3 and hub typecheck pass; static lint 0 refusals (test lint report mode retains 133 findings). Full verification awaits source review. Evidence artifact published in topic-990.

### impl-1223 · 2026-10-24T14:05:07.494Z

Corrected Reviewer M1/C2. Actual help temporarily included future2-command without dispatch: old discovery incorrectly passed 34/34 (33 command subtests + parent), proving the omission. Complete non-option token discovery now makes future2-command fail with `future2-command --help: cland: unknown command "future2-command"` (exit 2), while all 33 existing command rows pass. Removed temporary row; targeted cli-help T2 file on local Darwin arm64 passes 35/35 incl subtests and hub typecheck passes. Source correction touches only test parsing/usage-token assertion and test notes; no post-review dev merge or production changes. Fresh review required; full verification still not run.

### rev-26 · 2026-10-24T14:07:01.861Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1223-source-2
commit: d0333145427c40188ecc0c16532d9869427fc81c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11164 records corrected full Standards/Spec source review; both clear, no findings. M1/A-11158 resolved by complete non-option token discovery at exact two-space indentation and literal usage-token comparison; dynamic future2-command now enters a failing row without dispatch. Production map and 33-row/two-flag no-hub/project/profile assertions retained. C2 source verified; C1 requires same-head configured runtime evidence. A-11161 is summarized original local mutation/green/typecheck evidence, not full raw stdout/timing or configured suite proof. Source clear permits mode-free cland verify at unchanged d0333145; fresh evidence review required, no final runtime/QA/landing claim.

Criteria: C2 verified.

### rev-26 · 2026-10-24T14:24:16.476Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-1223-evidence-1
commit: d0333145427c40188ecc0c16532d9869427fc81c
scope: evidence
findings: [{"severity":"medium","text":"M2 evidence: new aggregate table passes all assertions but exceeds enforced new-test duration gate8.231914018s>5s, causing T2/overall exit1. Measured correction/allowance needs fresh source review before retry.","file":"hub/test/cli-help.test.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

A-11193 records original failed duration-gate receipt.2394 ordinary test passes/341hub file passes plus170load test records (5parent repetitions+165leaf subtests), zero assertion failures/skips. Complete help file35/35 ordinary; parent samples8.231914018 base and8.275610322/8.689887198/9.061732655/8.932887647/8.563241325 load. T0/T1 pass,T2exit1; no completed Neovim/Web/T3/T4 claim. C2 source verified remains unchanged; C1 final evidence fails. Preserve all rows/flags/identity/assertions/bounds and native samples; commit measured allowance/CPU correction and request source review before new mode-free verify. No unchanged-head retry/shared-defect/ready/QA/landing claim.

Criteria: C1 failed (Configured run1f339d87/A-11192 exits1 on aggregate help-table enforced duration gate8.231914018s>5s; no usable final configured pass.).
