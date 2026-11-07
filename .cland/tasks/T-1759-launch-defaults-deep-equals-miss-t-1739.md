---
id: T-1759
kind: task
title: "Launch-defaults deep-equals miss T-1739's pool field: nvim qa ROLES fixture red on dev"
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1739
topic: topic-1434
branch: t/T-1759-launch-defaults-deep-equals-miss-t-1739
created: 2026-11-07T18:45:44.059Z
updated: 2026-11-07T20:07:41.017Z
closed: 2026-11-07T20:07:41.017Z
---

## Summary

T-1739 (landed 69cdf36a) adds `pool: 'local'` to every role's resolved launch defaults. `nvim/test/qa.test.ts` "the fixture's roles.toml and config.toml are the stdio hub's: the launcher fills in the Coordinator's defaults including its danger-full-access sandbox" still deep-equals the old shape, so dev is red. T-1739's batch f5c21caf never ran this file: the batch stopped at the T-1732 flake, and the landing reran only the failing file.

## Evidence

T-1737 batch 887b1de7, run 9e2c9d61, A-17603, at f909f827 (Linux x64): `+ pool: 'local'` is the only difference in the Coordinator's `launch` at `nvim/test/qa.test.ts:229`.

## Acceptance criteria

- [x] C1. The assertion expects `pool: 'local'` in the Coordinator's resolved launch defaults, with every other field unchanged.
  - done: impl-1759 · 2026-11-07T18:47:58.100Z
  - verified: rev-35 [reviewer] · run rev-35-1759-source-1 · 2026-11-07T18:50:12.193Z · commit b9b41cf612e44d7a9540a99777dbfc4a77a7472c
  - verified: rev-35 [reviewer] · run rev-35-1759-final-1 · 2026-11-07T18:58:45.319Z · commit b9b41cf612e44d7a9540a99777dbfc4a77a7472c
- [x] C2. A sweep of `nvim/test`, `web/test` and `hub/test` for exact deep-equals on role `launch` objects finds every other expectation T-1739 broke, and each one is fixed in this item. Report the sweep in an item comment.
  - done: impl-1759 · 2026-11-07T18:47:58.286Z
  - verified: rev-35 [reviewer] · run rev-35-1759-source-1 · 2026-11-07T18:50:12.194Z · commit b9b41cf612e44d7a9540a99777dbfc4a77a7472c
  - verified: rev-35 [reviewer] · run rev-35-1759-final-1 · 2026-11-07T18:58:45.319Z · commit b9b41cf612e44d7a9540a99777dbfc4a77a7472c
- [x] C3. `nvim/test/qa.test.ts` and every file the sweep changed pass alone on macOS at the head.
  - done: impl-1759 · 2026-11-07T18:47:58.524Z
  - verified: rev-35 [reviewer] · run rev-35-1759-final-1 · 2026-11-07T18:58:45.319Z · commit b9b41cf612e44d7a9540a99777dbfc4a77a7472c

## Comments

### impl-1759 · 2026-11-07T18:47:39.384Z

C2 consumer sweep at base f405478eb9b59fa4c59d0c6e618d69633a970ad2: searched all hub/test, nvim/test and web/test TypeScript deepEqual/deepStrictEqual call ASTs (including multiline), plus role.list/roles.list/RoleList readers to catch read-then-parse locals.
Whole role-launch exact comparisons:
- nvim/test/qa.test.ts:229: sole stale literal; red file run on macOS (24 pass, 1 fail, 0 skip) showed only +pool: 'local'; fixed.
- hub/test/roles-component.test.ts:247,251,253,258: all full literals already include pool: 'local' from T-1739; unaffected.
- hub/test/roles-template-component.test.ts:77,84: role.launch compares against DEFAULTS (already includes pool), and whole role.list replies compare before/after environment changes, both produced by current code; unaffected.
- hub/test/aide.test.ts:75: expected role spreads DEFAULTS and shipped.launch, preserving pool; unaffected.
- hub/test/session-credential-io.test.ts:277: whole role.list reply equals a current-code before snapshot; unaffected.
Partial launch-field exact comparisons:
- hub/test/roles-component.test.ts:249,254-256,260-267,278; roles-launch-permissions.test.ts:113,118,133; roles-snapshot.test.ts:292; roles-template.test.ts:60,63; setup-favourite.test.ts:95,100: select approval/sandbox/permissions/harness/model/effort; new sibling pool cannot affect them.
Client request comparisons (not resolved role launch objects): nvim/test/launcher-component.test.ts:129, palette.test.ts:63 and web/test/session-launch.test.ts:75 assert outgoing session.launch frames; unaffected by a role.list default.
Other role-list deep-equals select role names/holders only (nvim/test/qa.test.ts:192; hub/test/roles.test.ts:123, handover-integrity.test.ts:48, init.test.ts:365, claude-code-remote.test.ts:414); no launch shape assertion. No other stale role launch deep-equals found. No production contract changes.

### rev-35 · 2026-11-07T18:50:12.194Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1759-source-1
commit: b9b41cf612e44d7a9540a99777dbfc4a77a7472c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17609: expectation-only one-line pool:'local' addition, all prior fields/assertions intact. C1 verified by diff; C2 verified from item comment plus independent fixed-head AST5711 deep-equality calls/716files, role-list reader/manual alias sweep; no other stale whole-launch literal. A-17606 red24/25 and A-17607 green25/25 macOS Neovim retained; precommit candidate linkage is chronological, not cryptographic. Wrapper tail exit not native producer proof; recorded Node summaries support test facts. A-17608 T0 candidate-start/postcommit finish exit0 per original-tool completion, existing advisory only. C3 remains pending final configured receipt plus qualified identical-source standalone macOS evidence. Mode-free verify may proceed at this exact head. No reviewer native runs/provenance-only rerun. QA none.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-07T18:58:45.319Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1759-final-1
commit: b9b41cf612e44d7a9540a99777dbfc4a77a7472c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17613 final audit:84a73163/A-17612 exact source-cleared head, independently matching execution projectiona980cf18cae4a380d38c5f3733786a37afcd6289. Hub1941pass/3skip/0fail; parsed1931pass/3skip, four empty failure arrays. T0/allT1/selectedNeovimT2/changedT3/Websmoke exit0; not allT2/fullWeb. Repaired exact default case passes1.259921615s. qa.test.ts22pass/3existing sandbox-exec skips, all reasons recorded and source guards checked. Mac A-17607 whole-file25/25/no skips supportsC3 with identical precommitcandidate chronology, not cryptographic/head-at-run proof; wrappertail/nativecount limits retained. C1/C2 previous exactdiff+comparison sweep verified; allC1–C3 now verified. No new runtime/test identities, no repetition or allowance needed. Linuxx64 Node24.21/Nvim.12.5/Shell1248 CfT156,uncached; report-only notices; remainingT3 deferred,T4 unrun,QA none. No reviewer native tests or edits.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-07T20:07:41.017Z

Merged 82bd5c3fc39d8a18fbdc09ff56179df71ec16397 onto dev.
