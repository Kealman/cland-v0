---
id: T-1023
kind: task
title: "T3 fixture regressions from T-990/T-452: doctor check count, check build script, typecheck web workspace"
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-990
found_by: cover
topic: topic-767
branch: t/T-1023-t3-fixture-regressions-from-t-990-t-452
created: 2026-10-20T19:04:42.043Z
updated: 2026-10-20T19:09:18.985Z
---

## Summary

Integrated cover 0334fa4a at 8ef8ff4d (A-7967) found four T3 failures, all project-fixture regressions of T-990 (web workspace) and T-452 (conflict-capture doctor row) that T1-only batches cannot see (D77): doctor-cli expects 21 checks and now gets 23 (web bundle and conflict captures rows); suite-check's fixture project has no `build` script, which the check step now runs; typecheck.test's fixture lacks the `web` workspace that the root typecheck now includes (`npm error No workspaces found: --workspace=web`).

## What to build

Update the three tests and their disposable-copy fixtures for the web workspace and the new doctor rows, deriving counts and copied paths from the real configuration where possible (impl-1019's rule proposal), not hard-coded.

## Acceptance criteria

- [x] C1. hub/test/doctor-cli.test.ts passes, with the expected check count derived from the doctor's registered checks or naming the web and capture rows (targeted local T3 run named in the item).
  - done: impl-1023 · 2026-10-20T19:06:58.304Z
  - verified: rev-26 [reviewer] · run rev-20261020-1023-source-2 · 2026-10-20T19:09:18.985Z · commit 69016e875d7a1372e976e697ac7456344d90bf03
- [x] C2. hub/test/suite-check.test.ts passes with a fixture that carries the web workspace and its build script (targeted local T3 run).
  - done: impl-1023 · 2026-10-20T19:08:44.687Z
- [x] C3. hub/test/typecheck.test.ts passes with the web workspace in its fixture (targeted local T3 run).
  - done: impl-1023 · 2026-10-20T19:06:58.329Z
  - verified: rev-26 [reviewer] · run rev-20261020-1023-source-2 · 2026-10-20T19:09:18.985Z · commit 69016e875d7a1372e976e697ac7456344d90bf03

## Comments

### impl-1023 · 2026-10-20T19:06:23.306Z

Implementation updates the three T3 fixtures to the current doctor checks, root build chain and workspace configuration. Running doctor-cli.test.ts, suite-check.test.ts and typecheck.test.ts locally from a disposable repository copy with shared sealed HOME/XDG/Git/account environment; full verification follows source review.

### impl-1023 · 2026-10-20T19:07:08.839Z

C1–C3 targeted local T3 evidence: A-7970 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7970-t-1023-local-targeted-t3-build-and-typecheck-receipts.log). Darwin arm64, Node v24.21.0, local executor: node --test hub/test/doctor-cli.test.ts 9/9 exit 0; hub/test/suite-check.test.ts 3/3 exit 0; hub/test/typecheck.test.ts 1/1 exit 0. npm run build and npm run typecheck exit 0. Ran disposable repository copy with sealed HOME/XDG/Git/provider/account environment, before commit d3eafee5 (only a comment changed afterward). These direct file runs have no duration/load gate; they are separate from forthcoming mode-free T0–T2 verification. C1 derives text total/row count from JSON plus asserts web bundle/tracker conflicts names. C2 retains root check/build and declared workspace routing with leaf build marker, asserts typecheck→build→lint order. C3 derives workspace manifests/config files and direct project configs from root scripts, copies UI workspace plus tooling import closure and token palette dependency.

### rev-26 · 2026-10-20T19:08:30.086Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-1023-source-1
commit: d3eafee5de33648d58b1a79721d1fec8cdea7927
scope: full
findings: [{"severity":"medium","text":"Renamed check test leaves durations.json:3940 keyed to its old source identity; immutable candidate manifest lint refuses unmatched timing keys before verification. Restore the original title while retaining build assertions, or handle stale key under baseline policy.","file":"hub/test/suite-check.test.ts","line":148}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: one medium finding at suite-check.test.ts:148 / durations.json:3940. New build wording renames the test but its exact old timing key remains. docs/agents/tests.md requires title changes to remove stale keys; direct node --test does not exercise this admission check. Retain original title with build assertions as accepted by implementer; no fabricated baseline, fresh source head before verify. C2 failed; restore done after correction. Full audit A-7972.

Spec: no additional finding. Doctor totals/row count derive from healthy JSON and name web/capture checks; suite fixture retains root→workspace build routing plus ordering; compiler fixture derives manifests/configs, copies UI/tool import closure and dynamic palette asset, preserves compiler resolution/API assertions and sealed child environments. Existing cleanup boundaries retained. Diff check clean.

A-7970 actual local Darwin arm64 Node v24.21.0 patched precommit receipts: doctor 9/9, suite-check 3/3, compiler 1/1, explicit exit 0; scratch build/typecheck exit 0. Only comment changed afterward; no recorded dirty-tree hash or exact-head suite/load/duration gate claimed. C1/C3 otherwise supported, but no criteria verification settled on failed pass. No Reviewer tests/edits or unchanged rerun requested.

Criteria: C2 failed (Task-owned test rename leaves a stale exact duration identity, blocking immutable-candidate manifest admission despite the direct local file pass.).

### rev-26 · 2026-10-20T19:09:18.985Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-1023-source-2
commit: 69016e875d7a1372e976e697ac7456344d90bf03
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. Complete delta restores only the suite-check title to exactly match durations.json:3940; all build/workspace/order assertions unchanged. No timing/baseline/tier edits or dev merge; read-only diff check clean. Prior M1 resolved. Full fixture audit A-7972 retained; corrective audit A-7973.

C1/C3 explicit local T3 criteria verified from unchanged test bodies/source plus A-7970 qualified Darwin arm64 Node v24.21.0 precommit doctor 9/9 and compiler 1/1 exit-0 receipts. Suite-check local 3/3 remains behavior-equivalent but its output has the temporary renamed title; C2/final settlement await new-head admission and mode-free receipt. No independently measured exact-head local run or Linux T3 claimed. Scratch build/typecheck exit 0; direct tests carried no load/duration gate or dirty-tree hash. C2 done restored. No Reviewer tests or edits.

Criteria: C1 verified, C3 verified.
