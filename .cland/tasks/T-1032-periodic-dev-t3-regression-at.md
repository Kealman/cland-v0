---
id: T-1032
kind: task
title: Periodic dev T3 regression at 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - dev-t3-07eeff96cb31d8e1cc391a95edd3408d9f0edf4d
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-991
found_by: droplet
topic: topic-779
branch: t/T-1032-periodic-dev-t3-regression-at
created: 2026-10-20T23:58:31.284Z
updated: 2026-10-21T03:04:06.264Z
closed: 2026-10-21T03:04:06.264Z
---

## Summary

Landed merge 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d first fails hub/test/typecheck.test.ts between the pinned green and red periodic heads.

## Evidence

Periodic run b32f6ed5-0f50-48d0-a2ae-90589cee322a; red head 7313b6939e085b1763580ebb51913a7f9e7ce5bf; tree 6b454423a87edeb20b70a25d4f21b9431581683c
Last green run 92354758-ca83-4dd2-8748-7dd63f292b68; head 0c6616845a568eeaf5a48f876a85d47f1fa1a6ba
Original log A-8104: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8104-suite-b32f6ed5-0f50-48d0-a2ae-90589cee322a-all-at-7313b69.log
hub/test/typecheck.test.ts: culprit at 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d The web phase of the suite (T-991)
Run 2bbe9435-64e5-4b66-b9ab-c434e7864818; head 7313b6939e085b1763580ebb51913a7f9e7ce5bf; red; log A-8105: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8105-suite-2bbe9435-64e5-4b66-b9ab-c434e7864818-all-at-7313b69.log
Run 6ef8a959-0420-4bd9-9bda-a202d3bc869e; head 0c6616845a568eeaf5a48f876a85d47f1fa1a6ba; green; log A-8106: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8106-suite-6ef8a959-0420-4bd9-9bda-a202d3bc869e-all-at-0c66168.log
Run 15b61fed-1a1c-43cd-a06e-33a6131fc7c4; head d8a7781c5fd15e379bc9261248bc482b96311d0c; green; log A-8107: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8107-suite-15b61fed-1a1c-43cd-a06e-33a6131fc7c4-all-at-d8a7781.log
Run 078c11c9-3f29-42e4-86a8-b6aed0c62237; head 07eeff96cb31d8e1cc391a95edd3408d9f0edf4d; red; log A-8108: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8108-suite-078c11c9-3f29-42e4-86a8-b6aed0c62237-all-at-07eeff9.log

## Acceptance criteria

- [x] C1. hub/test/typecheck.test.ts passes with the web workspace: its project fixture carries the files web/test and web/tsconfig.tools.json import from hub/test and hub/src, derived from the import closure rather than a hand list (targeted local T3 run named in the item).
  - done: impl-1032 · 2026-10-21T02:54:33.388Z
  - verified: rev-23 [reviewer] · run rev-20261021-1032-final · 2026-10-21T02:59:47.283Z · commit 80cc33c83802e97909800abb1e78a04161dbbc91

## Comments

### impl-1032 · 2026-10-21T02:54:13.909Z

Read T-1019 and T-1023 fixture changes. Reproduced the existing T3 contract test locally on macOS using system TMPDIR, a disposable cwd and fixtureEnvironment scratch HOME/XDG/Git with filtered credentials: five TS2307 errors from web/test/harness.ts. The fix derives workspaceSources from the workspace typecheck scripts’ -p tsconfigs using TypeScript config parsing, then sourceFixtureFiles carries their cross-workspace import closure. Targeted local hub/test/typecheck.test.ts passes 1/1 (5.15 s file duration); baseline failed 0/1 (1.23 s). These are targeted T3 receipts, not full suite/gate evidence. Fetched/merged origin/dev before review; only tracker files changed in that update.

### rev-23 · 2026-10-21T02:55:56.925Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1032-source
commit: 80cc33c83802e97909800abb1e78a04161dbbc91
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec audit A-8110 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8110-t-1032-source-review-at-80cc33c8.md). Actual A-8105 TS2307 diagnostics name the five omitted cross-workspace imports. Parsed script-selected workspace tsconfig inputs now seed sourceFixtureFiles, retaining full transitive closure without a hand list. Existing minimal compiler fixtures, scripts/configs, pinned CLI/API and root/inherited/local-worktree assertions are preserved. Diff check clear; no findings. A-8109 local targeted T3 1/1 on matching patch/static check are separately scoped, not a full gate or Linux claim. C1 remains runtime-unverified until normal same-head configured verification is assessed alongside that targeted evidence. No Reviewer processes launched.

### rev-23 · 2026-10-21T02:59:47.283Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1032-final
commit: 80cc33c83802e97909800abb1e78a04161dbbc91
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; audit A-8115 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8115-t-1032-final-evidence-review-at-80cc33c8.md). Same-head configured ed24b016/A-8114 passed Linux T1: 670 ordinary test finishes/113 files; selected T2 command has no tests, Web NOT RUN for missing Linux libraries, no T3/T4 execution. Host check 5ddacec5 not repeated remotely; lint/budget/ratchet report-only. C1's named targeted local macOS T3 red→green (0/1→1/1) is separately retained in A-8109 on matching source patch, with full compiler assertions preserved by source audit. This establishes the requested local T3 criterion alongside the green configured scope; no Linux T3/browser/integrated/timing pass claimed. No findings; verify C1.

Criteria: C1 verified.

### coord · 2026-10-21T03:04:06.264Z

Merged 22a0cbf0c1f92bff9c0df4f4e280fbf0795d9d3f onto dev.
