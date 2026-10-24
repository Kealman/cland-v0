---
id: T-1209
kind: task
title: A session in a closed release's topic cannot send to coordinator
state: open
status: review
size: S
criterion_seq: 2
labels:
  - qa-found
  - needs-triage
assignee: null
parent: E-1216
blocked_by: []
topic: topic-958
branch: t/T-1209-a-session-in-a-closed-release-s-topic
created: 2026-10-24T06:59:07.947Z
updated: 2026-10-24T10:11:21.837Z
---

## Summary

After R-377 closed, qa-676 could not send its post-release report from topic-923 (the release's topic): every `send` was refused for closed-item routing, including `to: coordinator` by literal name. The verdict itself recorded fine. Seen 2026-10-24 ~06:09Z, run qa-post-release-2026-10-24-1, evidence A-10320.

## Acceptance criteria

- [x] C1. A send addressed to `coordinator` (role or literal name) from the topic of a closed item is delivered, shown by a hub test that closes a release and then sends from its topic (test).
  - done: oc-1209 · 2026-10-24T10:11:21.837Z
- [x] C2. A send addressed to `lead T-n` for a closed item still falls back to the Coordinator instead of being refused, matching the documented `lead` resolution (test).
  - done: oc-1209 · 2026-10-24T10:05:13.744Z

## Comments

### rev-31 · 2026-10-24T10:08:35.392Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-1209-source
commit: 2e91bed34e9c6a7b96228a9b9c13459291b2d82f
scope: full
findings: [{"severity":"medium","text":"M1: New hub-test-item-lead.test.ts.md is absent from the index. Static committed-file/index comparison finds that sole missing row; existing test-docs.test.ts/ assertTestDocIndex requires every document exactly once and will fail. Add the exact test/doc link row and retain the guard.","file":"docs/agents/tests/index.md"}]
finding_counts: {"high":0,"medium":1,"low":0}

A-10719 full source audit at 2e91bed3/tree90d5361b: one medium Standards finding, no Spec/production finding. Closed-item null lead correctly falls to Coordinator for lead addressing and question recording; missing items still throw; old claimant and separate closed-item restrictions remain excluded. Both new T2 cases use FakeClock/in-process fixtures and preserve durable-recipient/delivery assertions. Literal send stays in a closed release's topic even after topic reopens, satisfying C1; no second finding. Supply available original local command output/exits/timings/source attribution without transcription reruns. Correct index, direct docs guard validation, then fresh source review before configured verify. No Reviewer execution.

Criteria: C1 failed (M1: newly added per-test note lacks its required index row, so the existing T1 documentation contract will fail.).

### rev-31 · 2026-10-24T10:11:02.700Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1209-source2
commit: 5b041a25e5933deb415fbc457117b75bd0908243
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at 5b041a25/tree5f52e32d; no findings. A-10723 carries A-10719 full audit. Only correction is the required exact index row; no production/test changes or dev merge. A-10721 local macOS arm64 direct docs guard3/3 exit0 and item-lead12/12 exit0 support correction, with summary/excerpt packaging limitations explicit. Closed-item Coordinator fallback and unknown/ordinary permission restrictions unchanged from audit. C1/C2 runtime settlement pending ordinary configured mode-free same-head result; restore C1 claimant done mark cleared by prior finding before submission. No Reviewer execution/enqueue.
