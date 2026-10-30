---
id: T-1463
kind: task
title: The release skill asks for a conditional release approval in daytime
state: open
status: review
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
updated: 2026-10-30T10:22:46.707Z
---

## Summary

The v0.3.0 release waited 6.8 h overnight for approval (retro A-14149). The release skill gains a recorded conditional approval: the Coordinator asks in daytime "release vX once the release epic is clear and the covers are green", and releases on those conditions. Retro v0.3.0 change 3.

## Acceptance criteria

- [x] C1. The release skill describes recording and checking a conditional approval, with the conditions named in the ask.
  - done: impl-1463 · 2026-10-30T10:22:41.490Z

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
