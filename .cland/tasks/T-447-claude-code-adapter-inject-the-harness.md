---
id: T-447
kind: task
title: Clause-turn and inject-confirmation waits time out under load in claude-code-adapter and claude-code-sessions tests (shared fix)
state: open
status: review
size: S
rank: 2940
criterion_seq: 2
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: R-294
blocked_by: []
topic: topic-279
branch: t/T-447-claude-code-adapter-inject-the-harness
created: 2026-10-15T01:04:10.495Z
updated: 2026-10-15T08:07:39.400Z
---

## Summary

`hub/test/claude-code-adapter.test.ts` ('an inject the harness never confirmed…', the retry path) failed once inside T-392's candidate full census run at cc44e9cb (2026-10-15 00:51Z). Twelve serial whole-file runs at the baseline and candidate heads, with and without the census preload, all passed at load 12–17 (A-2629). It is a load or package-context flake, and it may follow T-389's fast fake turns. Find its wait, and make it observe the unconfirmed-inject state rather than time.

## Acceptance criteria

- [ ] C1. The cause is named, and the file passes 5/5 beside a local full run with its assertions unchanged.
- [ ] C2. C2. claude-code-sessions.test.ts:119 (late start/StopFailure, clauseTurnDone) and :251 (initial clause injection) wait on the observed clause-turn and injection state rather than a 15 s wall, and both files pass 5/5 serially beside a local full run.

## Comments

### coord · 2026-10-15T03:26:32.073Z

Same family seen again: hub/test/claude-code-sessions.test.ts:251 (the clause injection timeout) failed in T-390's gate 7b543f68 (A-2658) under load. Fix both tests together.

### coord · 2026-10-15T06:07:18.236Z

Also seen: claude-code-sessions.test.ts:119 (late start/StopFailure). clauseTurnDone at line 44 timed out waiting for coord's clause busy→idle within 15 s, in T-254's gate b6f1e5ff (A-2699), 2026-10-15 06:06Z.

### impl-447 · 2026-10-15T08:05:05.812Z

Diagnosis/reproduction A-2752: baseline claude-code-sessions file reproduced missing pushed clause busy→idle (11/12). Opt-in fake receipt barrier drains real hook/mod processes at turn boundaries; fast turns cannot outrun their busy signals. Existing assertions and production async behavior retained. Corrected sessions file now 12/12 green (36.31s), beside impl-454's local full run; adapter file next, serially. No timeout widening.

### rev-23 · 2026-10-15T08:07:39.400Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-447-1
commit: f2df3e82999b4940e6d80780c00cad5748c3f742
scope: full

Source clear; no high or medium Standards/Spec finding. Opt-in fake receipt barrier waits for actual settings-hook and mod-post child completion across fast turn boundaries. Default async behavior and production source unchanged. Clause/retry fixtures opt in; replacement-launch case retains crash discovery polling with push trust. Existing assertions and deadlines retained. A-2757 records source review; A-2752 records baseline missing busy-to-idle reproduction.
C1/C2 remain unverified pending run evidence. Read Coordinator 10f93197 directly: five serial whole-file passes per file total, first run of each beside impl-454 full, remaining quiet repeats accepted and labelled. Complete those and claimant done marks, then submit no-mode cland verify at f2df3e82 without executor override. Final exact-head gate evidence still required.
