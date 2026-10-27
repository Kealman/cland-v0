---
id: T-1357
kind: task
title: Codex and OpenCode approvals arrive as cards with coloured choices, answered with `via` and shown as approved via Telegram
state: closed
status: done
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
updated: 2026-10-27T13:47:06.305Z
closed: 2026-10-27T13:47:06.305Z
---

## Summary

A Codex or OpenCode approval answered in the hub becomes a card. The card names the session, the harness and the command or the files, truncated with "full command in the workbench", and offers the harness's choices as coloured buttons. A tap answers through `approval.answer` with `via = "telegram"`, the card turns into its outcome, and both inboxes show the approval as answered via Telegram.

## What to build

The card model gains approvals with `answerIn = "hub"`. The text is "<session> asks to run" plus the harness, then the command (or the files of a change) truncated to a safe length that keeps the card inside 4096 code points and 100 entities, then "full command in the workbench" when cut. One row per choice the record offers, labelled "Approve once", "Always allow" and "Deny", styled success, primary and danger. There is no second confirmation for a dangerous command.

A press goes through `approval.answer` with the choice, and the hub stores it before the press is answered. The outcome edit shows the choice, who, where and when. An approval closed elsewhere, withdrawn by its harness or answered in the harness edits every copy the same way as ticket 03. Spec §3.5 and §3.1; v0.2 §3.4 and §3.8; fake harnesses in `hub/test/fakes/` (scripted Codex and OpenCode).

## Acceptance criteria

- [x] C1. A fake Codex approval for a 5000-character command arrives as a card naming the session and "codex", with the command truncated, "full command in the workbench" and three styled buttons one per row (test).
  - done: impl-1357 · 2026-10-27T11:46:40.940Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-final1 · 2026-10-27T12:36:05.069Z · commit c56107d1a7c36e1eead4fa30ecddb88697c646fe
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-source4-waiver · 2026-10-27T13:37:41.013Z · commit 12d65628ef2602db3679a66e7cb838cce01261fe
- [x] C2. "Approve once" on a fake Codex approval's card lets the fake command run, the outcome records `via = "telegram"`, and the card is edited to the outcome without buttons (test).
  - done: impl-1357 · 2026-10-27T11:46:41.127Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-final1 · 2026-10-27T12:36:05.069Z · commit c56107d1a7c36e1eead4fa30ecddb88697c646fe
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-source4-waiver · 2026-10-27T13:37:41.013Z · commit 12d65628ef2602db3679a66e7cb838cce01261fe
- [x] C3. "Deny" on a fake OpenCode approval's card stops its command, and an approval answered in the web edits its card to "via web" (test).
  - done: impl-1357 · 2026-10-27T11:46:41.377Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-final1 · 2026-10-27T12:36:05.069Z · commit c56107d1a7c36e1eead4fa30ecddb88697c646fe
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-source4-waiver · 2026-10-27T13:37:41.013Z · commit 12d65628ef2602db3679a66e7cb838cce01261fe
- [x] C4. Headless Neovim and headless Chromium show both answered approvals as answered "via Telegram" in their inboxes (test).
  - done: impl-1357 · 2026-10-27T11:46:41.585Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-final1 · 2026-10-27T12:36:05.069Z · commit c56107d1a7c36e1eead4fa30ecddb88697c646fe
  - verified: rev-34 [reviewer] · run rev-34-20261027-1357-source4-waiver · 2026-10-27T13:37:41.013Z · commit 12d65628ef2602db3679a66e7cb838cce01261fe

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

### impl-1357 · 2026-10-27T12:34:30.611Z

Original Coordinator-owned Linux full run 193644be-4225-4e3d-b5f3-c762baca6807 is green at c56107d1a: T0/host, T1, T2, T3, Web completed; 5091 tests, 5083 pass, 0 failures/cancellations, 8 exclusions (6 macOS-only, 2 real-OpenCode installation). All C1–C4 exact named receipts executed and passed, including native OpenCode 2.466390 s and both headless outcomes; no >=3 s new-case allowance needed per Coordinator. T4/live-phone not claimed; lint/duration/ratchet remain report-only. Final evidence review requested from Reviewer, assigned rev-34. Original log A-12769 and inspection note A-12770 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12770-t-1357-final-original-linux-evidence-at-c56107d1a.md). Head held; fresh origin/dev d861bedf conflict check exit 0, repeat after final verdict before ready.

### rev-34 · 2026-10-27T12:36:05.069Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261027-1357-final1
commit: c56107d1a7c36e1eead4fa30ecddb88697c646fe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence CLEAR; C1–C4 verified. A-12771 audits original Coordinatorfull/all193644be/A-12769 against source2/A-12747: branch/hub/header c56107d1 match, original execution exit0. Independent generated finishes5083ordinarypass/8skip/0fail/cancel/todo across682files; no load repetitions. All11approval cases/native producer/headless source consumers pass; exact names/lines/timings in A-12771. Source assertions independently checked:5000-char safe styled card, scripted Codex command effect+commit before callback, scripted OpenCode denial+Web answer/edit, both approval outcomes rendered viaTelegram in headless Web/recorded-frame Neovim. Setup omission/abort and lost-result/closure/isolation controls pass. HostT0/LinuxT1/T2/T3/Web complete; T4 unrun and eight unrelated skips excluded. Linuxc-8lon1 kernel6.8.0-142-generic Node24.21/Neovim0.12.5 CHS156.0.8078.4/v1248, isolated browser; hostgate82cc511c reused, not remote typecheck. Newnative2.466389984s/Web2.541090363s<3s, no allowance per223fd314. Budget/lint/ratchet report-only warnings retained; no live-phone/installed-provider/QA claim. No Reviewer executions/edits. Lead fresh dev conflict check afterT-1355landing before ready perCoordinator; receipt applies only reviewed head, Coordinator enqueue/landing separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1357 · 2026-10-27T12:41:24.612Z

After Coordinator-authorized landed-dev merge (4fee2cb2/43b6ec12), pushed 3bf8db785f0806a048457b28f10647ca0226aaf2, tree 8c98d36ac7a05e832e035bc4568ff89161fdf6d2, parents c56107d1a + c07b4bd0. One import conflict in telegram-cards retained approvals and TelegramPrompts; auxiliary prompt guard explicitly narrows ask/kind. No assertion/test changed. Delta source review requested/assigned rev-34. Merged-head macOS serial 35 files/339 passes, 0 skips/failures; typecheck/build/full test:lint 0 refusals/tier lint/diff checks pass. Evidence A-12776 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12776-t-1357-post-t-1355-merge-and-local-delta-evidence-at-3bf8db785.md). Prior full c561 run is not a current-head pass. Coordinator will submit a new rule-6 verify all after delta source clear.

### rev-34 · 2026-10-27T12:42:53.975Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261027-1357-source3
commit: 3bf8db785f0806a048457b28f10647ca0226aaf2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Post-T-1355 merge delta CLEAR at3bf8db78/tree8c98d36a. A-12778: Standards0/Spec0 delta findings. Coordinator4fee2cb2/43b6ec12 authorized landed-dev integration. Import/manual guard resolution keeps approval.choice vs ask.option vs ask.kind routing, issued-key/card/chat checks, native approval pending receipt/terminal acknowledgement and prompt publication. Telegram constructor/result/handler ordering wires one inbound feedback owner with prompt stored callback while approval requests keep distinct ids; messenger-scoped answer recovery and endpoint redaction coexist. Independently compared prior approval/outbox/redactor/state/native/headless tests byte-identical and incoming prompts/inbound/ask tests equal landed dev; no assertion weakening. Frozen REMOTE_USAGE equals source; docs/skill CHANGES retain both features. A-12776 local339pass summary is macOS targeted evidence, not new Linux/full proof. No Reviewer executions/edits. C1–C4 runtime marks remain stale pending new exact-head Coordinator verify all. Lead reportready/fresh conflict check perauthorization; no extra mode-free task run. Old193644be/A-12769 remains parentc56107d1-only evidence.

### impl-1357 · 2026-10-27T12:43:13.598Z

Delta source3 clear at 3bf8db785f0806a048457b28f10647ca0226aaf2 / tree 8c98d36ac7a05e832e035bc4568ff89161fdf6d2, A-12778. Fresh origin/dev fetch c07b4bd0d835c3cd6f8dc6f9d9d616d4c1bd4d08; merge-tree --write-tree exit 0/result equals reviewed tree, no head change, clean/pushed. Reported ready for Coordinator's new rule-6 verify all. All current-head local 35-file/339-test and lint evidence in A-12776. Prior-parent runtime verdicts are not current-head coverage; C1–C4 await original full result at this merge head.

### impl-1357 · 2026-10-27T13:24:13.986Z

Waiver-path merge pushed at 12d65628ef2602db3679a66e7cb838cce01261fe / tree 34721be355261aeb1a5f7d3725e0491945b8d1ec, parents 3bf8db785 + a4acbcf0 (T-1358 landed b14ede7a), authorized 906067d7/92fffadc. Full base c35b5656/A-12790 green at parent only. README keeps both sections; RemoteCard retains approval action/style/truncated plus notice link/preview; inbox receive publishes both; approval sends/edits use shared composed renderer. Approval truncation marker precedence and clipping semantics preserved. A-12791 records exact domain identifier/text search, all 79 direct executable matches and six helper matches; five helper-owner tests plus two Web consumers added, 86 files running serially. Initial 11 approval/13 notice cases, typecheck/build/full test:lint (0 refusals)/tier lint pass. No change beyond composition intended; no current-head full suite claim.

### impl-1357 · 2026-10-27T13:30:25.530Z

Requested delta + authorized waiver-evidence review at 12d65628ef2602db3679a66e7cb838cce01261fe (tree 34721be355261aeb1a5f7d3725e0491945b8d1ec), assigned rev-34. All 87 selected files / 983 tests passed serially, 0 failure/skip/cancel. A-12791 exact search inventory plus helper mappings; A-12792 per-file recorded counters at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12792-t-1357-87-file-waiver-receipts-at-12d65628e.md. Non-TS matches inspected: duration/CLI fixture manifests and named Neovim recordings, with owner checks included. Full test:lint (0 refusals, findings report-only), tier lint, typecheck/build/diff checks pass. Original parent full c35b5656/A-12790 green is prior-head evidence only; waiver authorized by Coordinator 906067d7/92fffadc. No behaviour beyond composing approval/notices intended; no assertion changed.

### impl-1357 · 2026-10-27T13:32:53.237Z

Reviewer requested original current-head named-case receipts for waiver audit. Published A-12793 (captured approval/notices/native OpenCode/Web+Neovim case outputs/timings) and A-12794 (original 87-file node exit/signal/counter JSON), no rerun or reconstruction. A-12793 explicitly labels missing separate success exports for native decision objects/scratch effects/SQLite offsets/nested process exits; those were asserted in cases and fixtures disposed. Head remains 12d65628e.

### rev-34 · 2026-10-27T13:37:41.013Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261027-1357-source4-waiver
commit: 12d65628ef2602db3679a66e7cb838cce01261fe
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Clear Standards and Spec delta review; no findings. C1–C4 verified at 12d65628e through source composition and current-head original targeted outcomes under Coordinator waiver 906067d7/92fffadc. A-12795 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12795-t-1357-merged-head-delta-and-authorized-waiver-audit-at-12d65628e.md) records the audit. Independent search reproduced all 79 direct executable consumer matches; original A-12794 confirms all 87 selected files code 0/signal null and 983 passes, zero failures/cancellations/skips. A-12793 confirms named C1–C4/native/notice outcomes on local darwin arm64 Node24.21, headless Neovim and isolated Chrome Headless Shell156.0.8078.4/build1248. Success objects/SQLite/effect/nested PID receipts were asserted in unchanged tests but not separately exported; disposed fixtures were not reconstructed. Current-head evidence is targeted, without new load repetitions or a new full run. Parent Linux full c35b5656/A-12790 remains at 3bf8db785: 5099 ordinary passes/eight skips, hostT0/LinuxT1/T2/T3/Web complete, noT4; remote host-gate tree reuse explicitly not repeated typecheck. Parent proof is the waived baseline, not a merged-head full pass. Budgets/lint/ratchet report-only. Merge preserves approval authority, outcome persistence/ack order, bounded shared renderer and owning strict help fixture; no change beyond authorized approvals/notices composition. Mixed-kind ordering remains T-1359. Coordinator owns enqueue under the explicit no-second-full waiver.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-27T13:37:50.162Z

Rule 6 waiver (coord, 2026-10-27 13:38Z). The landed head 12d65628 is a conflict merge of 3bf8db78 with T-1358 (b14ede7a). Its full-suite base is c35b5656 / A-12790: green at 3bf8db78, 5107 tests, T1, T2, T3 and Web complete. The merge resolution only combines approval cards with notices, and its waiver evidence is complete: A-12791 holds the search inventory, and A-12792 shows 87 matched files run serially with 983 passes and 0 failures, plus test:lint, the tier lint, typecheck and build. The delta and evidence review is clear. No second `verify all` was run at 12d65628. The next integrated cover (the E-1310 stage 2 and E-1313 stage 1 pair) covers the merged tree.

### impl-1357 · 2026-10-27T13:38:19.873Z

Ready report sent for enqueue at unchanged 12d65628ef2602db3679a66e7cb838cce01261fe / tree 34721be355261aeb1a5f7d3725e0491945b8d1ec. Delta/waiver review rev-34-20261027-1357-source4-waiver clear, C1–C4 verified, A-12795. Fresh origin/dev a4acbcf076d67b11d5a92e3f50464beba567eccc; merge-tree exit 0/result equals reviewed tree; clean/pushed. Coordinator waiver 906067d7/92fffadc/6a8ccde8 accepts parent Linux full A-12790 plus current-head 87 files/983 targeted passes and lint/original receipt audit; no current-head full pass claimed. Coordinator owns enqueue, waiver record and landing. Claim retained.

### coord · 2026-10-27T13:47:06.305Z

Merged 9fd28437fb2b60a06ea206a8bbf8d958badc9002 onto dev.
