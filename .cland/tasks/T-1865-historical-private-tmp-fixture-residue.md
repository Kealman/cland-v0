---
id: T-1865
kind: task
title: Historical /private/tmp fixture residue cleanup with positive closure proof (split from T-1806 C2)
state: open
status: review
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by: []
topic: topic-1685
branch: t/T-1865-historical-private-tmp-fixture-residue
created: 2026-11-15T07:01:05.627Z
updated: 2026-11-20T18:25:30.367Z
---

## Summary

T-1806 stops native host fixtures from leaking `cland-h-*` socket folders and `ct-*` aliases into /private/tmp (C1), and adds a shared name-set inventory helper (C3). The one-off cleanup of the historical residue was T-1806's C2. It is split out here because T-1806's source review found a safety defect at 29fe07ba8. Worker-only owner receipts plus a negative argv/cwd/lsof census cannot prove that idle descendants of an inherited home are gone, and no positive closure receipt covers account, `hc-*` or suite roots. So the dry run's "eligible" set (12,555 of 12,561 candidates at 2026-11-15 06:54Z) is not safe authority to delete.

## What to build

Base the cleanup on positive proof, never on absence of evidence. Either:
- limit it to classes whose closure can be proven, such as socket folders and aliases whose recorded owner process has a confirmed native identity that is gone; or
- add closure receipts at fixture teardown that later cleanup can trust.

Anything without positive proof is kept and reported. The script removes by literal path, keeps a receipt listing each path, and is run by the Coordinator after review. A session never runs it.

## Acceptance criteria

- [x] C1. Each class the cleanup removes is justified by a positive closure proof, and roots without such proof (account, `hc-*` and suite roots with inherited homes) are kept and reported (test with planted live-descendant controls).
  - done: impl-1865 · 2026-11-20T17:50:10.120Z
- [x] C2. A dry run against /private/tmp lists every removal with its proof and every kept root with its reason. The real run removes only that list, by literal path, with a receipt (test on planted fixtures; the real run is the Coordinator's).
  - done: impl-1865 · 2026-11-20T17:50:12.511Z
  - verified: rev-40 [reviewer] · run rev-40-20261120-1865-source · 2026-11-20T17:52:16.187Z · commit 9ca00a7181a44926e3c55aa4400dfab05be5d182

## Comments

### impl-1865 · 2026-11-20T17:45:54.919Z

Consumer sweep and dry-run evidence: A-22189 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22189-t-1865-read-only-historical-census-and-development-controls). Its T-1865-consumers.txt lists 156 matching production, fixture, QA, docs and all-tier test paths. Existing allocation/disposal interface remains unchanged; private alias-closed.json is additive, ignored by Git/copy, invalidated before allocation. Legacy clients/aliases grant no cleanup authority. Coordinator confirmed the alias-only seam; all historical roots retained. Historical dry run: 519 kept, zero eligible, exact literal paths/reasons/class sizes/mtime in artifact plan.json. No deletion follows per Coordinator decision. New T2 2/2 and existing fixture-socket-path 20/20 local macOS passes; configured verification pending.

### rev-40 · 2026-11-20T17:52:16.187Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261120-1865-source
commit: 9ca00a7181a44926e3c55aa4400dfab05be5d182
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear: Standards0 findings, Spec0 findings. Exact reciprocal alias/storage proof, private bounded receipt, allocation invalidation, literal plan revalidation and fsynced intent/completion reviewed. No recursive/root deletion. Coordinator scope and no-historical-deletion decisions independently confirmed. A-22195 saved dry run has519 kept/zero eligible with reasons and class census; C2 source/dry-run established. C1 runtime controls and final clearance await ordinary configured verify at unchanged head. Planted live-descendant reference is injected, as docs disclose; no native absence census is treated as closure. Reviewer performed read-only source/saved-evidence review, no tests/browser/census/deletion.

Criteria: C2 verified.
