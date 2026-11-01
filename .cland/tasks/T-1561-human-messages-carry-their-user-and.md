---
id: T-1561
kind: task
title: Human messages carry their user, and deliveries name the author
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
topic: topic-1306
branch: t/T-1561-human-messages-carry-their-user-and
created: 2026-10-31T23:47:50.605Z
updated: 2026-11-01T21:34:00.220Z
---

## Summary

In users mode a human message stores its user's id, and its `from` is the user's name, with `fromKind` still `human`. A delivery to an agent therefore reads `from="<user>" from_kind="human"` through the existing envelope. Human messages written before the switch read as the first user's, and the journal's `human-send` names the user's id.

Hot files: `hub/src/hub/core.ts` [Host] (human send, delivery projection), `hub/src/hub/store.ts` [Host] (`messages.user_id`), `hub/src/hub/dispatch.ts` [Host], `hub/src/hub/journal.ts`, `hub/src/protocol.ts` [Host]. **Not** `hub/src/adapters/` or `hub/src/spoke/`.

## Acceptance criteria

- [x] C1. A message a user writes in users mode is stored with that user's id and read back with `from` set to the user's name and `fromKind` `human`.
  - done: impl-1561 · 2026-11-01T19:59:11.631Z
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-1 · 2026-11-01T20:22:03.668Z · commit d889d401d29848efd69ed8db59f3c48a7ed0bdb9
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-2 · 2026-11-01T21:33:58.047Z · commit c353a539554305f401261d5f2bbb369aecaef1cc
- [x] C2. A delivery of that message to an agent session carries the user's name in `from`, through the unchanged envelope and spoke code.
  - done: impl-1561 · 2026-11-01T19:59:11.808Z
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-1 · 2026-11-01T20:22:03.668Z · commit d889d401d29848efd69ed8db59f3c48a7ed0bdb9
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-2 · 2026-11-01T21:33:58.047Z · commit c353a539554305f401261d5f2bbb369aecaef1cc
- [x] C3. Two users writing in General produce messages with two different authors in `topic.history` and in the Coordinator's deliveries.
  - done: impl-1561 · 2026-11-01T19:59:12.714Z
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-1 · 2026-11-01T20:22:03.669Z · commit d889d401d29848efd69ed8db59f3c48a7ed0bdb9
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-2 · 2026-11-01T21:33:58.048Z · commit c353a539554305f401261d5f2bbb369aecaef1cc
- [x] C4. After the switch, human messages written in single mode read as the first user's in `topic.history`.
  - done: impl-1561 · 2026-11-01T19:59:14.492Z
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-1 · 2026-11-01T20:22:03.669Z · commit d889d401d29848efd69ed8db59f3c48a7ed0bdb9
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-2 · 2026-11-01T21:33:58.048Z · commit c353a539554305f401261d5f2bbb369aecaef1cc
- [x] C5. The journal's `human-send` record carries the author's user id in users mode, and never the text.
  - done: impl-1561 · 2026-11-01T19:59:15.447Z
  - verified: rev-37 [reviewer] · run rev-37-1561-source-1 · 2026-11-01T20:01:18.800Z · commit d889d401d29848efd69ed8db59f3c48a7ed0bdb9
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-1 · 2026-11-01T20:22:03.669Z · commit d889d401d29848efd69ed8db59f3c48a7ed0bdb9
  - verified: rev-37 [reviewer] · run rev-37-1561-delta-1 · 2026-11-01T21:17:31.810Z · commit c353a539554305f401261d5f2bbb369aecaef1cc
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-2 · 2026-11-01T21:33:58.048Z · commit c353a539554305f401261d5f2bbb369aecaef1cc
- [x] C6. Single-mode messages keep `from` `human` and no user id, with every existing message and delivery test unchanged.
  - done: impl-1561 · 2026-11-01T19:59:16.469Z
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-1 · 2026-11-01T20:22:03.669Z · commit d889d401d29848efd69ed8db59f3c48a7ed0bdb9
  - verified: rev-37 [reviewer] · run rev-37-1561-evidence-2 · 2026-11-01T21:33:58.048Z · commit c353a539554305f401261d5f2bbb369aecaef1cc

## Comments

### impl-1561 · 2026-11-01T19:56:00.106Z

Contract consumer inventory: searched sendFromHuman, human-send, fromKind/from_kind, from_name, topic.history and toMessage across hub production, shared/wire, web/src, nvim, all test tiers, docs and shipped skills (full path list will accompany evidence artifact). Store projection covers all persisted message readers (history, queues, digest, thread runs, verifier). Dispatch ordinary/prompt/upload sends pass trusted transport user; core internal human producers default to first user until their attribution items land. Protocol adds optional userId for old-wire compatibility; adapters/spoke read existing from/fromKind unchanged. Web/nvim human rendering uses fromKind, with display changes assigned T-1564. Existing single-mode fixtures and old wire literals remain valid. Core verifier admission must use human kind after authors become names. Withdrawal explicitly limited to from=human today, left fenced pending user-scoped ownership; reported separately.

### impl-1561 · 2026-11-01T19:58:04.470Z

Consumer inventory artifact A-15372: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15372-t-1561-shared-contract-consumer-inventory.md. Includes production, shared/wire, client, tests across tiers, docs and QA matches plus migration/unaffected rationale. Added optional userId to both protocol definitions; typecheck passes. New regression was red (human !== jane), now green across persisted Store, history, unchanged spoke metadata and flushed durable journal.

### rev-37 · 2026-11-01T20:01:18.800Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1561-source-1
commit: d889d401d29848efd69ed8db59f3c48a7ed0bdb9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, Standards/Spec no findings. Additive message user_id migration and optional userId in both wire declarations; every Store row projection uses common author resolver. Ordinary/prompt/upload dispatch uses trusted connection user, core rechecks active id; forged frame identity ignored. Persisted legacy human rows map to first user in users mode; single writes remain human without id. Existing envelopes/spoke and preservation tests unchanged; bounded T2 exact notification/journal flush receipts reviewed. C5 content-free journal established by source; C1–C4/C6 runtime evidence awaits exact-head mode-free verify. A-15378 has review boundaries, A-15372 inventory, corrected A-15375 supplemental local macOS arm64 Node24.21.0 evidence (no browser/full tier run). Coordinator-scoped withdrawal deferral T-1584 and sibling attribution producers noted; no Reviewer execution.

Criteria: C5 verified.

### rev-37 · 2026-11-01T20:22:03.669Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1561-evidence-1
commit: d889d401d29848efd69ed8db59f3c48a7ed0bdb9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged source-reviewed head. A-15392 run06c4cdd9 Finished exit0, noncached tree4895a02ed659107a2a9e37e6fccf5c410842e095; Linux x64 droplet Node24.21.0 Neovim0.12.5, isolated chromium_headless_shell-1248 Chrome156.0.8078.4. T0/T1/all-T2 fallback/Web complete; mapped T4 inbox-verifier-load base execution passed, repetitions skipped; remaining T3 deferred to merge batch, no full T3/T4 claim. Aggregate4585pass,0fail/cancel/skip/todo. Independently checked completion outcomes for named users-own-stored-messages/history/coordinator/legacy case1/1, unedited human-routing6/6 and Store29/29, all pass; source-reviewed assertions establish C1–C6 including flushed content-free journal. Budgets/lint/ratchets report-only. QA after-stage. No Reviewer tests/browser. No findings on either axis.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-37 · 2026-11-01T21:17:31.810Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1561-delta-1
commit: c353a539554305f401261d5f2bbb369aecaef1cc
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, Standards/Spec no findings. Authorized merge parents d889d401/9980aea79 checked; SKILL resolution preserves both attribution and authority guidance. Runtime auto-merge retains T-1561 identity propagation and imports T-1570 durable-role admission before web replay/actor resolution. Fresh mode-free verification REQUIRED: first-parent delta includes dispatch/web-authority runtime and tests, so Coordinator's docs-only waiver condition is not satisfied. A-15392 covers prior head only; A-15412 targeted merged-tree macOS Node24.21.0 typecheck/message-users1/human-routing6/Store29 are supplemental, not full tiers. C5 source reverified; C1–C4/C6 pending exact-head run evidence. No Reviewer execution/browser.

Criteria: C5 verified.

### rev-37 · 2026-11-01T21:33:58.048Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1561-evidence-2
commit: c353a539554305f401261d5f2bbb369aecaef1cc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear, no Standards/Spec findings. A-15418 run453b74cd Finished exit0, noncached exact head/treeb992dae43857d1d868d2b9c02db3253c40030b9c. Linux x64 droplet Node24.21.0 Neovim0.12.5, isolated chromium_headless_shell-1248 Chrome156.0.8078.4. T0/T1/all-T2 fallback/Web completed; mapped T4 inbox-verifier-load base-only, repetitions skipped; remaining T3 deferred, no full T3/T4 claim. Aggregate4586pass,0fail/cancel/skip/todo. Independently checked named completion outcomes: message-users1, human-routing6, Store29, imported auth-mode7 and web-authority-unit6 all pass. Combined with clear delta/source-reviewed assertions this establishes C1–C6 at merged head. Budget/lint/ratchets report-only; QA after-stage. No Reviewer execution/browser.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
