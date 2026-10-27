---
id: T-1357
kind: task
title: Codex and OpenCode approvals arrive as cards with coloured choices, answered with `via` and shown as approved via Telegram
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1354
topic: topic-1113
branch: t/T-1357-codex-and-opencode-approvals-arrive-as
created: 2026-10-27T05:43:01.767Z
updated: 2026-10-27T11:55:04.398Z
---

## Summary

A Codex or OpenCode approval answered in the hub becomes a card. The card names the session, the harness and the command or the files, truncated with "full command in the workbench", and offers the harness's choices as coloured buttons. A tap answers through `approval.answer` with `via = "telegram"`, the card turns into its outcome, and both inboxes show the approval as answered via Telegram.

## What to build

The card model gains approvals with `answerIn = "hub"`. The text is "<session> asks to run" plus the harness, then the command (or the files of a change) truncated to a safe length that keeps the card inside 4096 code points and 100 entities, then "full command in the workbench" when cut. One row per choice the record offers, labelled "Approve once", "Always allow" and "Deny", styled success, primary and danger. There is no second confirmation for a dangerous command.

A press goes through `approval.answer` with the choice, and the hub stores it before the press is answered. The outcome edit shows the choice, who, where and when. An approval closed elsewhere, withdrawn by its harness or answered in the harness edits every copy the same way as ticket 03. Spec §3.5 and §3.1; v0.2 §3.4 and §3.8; fake harnesses in `hub/test/fakes/` (scripted Codex and OpenCode).

## Acceptance criteria

- [x] C1. A fake Codex approval for a 5000-character command arrives as a card naming the session and "codex", with the command truncated, "full command in the workbench" and three styled buttons one per row (test).
  - done: impl-1357 · 2026-10-27T11:46:40.940Z
- [x] C2. "Approve once" on a fake Codex approval's card lets the fake command run, the outcome records `via = "telegram"`, and the card is edited to the outcome without buttons (test).
  - done: impl-1357 · 2026-10-27T11:46:41.127Z
- [x] C3. "Deny" on a fake OpenCode approval's card stops its command, and an approval answered in the web edits its card to "via web" (test).
  - done: impl-1357 · 2026-10-27T11:46:41.377Z
- [x] C4. Headless Neovim and headless Chromium show both answered approvals as answered "via Telegram" in their inboxes (test).
  - done: impl-1357 · 2026-10-27T11:46:41.585Z

## Comments

### impl-1357 · 2026-10-27T11:30:16.632Z

Rule 20 consumer inventory before changing card/admission contracts: remote/cards.ts and telegram-cards.ts consume the shared card model/actions; telegram.ts owns frame routing and open-source callbacks; telegram-outbox.ts persists sends and source-closed admission; remote/state.ts reads persisted message maps (already has nullable approval); telegram-inbound.ts reads mapped asks/topics (approval replies must not become ask answers). Existing persisted ask models/buttons remain readable unchanged. Searches covered production, shared/wire, hub/test including T3 approval-restart/telegram-polling-restart and T4 tier inventory, web/nvim clients and recordings, .agents skills, docs/agents, startup/frame probes and qa/briefs. ApprovalRecord/Outcome, approval.answer schema/refusals, dispatcher/authority, adapter relays, inbox/CLI, Web ApprovalCard and Neovim inbox keep their current wire shapes and policy. Their consumers are approval-records/restart, gateway, codex/opencode native/adapter, pairing-codes, web-authority and wire-conformance tests; Web inbox/phone-approvals/session-drawer/remote-via; Neovim inbox-actions/remote-via, stub and committed frames; QA E-414/E-417/E-418/E-419/E-420 briefs. These are unaffected by the additive internal card variant. Legacy gateway/client regressions stay. Telegram outbox gains an optional approval-open callback alongside existing askOpen, preserving old callers; approval maps get a new query alongside messagesForAsk. Docs/skill updates will describe the new approval card and the same native gateway authority.

### impl-1357 · 2026-10-27T11:35:50.642Z

Native production-path blocker confirmed (macOS, local targeted opencode-adapter.test.ts): `a natively launched OpenCode session keeps the gateway serving across its process endpoint frame` failed with actual remote-disabled `{ remote: 'test', reason: 'remote output would alter protocol routing' }`. session.launch used the production OpenCode adapter, fake native HTTP/SSE executable and real spoke; the local session.process frame carried harnessId matching `http://127.0.0.1:<port>`. No test-created process projection supplied that endpoint. C3 is blocked by the same refusal. Per Coordinator direction, fixing in this item. Rule 20 redaction inventory: gateway.ts is the only production redactFrame consumer (inbound requests, outbound frames, pairing identities, diagnostics); remoteRedactor consumers also include daemon secret registry, telegram-api diagnostics, doctor/remotes, fake Telegram, secrets fixtures. Tests: remote/redact.test.ts, gateway.test.ts, gateway-secrets.test.ts, remote-cli, secrets-validation, and native opencode-adapter T3. Docs: docs/agents/secrets.md, gateway-secrets test guide, hub README, implement skill. No web/nvim/QA direct redactor consumer and no T4 direct redactor import (repo-wide rg). Preserve inbound identifier refusal; only hub-owned outgoing harness endpoint/attach display metadata may be masked rather than interpreted as a routing change. Existing output schema keys stay unchanged and secret masking remains mandatory.

### impl-1357 · 2026-10-27T11:47:39.012Z

Committed/pushed 19f764d4cea30b661b1584d7f4e05c54d49e54a2, tree 176da02b41ed6ef78c0fcd73ad014b3f515095da. All C1–C4 done; source review requested in topic-1113. Evidence artifact A-12741 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12741-t-1357-implementation-and-local-evidence-at-19f764d4c.md. Local serial selection: 34 files / 322 passing tests, no skips/failures, darwin arm64 Node v24.21.0, isolated Chrome Headless Shell 156.0.8078.4 (r1248), Playwright 1.64.1; headless Neovim recording and consumer pass. Build/typecheck/tier/test-lint/static checks passed; test lint findings are report-only, refusal count 0. New native endpoint case measured 1.901 s on macOS, Linux not measured. Doctor local remote.status and remote.state's safe projection carry no harness endpoint. Latest Coordinator instruction replaces mode-free verify with Coordinator-owned verify all after source clear/ready. No full-suite, Linux or live-phone pass claimed.

### rev-26 · 2026-10-27T11:52:41.403Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1357-source-1
commit: 19f764d4cea30b661b1584d7f4e05c54d49e54a2
scope: full
findings: [{"severity":"medium","text":"M1 Standards: initial-poll setup awaits an unbounded promise. Bound and cancel this prearmed setup observer independently under the registered owner; add omitted/aborted initial-poll controls through that same disposer, joining startup/remote work before storage and root removal while retaining all native approval assertions.","file":"hub/test/telegram-approvals.test.ts","line":35}]
finding_counts: {"high":0,"medium":1,"low":0}

Full consolidated source review: Standards M1 medium; Spec no additional findings. A-12744 records exact commit/tree/base, coverage and limits. C1–C4 claimant done only, runtime verification pending. A-12741 is local macOS targeted evidence, not configured/Linux proof. Correct the fixture, push and request fresh source review. Coordinator-owned verify all replaces mode-free item verification after source clearance/ready per decision 25c9bfff.

### impl-1357 · 2026-10-27T11:53:54.503Z

Source-1 M1 fixed and pushed at c56107d1a7c36e1eead4fa30ecddb88697c646fe (tree e6175b387323774cec04e87398d6ac2117e945b8), source-2 requested from Reviewer. A-12746 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12746-t-1357-source-2-m1-startup-receipt-correction-at-c56107d1a.md) records owned bounded initial poll, same-disposer omitted/aborted setup proofs, and a failing bypass negative control. Existing native approval/command/outcome assertions unchanged. Corrected tree: 11/11 approval cases plus typecheck/tier/closed-item wording/diff checks pass locally (macOS arm64). Other 33 selected files retain prior-head evidence, not a fresh whole-selection run. No dev merge after source-1 and no mode-free/full suite submitted; Coordinator-owned verify all follows source clear/ready.

### rev-26 · 2026-10-27T11:54:39.858Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1357-source-2
commit: c56107d1a7c36e1eead4fa30ecddb88697c646fe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear: Standards 0, Spec 0. A-12747 incorporates source-1 and both correction files. M1 resolved through prearmed abortable initial-poll receipt passed into pacingOwner.start's separate setup bound; omitted/aborted controls use the same registered drain owner and preserve SQLite/root until native-close ownership joins. Production and original approval/native command/callback/client assertions unchanged. A-12746 has 11 corrected-head local macOS cases; A-12741's other 33 files remain prior-head evidence, not a combined same-head run. C1–C4 runtime marks pending. Per 25c9bfff, Coordinator-owned verify all after ready replaces mode-free item run.

### impl-1357 · 2026-10-27T11:55:04.398Z

Reported ready for Coordinator-owned verify all after Reviewer source-2 clear (A-12747) at unchanged c56107d1a7c36e1eead4fa30ecddb88697c646fe, tree e6175b387323774cec04e87398d6ac2117e945b8. Fresh origin/dev fetch 1748b9c0 and merge-tree --write-tree conflict check exit 0, result equals reviewed tree; clean/pushed branch, no post-review merge. Runtime criterion marks await original full verification; no mode-free run submitted per Coordinator 25c9bfff. Claim retained through landing.
