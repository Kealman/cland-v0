---
id: T-1978
kind: task
title: Non-move prepared file commits lack the committing-phase re-entry guard, so recommitting an unknown operation can erase its committing plan
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1737
branch: t/T-1978-non-move-prepared-file-commits-lack-the
created: 2026-11-18T13:21:59.090Z
updated: 2026-11-24T10:54:49.195Z
---

## Summary

Found by impl-1672 while fixing T-1672 (2026-11-18), pre-existing. A production PreparedOperations control showed that recommitting an operation whose outcome was unknown could erase its committing plan after the directory fence rejected it. T-1672 added a same-token guard before the effect, but only for `moveDirectory`. The source shows other prepared file commits (writes, truncates, appends) with the same missing committing-phase re-entry guard.

## What to build

Apply the same-token committing-phase guard to every prepared file commit, so an unknown operation's committing plan survives a recommit attempt that the fence rejects, and the operation stays pending and is never replayed.

## Acceptance criteria

- [x] C1. For each prepared file operation kind, an unknown outcome followed by a rejected recommit keeps its committing plan and stays pending without replay, across a fresh owner start (test with fakes).
  - done: impl-1978 · 2026-11-24T10:45:54.888Z
- [x] C2. Every PreparedOperations commit kind and its callers are listed with their disposition (rule 41).
  - done: impl-1978 · 2026-11-24T10:54:32.223Z

## Comments

### impl-1978 · 2026-11-24T10:43:45.416Z

Consumer inventory: docs/evidence/T-1978-consumers.md lists all seven Plan kinds, server/SSH callers, direct write/truncate exclusions, tests/fixtures across tiers and historical skill consumers. C1 red reproduced for publishFile and appendFile: rejected recommit deleted prepared/<token>.json (ENOENT); guarded head passes all 42 opencode-host T2 cases, including existing move recovery controls. No native launches, credentials or network effects in the new cases.

### rev-35 · 2026-11-24T10:48:17.105Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1978-source-1
commit: 66c57a0231903aa2b8e72586851a5686393a8d30
scope: full
findings: [{"severity":"medium","text":"M1: the frozen runtime manifest still pins prepared.ts SHA256 e5bca7d7cb6582ae6ff78a5f2cc03d9bb766998b0dd1309e0d101c3e34996cd1, while the reviewed module hashes to46927a24927e4ecaa0e669a1adbca9be0a6cbc63b5ba94193e934b9928840868. package.ts:44 validates these bytes and host-agent-closure.test.ts:44–47 rejects drift. Regenerate through the supported generator, correct the packaging disposition, and include the frozen-manifest consumers in validation.","file":"hub/src/host/agent/closure.json","line":101}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22845: Standards1medium/Spec0additional. M1 frozen closure manifest SHA256 mismatches reviewed prepared.ts; package hash validation and host-agent-closure T1 consume those exact bytes. Supported generator and docs require regeneration; lead4f2c95b6 confirms omission. Guard placement, publish/append real directory-fence/retained-plan/fresh-owner controls and existing move coverage otherwise check out by source. C2 failed; C1 remains done/unverified. Reported local42T2/39conservativeT1/lint/typecheck cannot cover omitted frozen-manifest control. No reviewer execution/edit. Hold releases for manifest/census correction and fresh source review before verification; no dev merge/full task-head suite requested.

Criteria: C2 failed (Frozen closure.json still pins old prepared.ts bytes; packaging validation and T1 regeneration consumer were not migrated.).
