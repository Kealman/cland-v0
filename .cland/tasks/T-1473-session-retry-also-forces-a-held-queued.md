---
id: T-1473
kind: task
title: "`session retry` also forces a held queued delivery"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: topic-1255
branch: t/T-1473-session-retry-also-forces-a-held-queued
created: 2026-10-30T07:50:18.352Z
updated: 2026-10-30T22:28:04.017Z
---

## Summary

`retry` accepts only `uncertain` deliveries, so the human had no command for a held `queued` one.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. `cland session retry <s>` with a human delivery queued for over 60 s sends it to the session's bridge regardless of the hub's busy state and logs `inject-retry` with `stage: queued`.
  - done: impl-1473 · 2026-10-30T21:57:06.346Z
- [x] C2. When nothing can be retried, the refusal names the message's current stage (queued, delivered, injected) and its age.
  - done: impl-1473 · 2026-10-30T21:57:09.552Z

## Comments

### impl-1473 · 2026-10-30T21:53:15.217Z

Contract consumer inventory before changes: Sessions.retry → answerSession (requests.ts) → dispatcher/web-authority; CLI session.ts and usage.ts plus cli-usage fixture; HubCore.retryUncertain and journal inject-retry allowlist; Store deliveryRoot/deliveriesOf/queued and injectionStarted persisted readers. Existing callers/tests: cli-identity, progress (digest root), inject-stalled, fake-harness, codex-delivery, journal-async; T1 human-hold is the focused new policy seam. Searches across hub/docs/.agents/nvim/web/qa found no T3/T4 or UI retry caller. Keep existing message-id wire form and {retried:true} reply compatible; optional message selection is additive. Docs: hub README session frame/delivery sections, test guide, implement skill own section. No new role permission or clause lines.

### impl-1473 · 2026-10-30T21:56:14.111Z

Inventory correction: shared/wire/index.ts also owns SessionRequest and is migrated to optional message alongside production requests.ts; hub/test/wire-conformance.ts enforces identity (caught by initial typecheck). Candidate selection reads live queued/uncertain index ranges, with an indexed latest-recipient fallback for refusal; no retained-history materialization. C1 red: 'no uncertain delivery ... only a message whose inject got no answer'; C2 baseline red: stage/age regex received that same old refusal. Both new controls now green in human-hold (11 cases total).

### rev-26 · 2026-10-30T22:00:30.593Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1473-source-1
commit: be2680f3f386f17a40b3d6b24467e98d5de209a0
scope: full
findings: [{"severity":"medium","text":"M1: the new owning guide is absent from docs/agents/tests/index.md. The unchanged complete test-docs guard requires an indexed row for every guide and fails on this document; add only the owning metadata and preserve full unchanged-guard red/green.","file":"docs/agents/tests/hub-test-session-retry.test.ts.md","line":1},{"severity":"medium","text":"M2: the new CLI case acquires root/hub/socket/spoke without a pre-registered shared acquisition owner or separate setup bound, and its prearmed injected observer has no immediate rejection owner if CLI/assertions fail. Compose shared bounded fixture/observation owners, join late acquisition before disposal/root removal, and retain omitted/aborted setup drainage controls and final semantic assertions.","file":"hub/test/session-retry.test.ts","line":9}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14706: source not clear for M1 missing owning test-guide index and M2 bounded/pre-owned CLI fixture acquisition/observer. No additional production blocker found; transport ack/native confirmation and uncertain/attempted fences retained. C1/C2 remain run-dependent/unverified. Lead's reported working-tree fixes are pending exact pushed-head source review; no verification before clearance.

### rev-26 · 2026-10-30T22:01:30.679Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1473-source-2
commit: eaddda9f22a8b6f0cd379cad647100212618acff
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14708: M1/M2 closed: correct owning guide index, pre-registered caseDeadlines/shared component acquisition and observation ownership, separately bounded setup/CLI/receipt, late-acquisition drainage/root barrier. Semantic/refusal assertions retained; production unchanged from source1. No remaining Standards/Spec findings. C1/C2 runtime remain unverified. Report ready for Coordinator verify all at this frozen head; no local/full/browser pass inferred from source or A-14707 summaries.
