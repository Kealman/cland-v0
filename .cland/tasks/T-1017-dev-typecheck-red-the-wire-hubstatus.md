---
id: T-1017
kind: task
title: "dev typecheck red: the wire HubStatus lacks T-978's web field"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-978
found_by: review
topic: null
branch: t/T-1017-dev-typecheck-red-the-wire-hubstatus
created: 2026-10-20T17:29:41.186Z
updated: 2026-10-20T17:43:16.205Z
closed: 2026-10-20T17:43:16.205Z
---

## Summary

`npm run typecheck` fails on dev since T-978 landed (af8c3f72): `hub/test/wire-conformance.ts(158,10): error TS2344` because T-978 added `web?: WebEdgeStatus` to the hub's `HubStatus` while T-979's browser wire module (shared/wire) does not carry it. The two landed in separate green T1 batches; the typecheck is not part of the batch tiers. Every task verify now fails its T0 typecheck.

## What to build

Add `WebEdgeStatus` and `HubStatus.web` to shared/wire, with a conformance assertion for `WebEdgeStatus`. One commit, cherry-picked into affected branches.

## Acceptance criteria

- [x] C1. `npm run typecheck` passes at the fix head, and wire-conformance asserts `WebEdgeStatus` and `HubStatus` equal between the hub and the wire.
  - done: coord · 2026-10-20T17:29:59.572Z
  - verified: rev-23 [reviewer] · run rev-20261020-1017-source · 2026-10-20T17:31:48.057Z · commit 6bd1d5bcba455b0e3e1319ed6ab94537cdbb8161

## Comments

### rev-23 · 2026-10-20T17:31:48.057Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-1017-source
commit: 6bd1d5bcba455b0e3e1319ed6ab94537cdbb8161
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Two files/five added lines: shared/wire restates WebEdgeStatus exactly as hub protocol (port:number, available:boolean, reason?:string) and adds optional HubStatus.web, preserving absent/stdio compatibility. New direct WebEdgeStatus recursive equality and unchanged HubStatus equality cover both shapes. No runtime/import/dependency or command behavior change; existing web status docs still match. C1 verified using source equality audit plus Coordinator's exact-head local macOS npm run typecheck exit0 report in e14d76af, accepted explicitly by decision f0101d43. This is reported targeted compiler evidence, not a raw log or queued Linux/suite receipt inspected by Reviewer. Coordinator explicitly waived artifact for this XS review; original publication not retried. Reviewer read only and ran no compiler/tests.

Criteria: C1 verified.

### coord · 2026-10-20T17:43:16.205Z

Merged 248a9eeb0006119b7b7b841f77172147d20d8e1c onto dev.
