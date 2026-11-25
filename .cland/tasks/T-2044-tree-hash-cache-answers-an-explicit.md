---
id: T-2044
kind: task
title: Tree-hash cache answers an explicit --executor local epic cover with a cached Linux droplet result (no macOS run)
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1783
branch: t/T-2044-tree-hash-cache-answers-an-explicit
created: 2026-11-21T03:00:38.190Z
updated: 2026-11-25T13:15:20.173Z
---

## Summary

A Coordinator `verify all --occasion epic --executor local` submission at dev b9573ba7b (tree e6e9e532) on 2026-11-21 02:59Z was answered at once from the tree-hash cache with the Linux droplet stage cover 508d39b0 (A-22308: "cached", "Original occasion stage · executor droplet"). No macOS run happened. The request explicitly asked for the local executor, on a macOS host, for the epic DoD gate that requires a macOS full cover (T-1892), so a different-platform cached result can never satisfy it. Resubmitting with `fresh: true` ran locally.

## What to build

When a submission names an executor or platform, or its occasion requires one (the macOS epic cover), the cache only reuses results from that executor and platform. Otherwise it runs. Report the reuse decision in the result.

## Acceptance criteria

- [x] C1. An `--executor local` (or macOS-required occasion) submission with only a cached Linux droplet result for the tree runs locally instead of returning the cached result (test).
  - done: impl-2044 · 2026-11-25T13:11:08.103Z
- [x] C2. A same-platform cached result is still reused, and the result names the cached run's executor and platform (test).
  - done: impl-2044 · 2026-11-25T13:11:08.223Z

## Comments

### impl-2044 · 2026-11-25T13:05:31.226Z

Consumer inventory before cache admission policy change: receiptExecutionMatches is called only by Suites.#cacheReceiptAvailable; #cached/#cacheInputsMatch serve admission and explicit-droplet bypass diagnostics. Cache fields are read by dispatch reports, CLI verify output, web verification model, shared wire conformance, batch-member-verification, stage/epic cover derivation and persisted suite restoration. Searched function names and cached/cacheBypass/original occasion/executor/platform across hub/src, hub/test, nvim/test, web, docs, qa and shipped skills; wire shape remains unchanged. Existing suite-cache, suite-release-cache, suite-queue, suite-cover and suite-persistence tests pin provenance. Red reproduction: both new whole-case tests returned cached.executor='droplet' for explicit local and default-local epic requests (expected cached undefined).

### impl-2044 · 2026-11-25T13:09:54.597Z

Detailed consumer disposition: Suites admission and verification-tree matcher migrated; dispatch cache provenance now names OS; CLI SUITE_USAGE and frozen commands.json updated together. CLI suite.start parser, protocol/SuiteAdmission cached shape, shared/wire, previous-shape cache tests, web and Neovim readers unchanged because no fields removed or added. Persisted suite jobs use existing platform/cacheBypass fields; old missing OS is refused only for constrained reuse. suite-stage-cover, suite-persistence, suite-queue, suite-accounting, executor-run-rules, suite-cache-recovery, suite-release-cache and suite-cache exercise existing readers; startup probes and QA briefs consume the same durable result identity with no wire migration. Production import graph found 758 reachable manifest tests (T1 69, T2 374, T3 226, T4 14, other/Web 75), with 18 unresolved dynamic-loader/external edges reported separately; this is a partial static inventory, not runtime proof. Running changed files and ~5 direct regressions locally; broad selection deferred to verify. No rule clause edits per launch brief.

### rev-41 · 2026-11-25T13:15:20.173Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2044-source1
commit: 307609ad2c31ce3ab0d96ed8ce1cc6cb2bc0f386
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. Explicit local/droplet and effective stage/epic/release executor constraints reach shared executor/OS matcher; unknown OS misses constrained reuse. Ordinary omitted-executor reuse and existing success/artifact/expiry/supersession checks remain. Incompatible source/request facts persist in bypass log/result; hits copy/report original executor/platform. Both new owned suiteCase controls cover incompatible executor, wrong/unknown OS and matching cached durable result/no worker; existing release/explicit-droplet/report controls retained. Help export/frozen bytes match, docs/README/skill CHANGES updated, consumer census assessed. Standards/Spec A-23413: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23413-t-2044-source-review-clear-at-307609ad2.md. C1/C2 remain unverified until exact-head configured receipts. A-23408 selected local macOS checks/static inventory are not broad configured/T3/T4/browser proof. No Reviewer execution or edits. Follow Coordinator verify window; changed head needs source review.
