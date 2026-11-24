---
id: T-1920
kind: task
title: The publication scanner's header-context rule misses short Authorization values in header entry-pair lists and in object property keys
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2077
blocked_by: []
topic: topic-1729
branch: t/T-1920-the-publication-scanner-s-header-context
created: 2026-11-16T16:36:57.494Z
updated: 2026-11-24T11:54:11.027Z
closed: 2026-11-24T11:54:11.027Z
---

## Summary

The third source review of T-1665 (2026-11-16 16:36Z, at 3c550eb37) found two complete representations where `assertPublishable`'s header-context rule accepts a short Authorization value. One is headers as entry-pair lists (the name and a short scheme value as separate array entries); the other is a short credential used as an Authorization object's property key. Both were reproduced in parsed and serialized form. The context-free token-shaped rule (Bearer followed by at least 16 token characters) still refuses token-shaped values in these forms, so only short values are affected.

## Acceptance criteria

- [x] C1. `assertPublishable` refuses a short synthetic Authorization value in a header entry-pair list and as an Authorization object's property key, in both parsed and complete serialized forms, while T-1665's prose and title negative controls still pass (test, red before the fix).
  - done: impl-1920 · 2026-11-24T09:34:27.675Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1920-final · 2026-11-24T10:09:47.846Z · commit 9f885dd84b35c9a8f9bdf43dd0ff600e36b8a07f

## Comments

### impl-1920 · 2026-11-24T09:04:01.206Z

Consumer search: rg for assertPublishable, scanPublication and qa-demo-policy across .agents, hub, docs and qa (including tiers, T3/T4 fixtures and frozen data). Production callers: .agents/skills/qa/qa-demo-record.ts, hub/src/evidence-publish.ts, qa/support/invite-capture.ts. Tests: hub/test/qa-demo-policy.test.ts (T1), qa-host-invite.test.ts (T1 via invite-capture), evidence-publish.test.ts (T2), skills-qa.test.ts (T2 recorder), login-card-signin.test.ts, login-resignin-native.test.ts, login-signed-out-native.test.ts (T3 diagnostic scan); demo.test.ts owns remote execution. QA briefs E-1532 stages 3/4/6, E-1533 base/stages 2/3, E-1535 stage 2, E-1536 base/stage 2, E-1537 stages 2/4/5, E-1538 base/stages 1/2 use the same scanner. No reply shapes or callers change: all consume void-or-value-free-refusal; new refusals only cover the two unsafe complete representations. Existing raw strings and prior wire-shape control retained. RED on Node 24.21.0 macOS local: qa-demo-policy.test.ts 18 pass, four new parsed/serialized entry-pair/property-key cases fail with AssertionError [ERR_ASSERTION]: Missing expected exception. No browser, native or network fixture ran.

### rev-40 · 2026-11-24T09:35:44.768Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1920-source
commit: 9f885dd84b35c9a8f9bdf43dd0ff600e36b8a07f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Shared traversal carries Authorization context into nested property keys and second element of case-insensitive two-element header pairs. Complete JSON/URL-decoded/nested serialized values use existing traversal, same value-free refusal; no copied policy/wire change. Four new generated parsed/serialized pair/key controls inspect space/tab/newline variants; five prose/title negatives, standalone threshold and previous wire-shape controls retained. Consumer inventory covers production/QA and T1-T3 callsites; policy docs/test guide/skill change provenance match complete-representation scope and retain partial-JSON limitation. A-22776 reported red18pass/4Missing expected exception then22policy/2invite passes is local narrative evidence, not independent configured receipt. C1 remains unverified pending exact-head configured result. No reviewer runs/edits.

### rev-40 · 2026-11-24T10:09:47.846Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1920-final
commit: 9f885dd84b35c9a8f9bdf43dd0ff600e36b8a07f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. dba200bd/A-22818 exact head/canonicaltree2170d5b7 finishedpassed. C1 four parsed/serialized entry-pair/property-key identities8386/8391/8396/8401 pass +5/5each; five prose/title negatives8331-8351 and legacywire8416 pass. All22policy/2invite/21evidence-publish/24skills-QA base cases positive. SourceA-22792 and reported red-beforeA-22776 retained; no historical process reconstruction claimed. T0/T1/fallbackT2/10selectedT3files113identities/Web green; onebase/noT3reps, remainingT3batch/T4unexecuted. Noncached Linuxx64/c-8nyc1/Node24.21/Nvim0.12.5/workers2/HeadlessShell1248-CfT156;7478pass1Macskip0fail suppliedaggregate. Advisory reports/partial-formatlimits retained. No findings, no reviewer runs/edits.

Criteria: C1 verified.

### coord · 2026-11-24T11:54:11.027Z

Merged f321357653981255265dca4379d85b16117b18e0 onto dev.
