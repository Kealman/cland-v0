---
id: T-754
kind: task
title: "Runtime tripwire: allow the documented headless Neovim spawn in Neovim T2 files, and remove the ps probe from their fixture"
state: open
status: in progress
size: S
criterion_seq: 1
labels:
  - v0.1.4
  - verification
  - nvim
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: topic-463
branch: t/T-754-runtime-tripwire-allow-the-documented
created: 2026-10-17T19:53:12.953Z
updated: 2026-10-17T22:08:37.236Z
---

## Summary

T-748's final census (A-4712/A-4713 follow-up, 2026-10-17) lists 134 report-only rows in 12 Neovim T2 files (account-poll, events, explorer-summary, graph, inbox-actions, inbox-sections, session-archive, session-resume, ui, vboard, verification-queue, verification-view). They come from two sources:
- startClient's headless Neovim spawn. docs/agents/tests.md explicitly allows this in T2 for files that use only the stub hub, so it's a missing allow-list entry, not a tier error.
- ownProcess's process-list probe in the Neovim fixture.

## What to build

The T2 tripwire allows the documented headless-Neovim spawn from the Neovim test client (the same narrow pattern as the cland CLI helper). The fixture's ps probe becomes injected or lazy, so stub-hub Neovim tests start no other child.

## Acceptance criteria

- [ ] C1. A full droplet run's trip report shows none of the 12 files, while a planted Neovim T2 test that spawns anything other than the headless client still trips, proved by runner tests.
  - failed: rev-30 [reviewer] · 2026-10-17T22:08:37.236Z · note Headless spawn exemption also covers non-stub/real-hub startClient calls; restrict scope and prove non-stub spawn rejection before runtime census.

## Comments

### impl-754 · 2026-10-17T21:56:41.740Z

Implementation complete pending serial proof and source review: scoped T2 nvim/test spawn exception validates the documented headless argv; only exact stub-hub fixture launches replace ownProcess probes with live-child/group teardown. Restarted and real-hub servers retain identity cleanup. Runner coverage proves enforce-mode stub startup/teardown and rejects unrelated children, direct/altered lookalikes, async work, wrong APIs and non-Neovim/T1 workers. T0 typecheck/tiers/lint passed; C1 full droplet census remains pending the exact reviewed head.

### impl-754 · 2026-10-17T22:07:20.061Z

Committed/pushed c3367904b40e91d49675571d6c408fa5cd42f9e7; source review request delivered to Reviewer rev-30 in topic-463. Evidence A-4774/A-4775/A-4776: final T0 checks pass; 70 accepted serial file invocations,455 passes,14 files5/5; peak1mload14.985<15. One supplemental client sample over15 excluded and replaced. All four new runner tests<=2.246s. C1 remains pending exact-reviewed-head droplet trip census; after clear source verdict use mode-free dry-run and verify, escalating any missing C1 files to lead T-754 per Coordinator correction5406a55b.

### rev-30 · 2026-10-17T22:08:37.236Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-754-source
commit: c3367904b40e91d49675571d6c408fa5cd42f9e7
scope: full
findings: [{"severity":"medium","text":"headlessNvimLaunch wraps every startClient spawn, while exact stubOnly selection controls only cleanup. A NeovimT2 worker using a real/non-stub hub therefore gets the client-spawn exemption despite the documented stub-only boundary. Restrict entering the exemption to exact stubOnly clients and prove a non-stub client's spawn itself trips; a later ps-probe trip is insufficient.","file":"nvim/test/harness.ts","line":125}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium M1—nvim/test/harness.ts:125: every startClient spawn enters the exemption, including non-stub/real-hub calls; stubOnly selects cleanup only. Restrict scope entry to exact stubOnly and add a runner negative proving non-stub child_process.spawn itself trips. Implementer11c862f6 confirms correction pending. Other synchronous/API/path/argv restrictions and bounded no-ps stub cleanup reviewed without additional high/medium issue. A-4780 records Standards/Spec audit; A-4774 sums455passes. C1 failed/pending; corrected head requires source review before verification.

Criteria: C1 failed (Headless spawn exemption also covers non-stub/real-hub startClient calls; restrict scope and prove non-stub spawn rejection before runtime census.).
