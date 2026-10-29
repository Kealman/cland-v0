---
id: T-1380
kind: task
title: durations refresh adds site/test identities that no tier owns, and periodic dev T3 then skips
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
regression_of: T-1368
topic: topic-1186
branch: t/T-1380-durations-refresh-adds-site-test
created: 2026-10-27T23:10:18.366Z
updated: 2026-10-29T16:44:48.282Z
closed: 2026-10-29T16:44:48.282Z
---

## Summary

The stage-close refresh `node hub/test/durations.ts refresh --add-only <linux> <mac>` at c675faa3 added a file entry and five test keys under `site/test/remote-docs.test.ts`, because T-1368's hub wrapper `hub/test/remote-docs.test.ts` imports the site cases and the cover logs report them under the site file. No tier owns site/test, so the periodic dev T3 at 7ec62be1+ was skipped: `verify-tiers: duration key has no matching test identity: site/test/remote-docs.test.ts` (2026-10-27 23:09Z). Coord removed the six keys by hand; the next refresh would add them again.

## What to build

Either the refresh adds only identities the tier manifest owns (and says what it skipped), or the wrapper's imported cases are reported under the wrapper's own file, so logs and durations agree. Keep the failure as a refusal at shard planning, but make the refresh unable to create it.

## Acceptance criteria

- [x] C1. A refresh over a log that contains site/test identities adds no key the tier manifest does not own and prints the skipped identities (test).
  - done: impl-1380 · 2026-10-29T16:03:56.324Z
  - verified: rev-26 [reviewer] · run rev-20261029-1380-evidence-2 · 2026-10-29T16:37:56.749Z · commit 8baea2eb5bab7af435b3003b8ada8cb70e648320
- [x] C2. `npm run test:tiers` passes after a refresh over the c675faa3 cover logs A-12925 and A-12929 (test against fixture copies).
  - done: impl-1380 · 2026-10-29T16:03:56.935Z
  - verified: rev-26 [reviewer] · run rev-20261029-1380-evidence-2 · 2026-10-29T16:37:56.749Z · commit 8baea2eb5bab7af435b3003b8ada8cb70e648320

## Comments

### impl-1380 · 2026-10-29T16:00:50.503Z

Consumer inventory before refresh behaviour change: hub/test/durations.ts CLI and exported refreshDurations; direct T1 callers hub/test/durations-refresh.test.ts; CLI T3 callers hub/test/durations.test.ts; npm test:durations, Coordinator stage-close instructions in hub/README.md, docs/agents/tests.md, .agents/skills/merge/SKILL.md. All-tier readers/planners: suite-durations.ts, suite-shards.ts, suite-test-identities.ts, suite-selection.ts, suite-tier-report.ts, suite-duration-context/budget.ts, verification-commands.ts, hub/suites.ts, hub/dev-t3-probe.ts, run-suite.ts/load-gate.ts/selection-replay.ts and lint-repository-tier-plan.ts; their duration format and refusal stay unchanged. Existing durations/suite-tier/budget/context/legacy, runner/merge/Web tests and QA fixture readers unaffected (no schema or wire change). No startup/frame/client contract changes. No matching refresh QA briefs or persisted format migrations found.

### rev-26 · 2026-10-29T16:09:07.180Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1380-source-1
commit: d0d16251413f75f37f1a52901efb781dd821ad07
scope: full
findings: [{"severity":"medium","text":"M1: exact test-path H1 and owning Notes index row missing; unchanged docs guard red/green, fix owning rows only.","file":"docs/agents/tests/hub-test-durations-refresh.test.ts.md","line":1},{"severity":"medium","text":"M2: three new bare promisifyexecFile calls lack deadline/test-signal/ownedchildclose-resultdrain before rootcleanup onabort. Use existing sharedcommandIn fornewcalls, preserving successfulnpmadmission/nonzeroexactinvalidkeyrefusal.","file":"hub/test/durations.test.ts","line":418}]
finding_counts: {"high":0,"medium":2,"low":0}

A-13759 full8-file sourceaudit completeM1/M2only; noadditionalproductfinding. Full/addonly timing+fileenvelope filters ownership/skipdedup; no-manifestunfiltered/currentlegacymapping/previousinvalidkeyrefusal/addonlybytes preserved. All sharedconsumers inventoried/noformat/plannermigration orhubsrcchange. IndependentlycomparedA12925/A12929fixture6timingrows/head/greenmarker exactlyoriginaldurablelogs; excerptslabelled, T3nativeCLIreason/T1filterseamappropriate. Reportedworkingfixesoutsidehead; commit/freshsourcebeforemodefree. No runtimecriteriafailed/verified, no Reviewerworkloads. QA none/after-stage; skillproposalremainfrozen.

### rev-26 · 2026-10-29T16:11:58.698Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1380-source-2
commit: 2c74d6cee191abae1c9db8516be1c6c697385ce6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13765: Standards M1/M2 resolved in exact three-file correction; guide H1/index exact, three new CLI commands reuse bounded signal-owned commandIn with pre-directory process/close/result drainage, sealed environment and preserved success/nonzero exact-refusal assertions. Spec: A-13759 full audit carried forward; ownership filters, legacy behavior, format/planner refusal and original fixture provenance unchanged. No further findings or Reviewer workloads. C1/C2 runtime verification pending configured original records at frozen head; local receipts not substituted.

### rev-26 · 2026-10-29T16:12:59.015Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1380-evidence-1
commit: 2c74d6cee191abae1c9db8516be1c6c697385ce6
scope: evidence
findings: [{"severity":"medium","text":"Admission refused before execution: the newly imported process-cleanup ownDirectory marks this filesystem-only T1 file as machine-resource. Preserve the classifier; use the existing filesystem cleanup pattern and obtain fresh source clearance before retry.","file":"hub/test/durations-refresh.test.ts","line":9}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13769 independently traces hub refusal26672443 to test-lint direct import policy and suite-shards T1 admission. No suite ran and no criterion failed/verified inferred. Prior M1/M2 source corrections retained; lead is fixing the missed admission constraint without tier/guard bypass. Fresh exact-head source review required.

### rev-26 · 2026-10-29T16:13:32.219Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1380-source-3
commit: 8baea2eb5bab7af435b3003b8ada8cb70e648320
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13771: complete one-file correction inspected. Standards: unnecessary machine-resource import removed, immediately registered filesystem cleanup matches existing file, no child/concurrent writer ownership lost. Classifier/tiers/tests/assertions unchanged. Spec: full prior source audit and M1/M2 corrections retained; no additional findings. No Reviewer workloads or configured C1/C2 verification inferred from local receipts. Original configured execution/timing/load review pending at this frozen head.

### rev-26 · 2026-10-29T16:37:56.749Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1380-evidence-2
commit: 8baea2eb5bab7af435b3003b8ada8cb70e648320
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13803 original A-13802 independently audited. Standards source3 retained/no findings. C1 full/add-only ownership cases pass0.012902501/0.002710312s and5/5load each; explicit skipped test/file receipts and owned-only keys retained. C2 native shipped-refresh/npm tier admission plus injected-key exact refusal passes1.473941211s using original-compared A12925/A12929 excerpts. ChangedT3 all23identities once/no repetitions, selected added wall5.998s excludes machine wait; no new>=3s case. Full4175ordinary+60load pass/no nonpass or unfinished; T0/T1/T2/changedT3/Web complete, remainingT3/T4 excluded. Budget/lint/ratchet growth report-only retained. Prior admission-only redA13769 separate. No Reviewer workloads; C1/C2 verified at frozenhead.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-29T16:44:48.282Z

Merged 8a4608a3f0287823dc50afdd464033a642a771ff onto dev.
