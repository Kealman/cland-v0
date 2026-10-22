---
id: T-1085
kind: task
title: demo status usage omits --commit, so qa lint rejects the documented freshness command
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-827
branch: t/T-1085-demo-status-usage-omits-commit-so-qa
created: 2026-10-21T22:38:59.689Z
updated: 2026-10-22T01:14:18.462Z
---

## Summary

`cland demo status --commit <sha>` works (hub/src/cli/demo.ts accepts it), and the qa skill tells QA to use it, but the `demo status` row in hub/src/cli/usage.ts omits `--commit`. So `cland qa lint` rejects a brief that writes the documented command. Found while drafting the E-1006 epic brief (2026-10-21), which had to work around it.

## Acceptance criteria

- [x] C1. The `demo status` usage row lists `--commit <sha>`, and `cland qa lint` accepts a brief line `cland demo status E-1 --commit <sha> --json` (test).
  - done: impl-1085 · 2026-10-22T01:04:06.290Z
  - verified: rev-23 [reviewer] · run rev-20261022-1085-final · 2026-10-22T01:14:18.392Z · commit 9c1c29d677815a98282958b48dfa0babbc54bd11

## Comments

### impl-1085 · 2026-10-22T01:03:43.496Z

Implementing C1 at the existing T1 lintQaBrief public seam: add the documented freshness command as a regression, observe the unknown --commit finding, then correct DEMO_USAGE. Existing parser, README and QA skill already document/support the flag; no command semantics or permissions change.

### rev-23 · 2026-10-22T01:04:57.726Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1085-source
commit: 9c1c29d677815a98282958b48dfa0babbc54bd11
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Two-file Standards/Spec audit against be198744:usage row now includes optional --commit <sha>,matching existing runDemo parser/README/QA skill. Public T1 lintQaBrief regression uses exact requested command under QA role and retains no-findings assertion; no new process/timer/tier or semantics/policy change. No findings; whitespace check0. A-8820 local19/19/typecheck is summary only,not configured proof. C1 final runtime mark awaits exact-head mode-free receipt; QA none. Audit A-8821.

### impl-1085 · 2026-10-22T01:13:56.567Z

Exact-head mode-free verification e5aa5a52-7e03-459b-9ed5-351c034cc9c9 completed exit 0 at 9c1c29d677815a98282958b48dfa0babbc54bd11; A-8829 durable log. Linux x64 droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5: T1, all T2 fallback in both packages, Web; 2370/2370 tests, zero fail/cancel/skip. Host typecheck gate at tree b15158afc2e83b8ebb9d146956b4ee1f401aae95 reused, not repeated remotely. Test lint and duration budget gates report-only, with warnings; no claim of enforcing those gates. T3 absent from configured batch tiers, deferred to periodic dev and integrated occasions (queue enabled). Droplet lifetime 470 s, cost $0.0327. Source review clear at same head; awaiting Reviewer final same-head settlement. No merge performed.

### rev-23 · 2026-10-22T01:14:18.392Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1085-final
commit: 9c1c29d677815a98282958b48dfa0babbc54bd11
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1 verified. Original A-8829/e5aa5a52 exactly matches reviewed head: T1/all-T2 fallback/Web exit 0, 2370 ordinary passes; new public QA-lint regression ordinary pass plus five distinct load passes and explicit 5/5. Host check passed, reused remotely; existing report-only diagnostics retained. T3 deferred by task policy, no T4/QA claim. Final audit artifact posted in topic-827; ready for Coordinator enqueue.

Criteria: C1 verified.
