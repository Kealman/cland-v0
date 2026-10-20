---
id: T-937
kind: task
title: "setup --no-aide: the Aide step's detail line names --no-aide"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-691
branch: t/T-937-setup-no-aide-the-aide-step-s-detail
created: 2026-10-20T05:13:34.640Z
updated: 2026-10-20T05:24:10.023Z
closed: 2026-10-20T05:24:10.023Z
---

## Summary

E-613's DoD demo (qa-676, A-7031/A-7033) found that with `cland setup --no-aide`, the skipped Aide step's detail reads "cland starts the hub with the workbench" and never says it was skipped because of `--no-aide`.

## Acceptance criteria

- [x] C1. Under `--no-aide`, the Aide step's line says it was skipped by `--no-aide` and how to start the Aide later; the existing setup tests and the one covering this line are green.
  - done: impl-937 · 2026-10-20T05:14:28.631Z
  - verified: rev-31 [reviewer] · run rev-20261020-937-final · 2026-10-20T05:19:37.334Z · commit 616c5cd73d4474bbc492f652976fc5f41c2e6618
- [x] C2. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-937 · 2026-10-20T05:17:48.422Z
  - verified: rev-31 [reviewer] · run rev-20261020-937-final · 2026-10-20T05:19:37.334Z · commit 616c5cd73d4474bbc492f652976fc5f41c2e6618

## Comments

### impl-937 · 2026-10-20T05:14:07.494Z

Implementing the minimal Aide detail change and updating the existing setup-hub T1 assertion; source review precedes mode-free verification. No merge requested.

### rev-31 · 2026-10-20T05:15:07.371Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-937-source
commit: 616c5cd73d4474bbc492f652976fc5f41c2e6618
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings; A-7065. Skipped Aide detail names --no-aide and gives the valid later-start command cland setup in a terminal. Existing T1 exact assertion covers both interactive and nonterminal paths with no client calls. C1 implementation established; existing-tests-green clause and C2 await independent audit of configured mode-free verification at this exact head.

### impl-937 · 2026-10-20T05:17:49.009Z

Mode-free verify b255d586-3db4-4f2a-addf-1ce218bf44bb passed at reviewed head 616c5cd73d4474bbc492f652976fc5f41c2e6618: 570/570 tests, T1 and coverage-selected T2 green. Linux x64 droplet c-8 lon1, lifetime 109 s, cost $0.0076. Evidence A-7071 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7071-suite-b255d586-3db4-4f2a-addf-1ce218bf44bb-auto-at-616c5cd.log. C1/C2 implemented; awaiting Reviewer final evidence verdict. No merge enqueued.

### rev-31 · 2026-10-20T05:19:37.334Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-937-final
commit: 616c5cd73d4474bbc492f652976fc5f41c2e6618
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-7080 independently audits complete A-7071 / b255d586 at unchanged reviewed head. 570/570 ordinary passes; host check/all T1/selected T2 green, no tier mismatch or hard budget failure. All seven setup-hub cases pass, including exact --no-aide guidance for both interactive paths; real-hub setup launch also passes. C1/C2 verified; claimant done marks present. No merge action.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T05:24:10.023Z

Merged afdd33452c43fab2e6ee10feedc857fe3371b0d6 onto dev.
