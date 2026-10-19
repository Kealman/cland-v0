---
id: T-826
kind: task
title: QA skill still describes Coordinator batch covers instead of the merge queue protocol
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: topic-551
branch: t/T-826-qa-skill-still-describes-coordinator
created: 2026-10-19T03:58:09.423Z
updated: 2026-10-19T05:03:44.962Z
---

## Summary

`.agents/skills/qa/SKILL.md` (around line 61) still tells QA that the Coordinator runs integrated suites per batch of about three merges. Since T-711 and T-713, the merge queue builds batches of up to three items and runs their T1/T3 coverage, and task verify runs T0, T1 and selected T2 tests on queue-enabled projects. Found by impl-718 during T-718's clause audit and kept out of its reviewed head.

## Acceptance criteria

- [x] C1. The QA skill describes the live protocol: task runs cover T0–T2, merge-queue batches run T1/T3, close occasions and the soak add T4; when QA needs a full suite on a non-dev head it uses `verify all` as the skill says. The wording matches docs/agents/tests.md and the merge skill after T-718.
  - done: impl-826 · 2026-10-19T04:47:55.640Z
  - verified: rev-30 [reviewer] · run rev-20261019-826-final · 2026-10-19T05:03:44.489Z · commit 5bc3a12c6e6cb39e7250dfb68e7ec54519aae752

## Comments

### impl-826 · 2026-10-19T04:47:30.023Z

Compared the QA verification paragraph with docs/agents/tests.md and the merge skill after T-718; updating only that paragraph. No test pins its wording.

### rev-30 · 2026-10-19T04:48:46.199Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-826-source
commit: 5bc3a12c6e6cb39e7250dfb68e7ec54519aae752
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings on either axis. A-5777 records the single-paragraph comparison with pinned post-T-718 test guidance and merge skill. Task/host opt-in and fallback tiers, hub batch T1/T3, integrated/all T1–T3, occasion/soak T4 and authorized all/non-dev wording match C1; no other content, permissions or tests changed. C1 final mark awaits accepted exact-head post-clear gate. QA scope none.

### rev-30 · 2026-10-19T05:03:44.489Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-826-final
commit: 5bc3a12c6e6cb39e7250dfb68e7ec54519aae752
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear from source A-5777 and accepted same-head d0a9d4cf/A-5781; raw audit A-5782. T0–T2 fallback gate: 1463/1463 pass, zero fail/cancel/skip, including hub and Neovim T2; T3 deferred to batch, not claimed. All 383 reported repetition groups pass 5/5. Exactly three report-only legacyDurationKeys Git tier trips remain disclosed under shared T-803. Single QA paragraph matches task, hub batch, integrated/all, occasion/soak tiers and authorized non-dev verify-all protocol. No findings; C1 verified. QA scope none.

Criteria: C1 verified.
