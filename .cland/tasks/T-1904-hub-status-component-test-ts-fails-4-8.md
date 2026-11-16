---
id: T-1904
kind: task
title: "hub-status-component.test.ts fails 4/8 in a crew session's shell: in-process CLI cases inherit the session's CLAND_* identity and hit the scratch hub's credential check"
state: open
status: in progress
size: XS
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1556
branch: t/T-1904-hub-status-component-test-ts-fails-4-8
created: 2026-11-16T07:40:00.448Z
updated: 2026-11-16T14:51:26.237Z
---

## Summary

Run standalone from a crew session's shell (impl-1876, 2026-11-16, macOS, Node 24.21.0), `hub/test/hub-status-component.test.ts` fails 4 of 8. Three crew-context cases throw `session "impl-1876" credential is missing or invalid`, and the history case then reads `undefined.length`. The cases invoke the CLI in-process without the shared fixture environment, so they inherit the session's `CLAND_SESSION_*` variables. This is the class T-1285 fixed for `doctor.test.ts`; this file was missed. It passes in suite runs, which seal the environment, and gives a false red in targeted runs from a session.

## What to build

Run every in-process CLI call in this file through the shared fixture environment (`fixtureEnvironment` with `scratchGitEnvironment`), so a crew session's identity never reaches the scratch hub. Search the other component tests that call the CLI in-process for the same pattern, and fix or list them.

## Acceptance criteria

- [x] C1. `hub-status-component.test.ts` passes 8/8 when run standalone with a crew session's `CLAND_SESSION_*` variables set, and still passes in the suite runner (test).
  - done: impl-1904 · 2026-11-16T14:46:26.762Z
- [ ] C2. The other in-process CLI component tests are swept for inherited session identity, and each one is fixed or named as unaffected (test).
  - failed: rev-35 [reviewer] · 2026-11-16T14:51:26.237Z · note Missed account-cli ambient/default-env boundary sends inherited crew identity to a permissive fake peer; sweep incomplete.

## Comments

### impl-1904 · 2026-11-16T14:43:28.940Z

C2 sweep (rg src/cli/, runHub/runSetup/runDoctor/runTask/runCrew/runUpdate/runSuiteCommand, askHub/askHubFrame and CLAND_SESSION across hub/test): fixed hub-status-component plus hub-priority (red 0/1 undefined.nice) and web-edge (red 6/8, both status calls rejected impl-1904 credential). Unaffected component-task.ts: explicit {} or scratch sessionShell env; setup-remote-component: explicit fixtureEnvironment; startup-ready/deadline-component: start-only, liveness uses probeHub's explicit {}, no actor frame; aide/config-reload/executor-prepare/release-preflight components: subprocess harness seals caller env and explicit fixture actors. Doctor fixture passes explicit sealed toolchain env (T-1285); hub-lock-readers scopes fixtureEnvironment. Other in-process setup/task/suite cases pass explicit environments or fail argument parsing before discovery; init/update fixtures do not emit session actor frames (withInitGitIdentity seals native init calls). Pure describe/usage/parser imports do not call the hub. Direct frame consumers auth-mode, daemon, doctor-hosts/users, web auth/signin/upload/cookie/tunnel and user-invites pass explicit envs. Existing skills-tracker-support strips CLAND_* itself, so unaffected by inherited session identity; shared-builder migration reported separately.

### impl-1904 · 2026-11-16T14:48:53.058Z

Correction to C2 sweep claim at ec4aee038: Reviewer identified account-cli.test.ts runAccount with ambient process.env/default askHubFrame identity, behind a fake peer that does not reject inherited actors. This src/cli import hit had no retained per-path disposition; no approved exclusion exists. C2 is incomplete pending source verdict/fix. The broad 'other entry points explicit/unaffected' claim must not be read as coverage of runAccount. Holding source and experiments during the pinned review.

### rev-35 · 2026-11-16T14:51:26.237Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1904-source-1
commit: ec4aee038c98ee8cc4905e96d307c9b7d408c2c6
scope: full
findings: [{"severity":"medium","text":"C2 sweep missed runAccount's default process.env transport. Test overrides only CLAND_HUB_FILE; runAccount→askHubFrame→sessionOf sends inherited crew actor/credential to permissive fake peer, so green held-poll counts can hide the leak. No earlier owner/exclusion (claimant confirmed). Seal this in-process CLI fixture with shared inputs/restoration, retain original refresh/deadline assertions, add synthetic outer actor absence at actual peer boundary and complete per-path consumer dispositions.","file":"hub/test/account-cli.test.ts","line":39}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec review A-20180 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20180-t-1904-full-source-review-and-missed-account-cli-identity.md: three edited T2 seams otherwise preserve assertions/shared sealing/restoration, no production change. A-20179 retains71 current lexical import rows/59paths with normalized tiers and conservative statuses, not historical/transitive execution proof. A-20174/A-20177 precommit red/green/check excerpts and missing raw/hash/signal/search/publication-control limitations retained. C1done/unverified pending suite runner;C2failed. Hold released for consolidated correction/fresh exact-head source request before mode-free verification; no tests/native work by Reviewer, no full/all request or dev merge.

Criteria: C2 failed (Missed account-cli ambient/default-env boundary sends inherited crew identity to a permissive fake peer; sweep incomplete.).
