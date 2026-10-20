---
id: T-955
kind: task
title: A T1 test holds the shipped role clauses' byte reserve and wording pins
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-726
branch: t/T-955-a-t1-test-holds-the-shipped-role-clauses
created: 2026-10-20T09:53:17.153Z
updated: 2026-10-20T10:03:04.477Z
---

## Summary

The Coordinator clause's byte reserve (roles.test.ts, 7707 bytes against 7680) and its wording pins (surface.test.ts:81) are pure functions of hub/src/roles/default-roles.ts. Both assertions are T3, so two release candidates of v0.1.4 went red on them after T1-only batches had landed the change. Move them into a T1 test over the shipped clauses.

## What to build

A T1 test reads the shipped default role clauses. For each one it asserts the byte reserve and the wording pins that the T3 files assert today. A merge batch then catches a clause that is over its reserve or has a stale pin in about 2 minutes. The T3 files keep only the claims that need a live hub. This comes from retro finding 3 (A-7261) and cluster 6 of the rule batch (A-7281), which the human approved on 2026-10-20.

## Acceptance criteria

- [x] C1. A T1 test fails when any shipped role clause exceeds its byte reserve, naming the role, the size and the reserve.
  - done: impl-955 · 2026-10-20T09:58:54.864Z
  - verified: rev-26 [reviewer] · run rev-20261020-955-source-1 · 2026-10-20T10:03:04.477Z · commit 07c18f6079dbca9abdc87c1808cd6ddfe2e0b65e
- [x] C2. Every wording pin of a shipped clause now asserted in a T3 file is asserted in T1, and the T3 copy is removed or reduced to its live-hub claim, with an assertion map in the evidence.
  - done: impl-955 · 2026-10-20T09:58:56.164Z
  - verified: rev-26 [reviewer] · run rev-20261020-955-source-1 · 2026-10-20T10:03:04.477Z · commit 07c18f6079dbca9abdc87c1808cd6ddfe2e0b65e
- [x] C3. Red evidence: a scratch edit that pushes the Coordinator clause over its reserve, or rewords a pinned line, fails the T1 test.
  - done: impl-955 · 2026-10-20T09:58:57.197Z

## Comments

### impl-955 · 2026-10-20T09:54:44.816Z

Read criteria and rules 9/15/16/17. Implementing at the ticket-specified seam: shipped role definitions; relocating static reserve/wording pins to T1 while retaining live delivery assertions in T3. Evidence will include an assertion map and isolated red mutation.

### impl-955 · 2026-10-20T09:58:54.722Z

Implementation committed/pushed at 07c18f6079dbca9abdc87c1808cd6ddfe2e0b65e (tree dcfcf2545bf6a1953bb837765d1957282d959bea), after fetching/merging origin/dev (already up to date). A-7308 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7308-t-955-assertion-map-and-isolated-red-green-evidence includes complete original→T1 assertion map, isolated red mutations, 27/27 T1 resource-enforce green, affected roles/surface T3 files 4/4 and 2/2 green on local macOS Node v24.21.0. These targeted checks are not queued/integrated suite evidence. qaPolicy scope none / after-stage; no per-item QA request needed.

### rev-26 · 2026-10-20T10:03:04.477Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-955-source-1
commit: 07c18f6079dbca9abdc87c1808cd6ddfe2e0b65e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no finding. T1 manifest entry and pure parsing/public rendering preserve the former queue-role/default staffing/pong fixture and 512-byte reserve; no new process/socket/timer. Spec: A-7308 map covers removed wording/permission assertions; T3 retains actual base/guidance delivery and native protocol claims. C1/C2 source verified. Raw oversized/reworded scratch reds and restored 27/27 T1 resource-enforced green checked, with local macOS/report-only duration limits explicitly retained; affected T3 4+2 passes are targeted evidence only. C3/final execution settlement remains pending the post-source same-head mode-free task receipt. No Reviewer test execution.

Criteria: C1 verified, C2 verified.
