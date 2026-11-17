---
id: T-1923
kind: task
title: "hub-priority.test.ts fails on macOS since T-1768: the doctor report has no hub priority check under nativeIdentityProjectHub"
state: closed
status: done
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
updated: 2026-11-17T00:31:26.303Z
closed: 2026-11-17T00:31:26.303Z
---

## Summary

hub-priority.test.ts fails on macOS at dev since T-1768 (84f58ecdb) switched it to `nativeIdentityProjectHub`: the in-process doctor report has no `hub priority` check, while `hub status --json` in the same test does carry the priority warning. The Linux droplet batch 256ef4e8 passed it, so the failure is macOS-only and every crew session's local T2 run of this file is red.

## Evidence

- `node --test hub/test/hub-priority.test.ts` in a detached worktree on macOS (coord's shell; also with every `CLAND_*` variable removed): 020aef2e0 fail (the crew-identity failure T-1904 fixed), 802acd529 pass, 84f58ecdb fail, 0e093db62 (dev tip) fail.
- Failure: `AssertionError [ERR_ASSERTION]: no check named hub priority in ps, claude-code, …, hub, hub.json, secret, territory, …` at doctor-fixture.ts `check` from hub-priority.test.ts `check((await report(root, tools.env)).report, 'hub priority')`; actual undefined, expected true.
- impl-1705 hit the same red at T-1705's merged head 6579171d9 (topic-1552).

## Acceptance criteria

- [x] C1. hub-priority.test.ts passes on macOS and on the Linux droplet at the fixed head, from a crew session's shell, with the hub priority warning reported by both `hub status` and the doctor report.
  - done: impl-1923 · 2026-11-16T22:34:22.497Z
  - verified: rev-35 [reviewer] · run rev-35-1923-final-1 · 2026-11-16T22:49:39.909Z · commit 15757e4d4d6166d7e17bf32cb36bdb6055a81311
- [x] C2. The fix keeps T-1768's guarantee that this file's fixture never spawns native sysctl through the default lock identity, or records why native identity is required here and makes the doctor path agree with it.
  - done: impl-1923 · 2026-11-16T22:12:59.350Z
  - verified: rev-35 [reviewer] · run rev-35-1923-source-1 · 2026-11-16T22:17:03.212Z · commit 15757e4d4d6166d7e17bf32cb36bdb6055a81311
  - verified: rev-35 [reviewer] · run rev-35-1923-final-1 · 2026-11-16T22:49:39.909Z · commit 15757e4d4d6166d7e17bf32cb36bdb6055a81311

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

### coord · 2026-11-16T22:34:00.420Z

Correction: not macOS-only. Periodic dev T3 eab7b75d at e824406 (Linux droplet, c-8 sfo2) fails exactly hub/test/hub-priority.test.ts::inherited low priority appears in the startup log and CLI diagnostics, 4020 pass / 1 fail in T2 (A-20424). Today's merge batches ran T1+T3 only, so this T2 file was not run on the integrated tree. Dev is red until T-1923 lands (rule 6 fix-forward). T-1923's own verify 1871eea5 at 15757e4d4 runs T2 on Linux and is the check that its fix also covers Linux.

### impl-1923 · 2026-11-16T22:34:11.881Z

Platform correction from Coordinator: periodic dev T3 run eab7b75d at e824406 also fails hub-priority.test.ts on a Linux droplet (A-20424), the only T2 failure. The original macOS-only description is superseded by that evidence: fixture identity mismatch affects both platforms when runner metadata is lost. Fixed-head run 1871eea5 remains pending; no Linux pass claimed yet.

### impl-1923 · 2026-11-16T22:46:58.401Z

Fixed-head verification green: run 1871eea5-9c85-412f-bcae-685728dcb683 / A-20441 at 15757e4d4d6166d7e17bf32cb36bdb6055a81311, tree bc0a6776c789b88e2b82810496c89f223ed3fa0c. 6519 pass, 0 fail/cancel/skip; T0 exit 0 on local macOS, T1/all T2 fallback/Web exit 0 on Linux droplet c-8 sfo2, linux x64 6.8.0-147-generic, Node v24.21.0, Neovim v0.12.5. Browser Chrome Headless Shell/Google Chrome for Testing 156.0.8078.4, playwright binary chromium_headless_shell-1248. Lifetime 1500s, cost $0.1042. Timing/lint budget findings remain report-only; T3/T4 not executed in this task receipt (merge/integrated coverage separate). Exact hub-priority named test and file passed on Linux; original macOS green case/source linkage preserved in A-20405. Fix therefore covers both macOS and Linux, superseding initial macOS-only diagnosis. Awaiting Reviewer's final same-head evidence verdict; both criteria done.

### rev-35 · 2026-11-16T22:49:39.909Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1923-final-1
commit: 15757e4d4d6166d7e17bf32cb36bdb6055a81311
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear A-20446. A-20441 parsed6519ordinary passes/707files,0fail/cancel/skip; separate240loadpasses/files. Exact Linux priority case20301/file20304pass at reviewed15757e4d4; startup/CLI JSON-text/doctor JSON-text/local-holder/probe-count assertions retained. All224T1/428fallbackT2/55Web complete;269T3/17T4unexecuted. A-20405 preserves Mac0-of-1red then two fixed-source1-of-1/exit0 results; recorded no-test-edits/source-to-commit sequence plus independently tracker-only0e→e824update qualifies that platform linkage, not a fresh literal-commit Mac invocation/raw/hash/signal attestation. A-20424 Linux baseline samefailure confirms both-platform diagnosis, superseding Mac-only text. Exact provenance/actual isolated1248/CfT156browser checked; report-only budgets/lint/ratchet/skip checks retained. C2native exception rationale/defaultsynthetic guarantee retained. C1/C2verified; hold released, Coordinator owns landing. No Reviewer runtime or provenance-only rerun.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-16T22:51:45.479Z

Enqueued 22:51Z at 15757e4d4: rule 7 clean (head = origin = verdict = verify 1871eea5 passed), rule 36 lints on 2964499ad (merged with dev c2517f1af) 0 refusals and 0 wording findings. It is second behind T-1677's batch e88cafc7, which formed 22:48Z, so landing is expected around 00:10Z, past rule 6's one-hour fix-forward mark (dev T3 red reported 22:33Z). I chose not to cancel the running T-1677 batch to jump the queue: a mid-run cancel earlier today stranded a batch only the human could cancel (T-1630 trap), and dev is not being released tonight. Meanwhile, in-flight items carry the identical fix by cherry-pick (T-1705 167fc3784, T-1726 0633c4d7a, T-1924 f2dfae3c0, T-1864 6b16f3314).

### coord · 2026-11-17T00:31:26.303Z

Merged 71a3108fe161fb3a27ddad50fe9bf497d8d1f593 onto dev.
