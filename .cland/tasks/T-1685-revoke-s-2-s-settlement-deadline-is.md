---
id: T-1685
kind: task
title: Revoke's 2 s settlement deadline is shorter than the 5 s stop-and-reap wait it composes; revoke-native times out under load
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1673
topic: topic-1389
branch: t/T-1685-revoke-s-2-s-settlement-deadline-is
created: 2026-11-05T09:15:47.739Z
updated: 2026-11-05T11:18:57.295Z
closed: 2026-11-05T11:18:57.295Z
---

## Summary

The E-1532 stage-5 Linux cover 6c40efc8 at f66710b3 (A-16824, 2 shards, Linux x64) failed `hub/test/host-revoke-native.test.ts` "revoke settles live Claude Codex OpenCode and an already released Claude generation on the fake host" at line 123. The revoke reported `timedOut: true` and `inventoryComplete: false`, naming two OpenCode generations (live `opencode` and `stopped`) as `settlement pending`. The test took 18.5 s; the same case passed in 12.2–16.1 s in A-16786, A-16805, A-16807, A-16811, A-16821 and A-16822.

The likely cause is an interaction. Revoke's pre-cut settlement deadline is `HOST_SETTLEMENT_MS = 2000` (hub/src/host/settle.ts, from T-1666). T-1673 and T-1683 since made a local OpenCode or Codex stop wait up to 5 s for the child-exit receipt. Under load, settling OpenCode generations can now take longer than the 2 s revoke deadline, so a healthy host reports leftovers. The report itself is honest (C2 of T-1666), but a loaded host should not reach it routinely.

## What to build

Make revoke's settlement deadline consistent with the bounded waits it composes:
- the per-generation stop and reap settlement (5 s);
- private-file retirement;
- the inventory pass.

Either derive `HOST_SETTLEMENT_MS` from those bounds with a documented headroom, or settle generations concurrently so the total stays within the deadline. Keep every guarantee:
- the deadline still cuts authority;
- what is left is named;
- no Host call happens after the cut.

## Acceptance criteria

- [x] C1. Revoke's settlement deadline is at least the longest bounded wait it composes (per-generation stop and reap plus retirement), or the generations settle concurrently within it; the chosen relation is stated in docs/agents/host-agent.md (test).
  - done: impl-1685 · 2026-11-05T09:51:47.633Z
  - verified: rev-35 [reviewer] · run rev-35-1685-final-1 · 2026-11-05T10:36:17.348Z · commit ca38c462149218789ffa9775f2b41c38aa8d4cc5
- [x] C2. With an OpenCode child-exit receipt held for 3 s (inside the 5 s stop bound), revoke completes with inventoryComplete true and no leftovers. With it held past the stop bound, revoke names that generation as incomplete with timedOut false. Only a generation still held when the overall revoke deadline passes reports timedOut true, with no Host call after the cut (test, fake timers).
  - done: impl-1685 · 2026-11-05T09:51:48.224Z
  - verified: rev-35 [reviewer] · run rev-35-1685-final-1 · 2026-11-05T10:36:17.348Z · commit ca38c462149218789ffa9775f2b41c38aa8d4cc5
- [x] C3. host-revoke-native passes 20/20 locally under CPU load, including a Linux container run (evidence).
  - done: impl-1685 · 2026-11-05T10:06:57.075Z
  - verified: rev-35 [reviewer] · run rev-35-1685-final-1 · 2026-11-05T10:36:17.348Z · commit ca38c462149218789ffa9775f2b41c38aa8d4cc5

## Comments

### impl-1685 · 2026-11-05T09:34:50.007Z

Rule 20 consumer sweep (rg fields/functions/frames across hub, web, nvim, docs, skills): production host/settle.ts, adapters/sessions.ts, cli/host.ts, hub/dispatch.ts, hub/web-authority.ts, protocol.ts; tests host-revoke, host-revoke-native, host-settlement, host-secret-admission; docs host-agent, host-settlement and host-secret-admission guides; implement skill. CLI derives its frame timeout from the constant; dispatcher, protocol, web-authority and secret-admission only route/authorize unchanged host.revoke frames, unaffected. No web/nvim consumers or persisted settlement readers. Keep legacy renderer regression. Update deadline readers in host-revoke tests and stale two-second prose in host-agent and implement skill. No help syntax changes.

### impl-1685 · 2026-11-05T09:46:00.049Z

Consumer sweep correction: native host-revoke line121 explicitly sized its UI frame wait at5000 for the old2s cap. Five loaded assertions passed then sixth failed `no result for host.revoke within 5000ms` (test29.116s), without settlement result. Coordinator authorized migrating only timeout/import and preserving all assertions: frame HOST_SETTLEMENT_MS+3000; whole test named45s setup/teardown plus frame=60s. Repeat preservation and20+20 samples at this source; allowance update authorized after sampling. Original failed attempt retained as diagnostic, not C3 pass evidence.

### rev-35 · 2026-11-05T09:50:37.671Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1685-source-1
commit: 3134bbdbb3b7204b1c5b34e501b0ed13ca0a5781
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Interim source clear at corrected pin; no findings. A-16831 records both axes. Deadline derives from 2 * LAUNCH_SETTLEMENT_MS + 2000, concurrent steps start only after retained ownership/reboot fences are collected, pinned generation authorization and post-cut Host guards remain. CLI/native frame wait follows the imported constant; authorized whole-test setup budget preserves all assertions. The new OpenCode fixture's dual-clock and cleanup-order concerns were corrected before this verdict: one shared mocked elapsed timeline and beforeDirectories release/join registered before launch. C1–C3 remain unverified pending runtime receipts, completed loaded repetitions and the final authorized sampled allowance head. This interim verdict is not final verification or approval of an as-yet uncommitted allowance; changed final head needs fresh source review before configured verify. No reviewer tests or edits; QA none/after-stage.

### rev-35 · 2026-11-05T10:10:11.437Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1685-source-2
commit: ca38c462149218789ffa9775f2b41c38aa8d4cc5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final source clear, no findings. A-16836 records unchanged runtime/tests from A-16831 and the only new duration stanza. Independent raw sample/stat checks confirm 20 native code-0/signal-null outcomes on macOS arm64 and 20 on Linux arm64; worst 30.808951083/11.992901798 s yields ceil(1.5*worst)=47 s, below whole-test timeout 60 s. C-216 ownership and November 11 expiry unchanged; all other parsed manifest values identical. A-16835 arrived after the review note and was inspected before this verdict: original cwd, 20 preservation paths, combined command and outer session75066 exit0 now retained; driver lacks intrinsic head pin and observed timeline/retrospective runtime-source equivalence remain explicit. C1–C3 remain unverified until final same-head configured evidence is settled. Proceed with mode-free verify at this exact source-cleared head. No reviewer tests or edits; QA none/after-stage.

### rev-35 · 2026-11-05T10:36:17.348Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1685-final-1
commit: ca38c462149218789ffa9775f2b41c38aa8d4cc5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C3 verified. A-16840 records independently inspected exact-head run3d573e17/A-16839: 5140/5140, zero fail/cancel/skip/todo. Both actual OpenCode 3s/6s receipt controls and reverse-completion concurrency case pass base plus 5/5 load finishes each; all host-settlement13/host-revoke41 base outcomes pass, including overall cut/late Host-call and independent reboot controls. Native revoke passes12.820783194s on Linux x64. A-16834 supplies separately labelled loaded20/20 macOS+20/20 Linux arm64 native receipts; A-16835 retains original invocation/completion and explicit source-linkage limits. T0/allT1/fallback allT2/changedT3 once/Web completed; remaining T3 deferred, T4 unexecuted, no full-T3/QA claim. Candidate-tree projection independently matches; source clear A-16836 stands, no findings or reviewer rerun.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-05T11:18:57.295Z

Merged 094a2bc7e43c60a59810009ee0fc4fd007983629 onto dev.
