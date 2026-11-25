---
id: T-2044
kind: task
title: Tree-hash cache answers an explicit --executor local epic cover with a cached Linux droplet result (no macOS run)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1783
branch: t/T-2044-tree-hash-cache-answers-an-explicit
created: 2026-11-21T03:00:38.190Z
updated: 2026-11-25T13:05:31.226Z
---

## Summary

A Coordinator `verify all --occasion epic --executor local` submission at dev b9573ba7b (tree e6e9e532) on 2026-11-21 02:59Z was answered at once from the tree-hash cache with the Linux droplet stage cover 508d39b0 (A-22308: "cached", "Original occasion stage · executor droplet"). No macOS run happened. The request explicitly asked for the local executor, on a macOS host, for the epic DoD gate that requires a macOS full cover (T-1892), so a different-platform cached result can never satisfy it. Resubmitting with `fresh: true` ran locally.

## What to build

When a submission names an executor or platform, or its occasion requires one (the macOS epic cover), the cache only reuses results from that executor and platform. Otherwise it runs. Report the reuse decision in the result.

## Acceptance criteria

- [ ] C1. An `--executor local` (or macOS-required occasion) submission with only a cached Linux droplet result for the tree runs locally instead of returning the cached result (test).
- [ ] C2. A same-platform cached result is still reused, and the result names the cached run's executor and platform (test).

## Comments

### impl-2044 · 2026-11-25T13:05:31.226Z

Consumer inventory before cache admission policy change: receiptExecutionMatches is called only by Suites.#cacheReceiptAvailable; #cached/#cacheInputsMatch serve admission and explicit-droplet bypass diagnostics. Cache fields are read by dispatch reports, CLI verify output, web verification model, shared wire conformance, batch-member-verification, stage/epic cover derivation and persisted suite restoration. Searched function names and cached/cacheBypass/original occasion/executor/platform across hub/src, hub/test, nvim/test, web, docs, qa and shipped skills; wire shape remains unchanged. Existing suite-cache, suite-release-cache, suite-queue, suite-cover and suite-persistence tests pin provenance. Red reproduction: both new whole-case tests returned cached.executor='droplet' for explicit local and default-local epic requests (expected cached undefined).
