---
id: T-1463
kind: task
title: The release skill asks for a conditional release approval in daytime
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1230
branch: t/T-1463-the-release-skill-asks-for-a-conditional
created: 2026-10-30T05:44:58.508Z
updated: 2026-10-30T10:54:52.222Z
closed: 2026-10-30T10:54:52.222Z
---

## Summary

The v0.3.0 release waited 6.8 h overnight for approval (retro A-14149). The release skill gains a recorded conditional approval: the Coordinator asks in daytime "release vX once the release epic is clear and the covers are green", and releases on those conditions. Retro v0.3.0 change 3.

## Acceptance criteria

- [x] C1. The release skill describes recording and checking a conditional approval, with the conditions named in the ask.
  - done: impl-1463 · 2026-10-30T10:22:41.490Z
  - verified: rev-26 [reviewer] · run rev-20261030-1463-source-2 · 2026-10-30T10:23:24.534Z · commit 1a8486bad65778fdbf8e09147fee2e1f5bd29ffe
  - verified: rev-26 [reviewer] · run rev-20261030-1463-source-3 · 2026-10-30T10:30:00.525Z · commit a3eb61c078bca54e06de83fdd4c57a3579090883
  - verified: rev-26 [reviewer] · run rev-20261030-1463-evidence-2 · 2026-10-30T10:48:06.792Z · commit a3eb61c078bca54e06de83fdd4c57a3579090883

## Comments

### impl-1463 · 2026-10-30T10:18:16.411Z

Scope/consumer audit: release/SKILL.md owns the approval procedure and its two Coordinator summaries. Search of shipped skills, docs/agents, hub/README.md and hub/test found no conditional-approval procedure to migrate. CLI/runtime release gates and wire/storage shapes stay unchanged; no shared contract change. Release skill has no upstream metadata.changes or CHANGES file. C1 will get a red-first static skill regression in skills-invocation.test.ts; QA policy is none.

### rev-26 · 2026-10-30T10:21:15.123Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1463-source-1
commit: bb30894e18a9fe9c179d2c4efeac04a431339b95
scope: full
findings: [{"severity":"medium","text":"M1: unconditional dev-change reapproval in step4 still applies to conditional approvals, invalidating expected sweep/readiness commits and recreating overnight ask. Separate explicitly human-approved future-change scope from exact-build path; retain final preview/covers and out-of-scope renewal, with regression.","file":".agents/skills/release/SKILL.md","line":73}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated source1 audit: one medium Spec M1, no separate Standards findings. Preserve human authority/decline/no-refusal-waiver/evidence checks; make future-change scope explicit and consistent across ordinary/conditional paths before fresh pushed-head source review. Local static checks are not configured runtime evidence. No Reviewer execution.

Criteria: C1 failed (Recorded conditional approval is invalidated by expected readiness/sweep dev commits, contradicting release-on-recorded-conditions flow.).

### impl-1463 · 2026-10-30T10:22:11.205Z

Addressed source review M1: separate ordinary exact-build approval from explicitly human-approved future changes. Ask names reviewed fixes for listed items and tracker/evidence commits; record scope, compare every intervening commit, require final successful preview and matching-head covers. Outside-scope/version/notes/conditions/publication-fact changes require fresh ask. New regression first failed /ask.*future changes/s, then all 3 skills-invocation tests passed locally. Typecheck passed on Darwin Node v24.21.0; refreshed lint in progress. No dev merge after first review.

### rev-26 · 2026-10-30T10:23:24.534Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1463-source-2
commit: 1a8486bad65778fdbf8e09147fee2e1f5bd29ffe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear: M1 resolved with explicitly human-approved future-change scope, per-commit comparison, final successful preview/matching-head covers and renewal for out-of-scope/version/notes/conditions/publication-fact changes. Ordinary exact-build flow separated; decline/no-waiver controls retained. C1 source-established. Configured evidence at exact head remains pending final audit; no Reviewer execution.

Criteria: C1 verified.

### impl-1463 · 2026-10-30T10:29:07.354Z

Corrected consumer audit: hub/test/roles-clauses.test.ts:151 directly compares the releaseProcedures summary; shipped Coordinator clause quotes that summary. Per Coordinator direction restored both default/project summary lines in skill; clause and test unchanged. Conditional approval remains in body with preflight pointer. Targeted roles-clauses test reproduced exact includes() assertion then passed all 39 after fix; skills-invocation passed all 3. Local Darwin Node v24.21.0. Prior droplet run 20469bc9 is failed/partial evidence only (T0 pass, T1 fail, T2/Web not executed). Fresh source review required before retry.

### rev-26 · 2026-10-30T10:29:30.742Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1463-evidence-1
commit: 1a8486bad65778fdbf8e09147fee2e1f5bd29ffe
scope: evidence
findings: [{"severity":"medium","text":"Original A-14264 fails the unchanged exact release-summary includes() consumer; changed skill summaries no longer match. Correct owning source/consumer consistently, preserve human authority checks, and source-review changed head before retry.","file":"hub/test/roles-clauses.test.ts","line":151}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14266 audits failed original mode-free 20469bc9 at exact source2 head: T0 pass/T1 fail, 1173 ordinary pass/1 fail plus85 scoped load passes; T2/Web unexecuted. C1 remains source-established, but failed configured evidence is not clear. No Reviewer workloads. Source3 request is separate.

### rev-26 · 2026-10-30T10:30:00.525Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1463-source-3
commit: a3eb61c078bca54e06de83fdd4c57a3579090883
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 A-14268 clear: exact quoted skill summaries restored, unchanged clause/test consumer now matches; conditional body and human authority/evidence checks retained. C1 source-established at exact successor head. Failed previous-head A-14264/A-14266 remains separate. Fresh same-head configured evidence/final review pending; no Reviewer execution and no release authority granted.

Criteria: C1 verified.

### rev-26 · 2026-10-30T10:48:06.792Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1463-evidence-2
commit: a3eb61c078bca54e06de83fdd4c57a3579090883
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record A-14285 clear. Same-head16ab282a/A-14283:4237 ordinary plus85 scoped load passes, no fail/skip/cancel/unmatched. Both conditional-approval cases base+5/5 load and exact-summary consumer pass. C1 verified. T0/T1/allfallbackT2/Web complete;T3/T4unrun;budget/lint report-only. Prior failed A-14264/A-14266 separate. No Reviewer workloads or release authority.

Criteria: C1 verified.

### coord · 2026-10-30T10:54:52.222Z

Merged bcc1b889cea79f11bb3c2b1cf398f0d5a42cc7c7 onto dev.
