---
id: T-1923
kind: task
title: "hub-priority.test.ts fails on macOS since T-1768: the doctor report has no hub priority check under nativeIdentityProjectHub"
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
regression_of: T-1768
topic: topic-1567
branch: t/T-1923-hub-priority-test-ts-fails-on-macos
created: 2026-11-16T22:08:41.630Z
updated: 2026-11-16T22:17:03.212Z
---

## Summary

hub-priority.test.ts fails on macOS at dev since T-1768 (84f58ecdb) switched it to `nativeIdentityProjectHub`: the in-process doctor report has no `hub priority` check, while `hub status --json` in the same test does carry the priority warning. The Linux droplet batch 256ef4e8 passed it, so the failure is macOS-only and every crew session's local T2 run of this file is red.

## Evidence

- `node --test hub/test/hub-priority.test.ts` in a detached worktree on macOS (coord's shell; also with every `CLAND_*` variable removed): 020aef2e0 fail (the crew-identity failure T-1904 fixed), 802acd529 pass, 84f58ecdb fail, 0e093db62 (dev tip) fail.
- Failure: `AssertionError [ERR_ASSERTION]: no check named hub priority in ps, claude-code, …, hub, hub.json, secret, territory, …` at doctor-fixture.ts `check` from hub-priority.test.ts `check((await report(root, tools.env)).report, 'hub priority')`; actual undefined, expected true.
- impl-1705 hit the same red at T-1705's merged head 6579171d9 (topic-1552).

## Acceptance criteria

- [ ] C1. hub-priority.test.ts passes on macOS and on the Linux droplet at the fixed head, from a crew session's shell, with the hub priority warning reported by both `hub status` and the doctor report.
- [x] C2. The fix keeps T-1768's guarantee that this file's fixture never spawns native sysctl through the default lock identity, or records why native identity is required here and makes the doctor path agree with it.
  - done: impl-1923 · 2026-11-16T22:12:59.350Z
  - verified: rev-35 [reviewer] · run rev-35-1923-source-1 · 2026-11-16T22:17:03.212Z · commit 15757e4d4d6166d7e17bf32cb36bdb6055a81311

## Comments

### impl-1923 · 2026-11-16T22:12:59.189Z

Pushed 15757e4d4d6166d7e17bf32cb36bdb6055a81311 after merging origin/dev e824406ae. Actual macOS baseline 0e093db62 failure: AssertionError [ERR_ASSERTION]: no check named hub priority (actual undefined, expected true), doctor-fixture.ts:74 / hub-priority.test.ts:41. Status assertions passed. Cause: nativeIdentityProjectHub writes native identity but doctor's injected fixtureLockIdentity is synthetic after toolchain seals away runner metadata, taking readForeignHolder's foreign branch before local status.priority?.warning. Fix captures explicit native fixture identity before env swap and shares existing CLAND_TEST_LOCK_IDENTITY metadata with doctor. Added assertion that doctor recognizes local hub. Native identity required for production CLI lock readers; explicit standalone macOS sysctl retained, default projectHub remains synthetic/no-sysctl.
Rule 20 audit: searched fixtureLockIdentity/nativeIdentityProjectHub and priority field/event/function names across hub/src, hub/test all tiers, nvim, web, shared, docs, qa and skills. Consumers: harness helpers; doctor-fixture; checkHub/lock readers; CLI runHub; daemon priority logging; protocol/shared-wire HubPriority and wire-conformance; priority unit tests and lock identity/readers tests; runner identity metadata capture and fixture docs. No shared contracts changed; other consumers unaffected. Per-test guide records native requirement.
Validation on macOS local executor Node v24.21.0: targeted inherited low priority appears in the startup log and CLI diagnostics green 1/1 in candidate tree, baseline red 0/1; hub typecheck passes; test lint 0 refusals (122 existing report-only findings); npm run test:static exit 0 with existing report-only notices (site import dependency, T-1484 install imports, build guards). Full verification and Linux pending source review and Coordinator window. No browser run.

### rev-35 · 2026-11-16T22:17:03.212Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1923-source-1
commit: 15757e4d4d6166d7e17bf32cb36bdb6055a81311
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-20403. Three-file diff against fixed parente824406ae read with harness/runner/doctor lock/priority context. Existing exported native identity capture precedes sealed process.env replacement; serialized established metadata makes hub and doctor readers agree without disabling foreign ownership checks or changing production/default fixture semantics. Existing JSON/text CLI and doctor warning/probe-count assertions retained; added local hub verdict assertion. No new async producer/fixture owner; current restoration preserved. T2 explicit native compatibility rationale correctly documented; C2verified. C1unverified until fixed-head macOS and Linux droplet evidence. A-20400 baselineactual missing-priority output/candidate1-of-1 and static reports remain narrative development evidence, not immutable-head/native raw provenance. Retain available original command/cwd/completion/source-linkage excerpts for final evidence, no provenance-only rerun. No browser/full configured result claimed. Hold released. Lead must obtain Coordinator window before new mode-free exact-head verify; no post-review dev merge without authorization. No Reviewer runtime.

Criteria: C2 verified.
