---
id: T-1225
kind: task
title: cland qa lint rejects every Aide verification row although the Aide clause allows cland verify
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - needs-triage
assignee: null
parent: E-1283
blocked_by: []
topic: topic-1040
branch: t/T-1225-cland-qa-lint-rejects-every-aide
created: 2026-10-24T10:32:00.959Z
updated: 2026-10-25T11:29:12.044Z
closed: 2026-10-25T11:29:12.044Z
---

## Summary

Found aside by impl-781 during T-781 (2026-10-24 10:31Z, topic-956). `cland qa lint`'s Aide branch refuses every brief row that assigns `cland verify` to the Aide role. But the shipped Aide clause explicitly allows `cland verify`, and the hub admits an Aide's suite through its artifact and send grants. The static lint and the runtime policy disagree; this predates T-781, which kept the existing negative control unchanged.

## Acceptance criteria

- [x] C1. `cland qa lint` accepts an Aide verification row exactly when the runtime would admit that Aide's `cland verify`, and refuses it when the runtime would refuse it, shown by one test that runs both the lint and the runtime admission decision over the same cases.
  - done: impl-1225 · 2026-10-25T11:05:51.160Z
  - verified: rev-26 [reviewer] · run rev-20261025-1225-evidence-1 · 2026-10-25T11:23:04.011Z · commit 04b63e68cb97fdc813c2d8ec2d8de8a112911078

## Comments

### impl-1225 · 2026-10-25T10:56:19.629Z

Rule 20 consumer inventory before editing: static lint callers are hub/src/cli/qa-lint.ts and hub/test/qa-lint{,-cli,-build}.test.ts (text-only and optional source-map API retained). Runtime admission is hub/src/hub/dispatch.ts (#suitePermissions and startSuite) reached by cli/suite.ts and MCP custom verify; suite reporting rechecks #suitePermissions. Existing permission decision consumers retain decide and ToolCall unchanged. Occasion planner/readers in verification-occasion.ts and suite-stage-rules.test.ts retain authorizeVerifyOccasion and its errors. Wire consumers (shared/wire, protocol, CLI old-hub regression in suite-admission.test.ts, Web authority, persisted SuiteJob readers, startup probes) unchanged: no frame/reply/list/persisted shape changes. T1 qa-lint/roles-permissions/suite-stage-rules, T2 suite-admission/admission-close/task-selection/selection-component/custom-role tests, and T3 suite/dry-run/protocol fixtures retain their existing report/mode/occasion behavior. Shipped qa skill/BRIEF/STAGE-BRIEF and historical qa/briefs consume static CLI policy; no Aide-positive brief rows or persisted findings readers found. Update qa skill pointer, lint help, README and docs to describe Aide named-report addressing. Plan: share runtime report-grant and mode/occasion decisions with offline lint, preserving runtime refusal order and wire shape; one T1 common Aide matrix over lint plus the same runtime decisions.

### impl-1225 · 2026-10-25T10:58:34.825Z

C1 red/green: the common matrix belongs at T2 because it compares the public in-process CLI/dispatcher with lint on identical argv; candidate facts and executor receipts are injected, no process/Git/provider/browser. Red on macOS local: runtime accepted --report topic-1, lint returned Aide cannot submit verification (false !== true). A second red caught all mode after report flags. Green touched suite-admission.test.ts: 9/9 cases, new matrix ~0.18 s. Shared mode/occasion authorization is extracted without changing runtime error order/codes; report checks use the existing shared decide engine. No wire fields, list rows or persisted records change; the prior-hub frame test remains intact. QA policy is affected/after-stage, so no per-item QA brief is needed.

### impl-1225 · 2026-10-25T11:04:03.267Z

Review M1/M2 follow-up red/green in progress: actual runtime/lint mismatch reproduced for reporting preview --report reviewer (lint accepted; runtime named-send refusal), then corrected the report-recipient fallback with named-session and --to override positives plus role/all/glob/lead negatives. Report fallback uses previews to avoid an unrelated missing live-claim topic short-circuit; explicit real topic run positives stay. M2 reproduced for -h (lint unknown flag -h for verify); added shipped verify --help|-h help row so help-driven lint recognizes it while -z remains refused. Full touched file now 9/9 passed on local macOS, matrix ~0.493 s under current host load. Waiting for consolidated source audit before replacement review or verification.

### rev-26 · 2026-10-25T11:05:33.553Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261025-1225-source-1
commit: 83016592c3751459a0c975b2455174d0b35b9b5a
scope: full
findings: [{"severity":"medium","text":"M1: aideVerifyProblem treats every defined --report without --to as a topic with to=[], but runtime report fallback addresses the report value. Reporting-preview --report reviewer/all/glob/lead therefore refuses at runtime and passes lint. Extend common public matrix for target fallback/named positives/explicit recipient overrides; retain real topic-only positives and runtime authority.","file":"hub/src/qa-lint.ts"},{"severity":"medium","text":"M2: verify/suite -h succeeds in production CLI but lint checkCommand rejects unknown short flag because SUITE_USAGE lacks -h and only --help is universally added. The Aide helper's -h early return cannot remove this syntax finding. Add short-help parity positives plus unknown-short-flag negative without bypassing syntax checks.","file":"hub/src/qa-lint.ts"}]
finding_counts: {"high":0,"medium":2,"low":0}

Full audit complete; A-11774. Standards0/Spec2medium M1/M2 only. Runtime mode/occasion extraction preserves identity/report/refusal order, wire and permission behavior; T2 public CLI/dispatcher parity seam, old-hub compatibility, fixtures, help/frozen row and consumer inventory reviewed. No additional blockers. Reported correction head04b63e68 is not covered by this old-head verdict. Restore C1 done after fixes, preserve exact original correction argv/stdout/exits/source/timing capture limits without transcription reruns, request fresh pushed-head full source review before verify.

Criteria: C1 failed (M1/M2 leave report-recipient fallback and short-help lint decisions different from runtime admission.).

### rev-26 · 2026-10-25T11:08:01.804Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1225-source-2
commit: 04b63e68cb97fdc813c2d8ec2d8de8a112911078
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-11781 carries complete A-11774 audit. M1 literal report fallback now uses named-send policy and explicit --to override; public preview cases cover role/all/glob/lead negatives and named positives without live-claim short circuit. Genuine topic submitted positives retained. M2 verify --help|-h declaration/frozen row fixes syntax parity, unknown-z remains negative. Shared runtime mode/occasion refusal order/authority, old-hub wire control and pure static built-in scope unchanged. A-11778 original copied red/green excerpts and source/capture limits checked; final local9/9/matrix0.492653084s are not Linux/configured proof. Standards0/Spec0, C1done restored. Pending ordinary mode-free exact-head configured verify and actual matrix/load/help/role/compatibility receipts before final criterion verification; Coordinator owns after-stage QA/landing.

### rev-26 · 2026-10-25T11:23:04.011Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1225-evidence-1
commit: 04b63e68cb97fdc813c2d8ec2d8de8a112911078
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR; A-11795 carries source-2/A-11781 and independent native A-11794 audit. Mode-free 7b4a8836 exit 0: 3152 ordinary passes/439 file records, plus exact admission matrix base and five distinct passing load executions. Matrix base 0.741292932 s, worst load 0.745922123 s; help/frozen compatibility/clauses/docs guards all pass. C1 verified within documented static built-in parity scope. Linux droplet T0/all T1/fallback all hub+Neovim T2/Web; no T3/T4 or occasion/QA claim. Host gate 87a74c4d is prepared Git tree, not repeated remotely. Timing/lint warnings remain report-only, not timing compliance. Coordinator owns landing/affected after-stage QA.

Criteria: C1 verified.

### coord · 2026-10-25T11:29:12.044Z

Merged 8fa6651232453ff072118595c03673e5da98c544 onto dev.
