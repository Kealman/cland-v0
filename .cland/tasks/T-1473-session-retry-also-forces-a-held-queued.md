---
id: T-1473
kind: task
title: "`session retry` also forces a held queued delivery"
state: closed
status: done
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
updated: 2026-10-30T23:20:51.633Z
closed: 2026-10-30T23:20:51.633Z
---

## Summary

`retry` accepts only `uncertain` deliveries, so the human had no command for a held `queued` one.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [x] C1. `cland session retry <s>` with a human delivery queued for over 60 s sends it to the session's bridge regardless of the hub's busy state and logs `inject-retry` with `stage: queued`.
  - done: impl-1473 · 2026-10-30T21:57:06.346Z
  - verified: rev-26 [reviewer] · run rev-20261031-1473-evidence-2 · 2026-10-30T23:10:16.954Z · commit 1f12b2d4875b945a31090263c4d16e1bc5f1a272
  - verified: rev-26 [reviewer] · run rev-20261031-1473-source-4 · 2026-10-30T23:14:33.338Z · commit 442717d5dab5df81fa2f31f73ed904f2fb086b97
- [x] C2. When nothing can be retried, the refusal names the message's current stage (queued, delivered, injected) and its age.
  - done: impl-1473 · 2026-10-30T22:30:16.882Z
  - verified: rev-26 [reviewer] · run rev-20261031-1473-evidence-2 · 2026-10-30T23:10:16.954Z · commit 1f12b2d4875b945a31090263c4d16e1bc5f1a272
  - verified: rev-26 [reviewer] · run rev-20261031-1473-source-4 · 2026-10-30T23:14:33.338Z · commit 442717d5dab5df81fa2f31f73ed904f2fb086b97

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

### impl-1473 · 2026-10-30T22:28:44.691Z

A-14719 verification red diagnosis: Linux droplet head eaddda9f2, T0/T1 exit0, T2 exit1; T3/Web unexecuted. Exact failure codex-delivery:292: /no uncertain delivery/ did not match 'cannot retry ... stage injected, age 800 ms'. Local targeted original test reproduced same red. Coordinator directs preservation of old phrase with stage/age appended, keeping original assertion unchanged. Consumer audit correction: grep across hub/test nvim/test web/test qa .agents/skills for no uncertain delivery, only a message whose inject got no answer, cannot retry message, unknown-stage no-delivery text, and not-running phrase; the sole legacy matcher is codex-delivery:292 (now retained unchanged). Existing consumer inventory named this file but failed to migrate/preserve its text contract. No production-path behavior change; both known and missing-delivery refusals retain old prefix, new stage/age retained. Whole codex-delivery file now 22/22 local macOS; requested other focused files underway.

### rev-26 · 2026-10-30T22:29:00.554Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1473-evidence-1
commit: eaddda9f22a8b6f0cd379cad647100212618acff
scope: evidence
findings: [{"severity":"medium","text":"M3: replacing the legacy 'no uncertain delivery' refusal breaks the unchanged Codex delivery consumer at codex-delivery.test.ts:292. Restore the old phrase and append stage/age detail; audit every changed refusal string and keep the existing assertion unchanged before fresh source review.","file":"hub/src/adapters/sessions.ts","line":2174}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14722: original60bde3a4/A-14719 native1 not clear. Exact codex-delivery.test.ts292 expected /no uncertain delivery/ but got new stage-injected/age800ms refusal; source audit missed that contract assertion.3692ordinarypass/1fail+215loadpasses,4550IDspaired;T0/T1green,T2partialred,T3/Web/T4unrun,browsernull. C2failed,C1unverified. Preserve old assertion/prefix plus additive detail and audit changed refusal consumers per Coordinator417cb7c2, then fresh source review before verify-all successor.

Criteria: C2 failed (New refusal drops legacy 'no uncertain delivery' phrase and fails unchanged Codex consumer; retain compatibility with additive stage/age detail.).

### rev-26 · 2026-10-30T22:30:10.576Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1473-source-3
commit: 1f12b2d4875b945a31090263c4d16e1bc5f1a272
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14724: M3 closed: both refusal branches restore legacy 'no uncertain delivery' with additive stage/age; delivery behavior unchanged. Original Codex assertion/test byte-identical; independent refusal-consumer scan confirms legacy matcher retained. Docs/skill/CHANGES aligned; M1/M2 remain closed. Source-only clear, C1/C2 runtime unverified; refresh C2done after prior failed mark. Coordinator verify-all retry at this frozen head precedes final evidence; A-14719 remains failed/partial.

### rev-26 · 2026-10-30T23:10:16.954Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1473-evidence-2
commit: 1f12b2d4875b945a31090263c4d16e1bc5f1a272
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14732: C1/C2 verified at original tested1f12b2d48. A-14730 native0,T0/T1/T2/T3/Web0,T4unrun;5974ordinarypass/8reasonedskip+250loadpasses,7204IDspaired,noadverse. Exact queued/retry/refusal/wire/CLI controls base+5/5 pass; unchanged Codex uncertain/refusal regex case passes. Linuxdroplet/isolatedHS1248 provenance matched;report-only warnings/skips retained. PriorA-14719 remains red. Separate merged442717d5d delta/waiver NOT cleared by this original-head verdict.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-30T23:14:33.338Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1473-source-4
commit: 442717d5dab5df81fa2f31f73ed904f2fb086b97
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14734: authorized docs merge delta clear. Sole SKILL conflict retains both sections verbatim; own retry production/help/wire/tests byte-unchanged. A-14733 completes rule6 hub+nvim text/identifier/helper-reader inventory and unaffected dispositions;124 targeted passes/0adverse across12 files, root typecheck+2 static checks exit0. C1/C2 carried from A-14732/A-14730 at original1f12b2d48 under Coordinator8d052e0e/66663b55 waiver:5974ordinarypass/8reasonedskip+250load,T0–T3/Web0,T4unrun. No merged-head full-run claim; prior redA-14719 remains red. Ready at exact442717d5d subject to lead's fresh fetch/merge-tree report.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-30T23:20:51.633Z

Merged 00d2db22363f126cabc54336297dc21e2bd5b7ae onto dev.
