---
id: T-1355
kind: task
title: '"Other answer…" and "Decline…" open a ForceReply prompt; the next text answers, `/cancel` keeps the ask open, and a typed reply to the card answers it'
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
topic: topic-1112
branch: t/T-1355-other-answer-and-decline-open-a
created: 2026-10-27T05:43:01.372Z
updated: 2026-10-27T12:36:49.086Z
closed: 2026-10-27T12:36:49.086Z
---

## Summary

"Other answer…" and "Decline…" each send a separate prompt with the reply field open. The next text, or a reply to the prompt, answers the ask as a free answer or as a decline with that reason. `/cancel` keeps the ask open, and a typed reply to the card itself answers it too.

## What to build

A press on "Other answer…" or "Decline…" answers the press. It then sends a prompt replying to the card ("Your answer to: …" or "Why decline: …", with "/cancel keeps the ask open"). The prompt carries ForceReply and a placeholder, and is mapped to its ask and mode. The card itself never carries ForceReply, because a message that ever did can never be edited.

While a prompt waits, the human's next ordinary text in the chat answers through `topic.answer`, as a free `text` or as `declined` with that `reason`. A reply to the prompt does the same even after other text. That text does not go to General. `/cancel` clears the waiting prompt, replies "Cancelled. The ask stays open." and leaves the ask open. This replaces the placeholder in `telegram-commands.ts`.

A typed reply to the card answers it as a free answer when the ask takes one. When it does not, the reply counts only as an option's number; anything else gets a one-line note and leaves the ask open. A prompt whose ask closed meanwhile says so, and the text goes nowhere. The wait for a prompt is stored in the remote tables, so it survives a restart. Spec §3.5 and §3.10; builds on the inbound's reply mapping (T-1344).

## Acceptance criteria

- [x] C1. "Other answer…" sends a ForceReply prompt as a reply to the card, the card's own markup never contains `force_reply`, and the next text answers the ask with that text "via Telegram" and is not posted to General (test).
  - verified: rev-26 [reviewer] · run rev-20261027-1355-evidence-1 · 2026-10-27T12:10:59.048Z · commit 15163682902961a3750a741a6306c1da1e410eae
  - done: impl-1355 · 2026-10-27T12:29:58.481Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1355-final2 · 2026-10-27T12:30:43.579Z · commit 67cf3ee0f8bf4411993bcec2a4fe68437a5ed6b7
- [x] C2. "Decline…" followed by a reply to its prompt records `declined` with that reason, and the card's outcome shows the reason (test).
  - verified: rev-26 [reviewer] · run rev-20261027-1355-evidence-1 · 2026-10-27T12:10:59.048Z · commit 15163682902961a3750a741a6306c1da1e410eae
  - done: impl-1355 · 2026-10-27T12:29:58.662Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1355-final2 · 2026-10-27T12:30:43.579Z · commit 67cf3ee0f8bf4411993bcec2a4fe68437a5ed6b7
- [x] C3. "Decline…" followed by `/cancel` leaves the ask open, its card keeps its buttons, and the next text goes to General as a message (test).
  - verified: rev-26 [reviewer] · run rev-20261027-1355-evidence-1 · 2026-10-27T12:10:59.048Z · commit 15163682902961a3750a741a6306c1da1e410eae
  - done: impl-1355 · 2026-10-27T12:29:59.041Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1355-final2 · 2026-10-27T12:30:43.579Z · commit 67cf3ee0f8bf4411993bcec2a4fe68437a5ed6b7
- [x] C4. A typed reply to a free-answer card answers it, and a non-number reply to an options-only card gets a note and leaves the ask open (test).
  - verified: rev-26 [reviewer] · run rev-20261027-1355-evidence-1 · 2026-10-27T12:10:59.048Z · commit 15163682902961a3750a741a6306c1da1e410eae
  - done: impl-1355 · 2026-10-27T12:29:59.205Z
  - verified: rev-34 [reviewer] · run rev-34-20261027-1355-final2 · 2026-10-27T12:30:43.579Z · commit 67cf3ee0f8bf4411993bcec2a4fe68437a5ed6b7

## Comments

### impl-1355 · 2026-10-27T11:30:09.160Z

Consumer inventory before implementation (rule 20): Telegram native routing contract only; no wire/schema, permissions or existing remote_messages columns change. Production: telegram.ts handler ordering/request results, telegram-cards.ts buttons/outcomes, telegram-inbound.ts ordinary messages and reply mapping, telegram-commands.ts /cancel/help, telegram-outbox.ts durable send/map/four failure classes, state.ts remote_state + remote_messages readers, gateway.ts ingress id and dispatch.ts gateway.answer dedupe. New prompt records will use additive remote_state keys; prompts map with ask=null so messagesForAsk/outcome edits never touch ForceReply. Existing clients (web/Neovim/CLI), shared cards renderer and prior wire shapes remain unchanged. Tests searched across all tiers: telegram-{cards,commands,inbound,api,polling,polling-restart,catchup,gap,mute,pairing,messenger,liveness,pacing,render,rendering}, outbox{,-gateway}, gateway, asks, inbox, remote-state, CLI usage golden; Web/Neovim remote-via consumers unaffected (unchanged outcome). Fake API already models ForceReply, replies, callbacks and fixed errors. Shipped docs/skills consumers: hub/README.md Telegram cards/inbound/commands, docs/agents/pairing.md, per-file cards/commands guides, implement skill + CHANGES, cli/usage.ts + usage golden. QA briefs/startup probes: search found no prompt-specific consumer; public frame replies stay unchanged. Migrate placeholder claims/assertions; preserve old client regressions. Agreed seam: sealed projectHub frame clients + real TelegramRemote + loopback fake API (epic constraints).

### impl-1355 · 2026-10-27T11:45:12.808Z

Source-review M1/M2 consumer extension before fixes: M1 covers native prompt-send loss, callback/offset progress, unknown-send fence and unmapped explicit replies (TelegramCards/TelegramPrompts/outbox/poller/inbound; no quoted-text authority). M2 extends the native recovery-port reader: Gateway RemoteReceipt -> dispatcher gateway-only messageReceipt -> current Store message. The reader must resolve additive existing gateway.answer:<native-id> records, whose saved value.message.id differs from ingress id, then read current stage. Consumers searched: gateway.ts start callback; TelegramInbound.recover (ordinary messages and newly confirmed ask answers); dispatch.ts gateway-only conversation projection; native gateway.test.ts receipt and previous-client/no-wire-action controls; telegram-inbound/card restart tests. Native port signature, protocol, persisted answer receipt shape and wire authority remain unchanged. Docs README/agent guide/implement skill/per-file guides migrate the recovery claim. Consolidated review is pending; no replacement review or verification submitted.

### rev-26 · 2026-10-27T11:45:32.580Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1355-source-1
commit: d20a23f40d83887145806e7d5d093f3b98a1c97e
scope: full
findings: [{"severity":"high","text":"M1 Spec: uncertain accepted ForceReply send is awaited before callback confirmation; every replay waits on its permanent unknown-send fence, blocking subsequent input/cancel. Preserve fencing while allowing durable-intent cursor progression and safe unmapped-prompt replies, with native accept-disconnect/restart controls.","file":"hub/src/remote/telegram-cards.ts","line":71},{"severity":"medium","text":"M2 Spec/shared consumer: feedback recovery resolves only store.message(native inputId), whereas topic.answer stores gateway.answer:<inputId> with a different message id. Confirmed typed-answer feedback cannot recover after restart; resolve its current durable answer/stage and add owed-feedback recovery beyond input confirmation.","file":"hub/src/remote/telegram-inbound.ts","line":32}]
finding_counts: {"high":1,"medium":1,"low":0}

Consolidated full source audit A-12739. Standards no independent finding; Spec M1/M2. Preliminary M1 General-fallback description refined after full poll trace: immediate failure is cursor head-of-line blocking, missing-map routing is secondary once progress is restored. Local A-12737 targeted summary is not configured proof. Keep every happy-path criterion assertion and add recovery controls, then request fresh pushed-head review before verification.

Criteria: C1 failed (An uncertain accepted prompt send blocks callback confirmation and later answer input; source progress gap needs native regression and correction.).

### rev-26 · 2026-10-27T11:53:40.535Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1355-source-2
commit: c92f5d67727891ead8b46dcf0c6f1079fe1be4e6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review clear: Standards 0, Spec 0. A-12745 consolidates original audit plus all 11 correction files. M1 preserves the uncertain-send fence while permitting callback/later-input progress and consuming unverified explicit replies safely. M2 resolves messenger-scoped native-answer receipts to current stored message/stage, retaining direct lookup and wire refusal. Requested native controls and original C1–C4 assertions are present. A-12743 local macOS targeted evidence is separate from configured/Linux proof. Runtime criterion verification remains pending unchanged-head mode-free configured run and original-record evidence review; Coordinator integrated cover/landing separate.

### rev-26 · 2026-10-27T11:55:01.847Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1355-admission-1
commit: c92f5d67727891ead8b46dcf0c6f1079fe1be4e6
scope: full
findings: [{"severity":"medium","text":"M3 Standards: the renamed cards test still has its obsolete duration baseline identity ending 'and keeps auxiliary actions unavailable', so verify-tiers refuses before execution. Migrate the owned key with its measured value and audit remaining owned identity/manifest/lint consumers before fresh source review.","file":"hub/test/durations.json","line":7847}]
finding_counts: {"high":0,"medium":1,"low":0}

Preflight-only admission failure, no configured runtime execution or platform result. A-12749 records the stale key/value and source correction needed. I missed this consumer in source-2. M1/M2 product corrections remain resolved; C1–C4 runtime marks remain pending. Push the correction, request fresh reviewed head, then retry configured verification.

### impl-1355 · 2026-10-27T11:55:38.342Z

M3 admission consumer correction: verify submission at c92f5d677 was refused before execution; no failed runtime suite or Linux evidence exists. Rename only durations.json tests key from 'Telegram refuses unissued and cross-ask button data and keeps auxiliary actions unavailable' to the current 'Telegram refuses unissued and cross-ask button data', preserving baseline 0.191438. Inspected every owned gateway/cards/commands test and file baseline, allowance section (no owned allowance keys), T2 tier assignments, quarantine manifest, suite-test-identities parser and shard-planning/lint inputs. No file test count, measured time, allowance value/reason or tier is invented/changed. Coordinator explicitly approved moving this stage-1 identity and requested test:lint plus tier lint in one local pass before fresh review/retry.

### rev-26 · 2026-10-27T11:56:54.959Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1355-source-3
commit: 15163682902961a3750a741a6306c1da1e410eae
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-12753 incorporating A-12745 and admission M3. Exact one-key durations.json rename matches current test identity; 0.191438 measurement preserved, no other changes. M1/M2 source corrections remain resolved. A-12751 reports local sequential lint/tier guard exit 0 with report-only findings; no executed suite/Linux proof. Prior submission remains preflight refusal. C1–C4 runtime marks pending unchanged-head mode-free configured run and original evidence review. Coordinator integrated cover/landing separate.

### rev-26 · 2026-10-27T12:10:59.048Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1355-evidence-1
commit: 15163682902961a3750a741a6306c1da1e410eae
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C4 verified. Original run 908b0520/A-12759 exit 0 matches source-3 head. Independently deduplicated 3691 ordinary passes + 65 separate actual load passes (13 new generated identities ×5), none failed/skipped/cancelled. Named ForceReply/decline/cancel/free/options, unknown-send/cursor safety, confirmed-input owed-feedback and gateway isolation controls all base+5/5. Maximum new base .247910216 s/load .575466094 s; no Linux allowance needed. T0/all T1/fallback all T2/Web complete; T3/T4 unrun and Web new-file repetitions0. Linux c-8 lon1, pinned HS156.0.8078.4/v1248; host typecheck reused, not remote. Budget/lint/ratchet report-only warnings retained. A-12760 records exact original identities/timings, provenance, preflight-only refusal and coverage limits. QA none; Coordinator integrated cover/enqueue/landing separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-34 · 2026-10-27T12:15:28.272Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261027-1355-source4
commit: 67cf3ee0f8bf4411993bcec2a4fe68437a5ed6b7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Conflict-driven merge delta CLEAR at67cf3ee0/tree1bde7706. A-12762 records Standards0/Spec0 delta findings. Coordinatora72d07a9 authorization confirmed; sole rev-34 hold for this new direct request. Combined parent/source comparisons preserve both prompt/cancel guidance and incoming Neovim+web safe-state wording. Decoded REMOTE_USAGE equals golden; only that fixture key differs from either parent, and source usage differs from incoming dev only in that literal. T-1355 runtime/test bodies unchanged; incoming Web/harness/test/manifest files match landed dev; docs/skill CHANGES retain both behaviors. Prior rev-26 source3/A-12753 and evidence1/A-12760 are historical context. C1–C4 current runtime verification remains pending; prior151636829/A-12759 marks are stale at changed head. A-12761 reports 192 selected local macOS passes and static gates, no merged-head Linux/full/Web claim. No Reviewer executions/edits. Per Coordinator, submit one mode-free configured verify at unchanged67cf3ee0 then request original-record final evidence audit; integrated cover/enqueue separate.

### rev-34 · 2026-10-27T12:30:43.579Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261027-1355-final2
commit: 67cf3ee0f8bf4411993bcec2a4fe68437a5ed6b7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-merged-head evidence CLEAR; C1–C4 verified. A-12768 audits original3cb6819e/A-12767 against source4/A-12762: branch tip, hub verify and log head67cf3ee0 agree. Independently deduplicated3694ordinary passes plus65 separate actual load passes (13new identities×5);0fail/cancel/skip/todo. Each exact criterion/restart/unknown-send/cursor/owed-feedback/gateway-isolation identity passes ordinary1+load5/5. Read source assertions for separate immutable ForceReply/card mapping, declined reason/outcome, cancel/open/buttons/ordinaryGeneral, free/options-only routing and M1/M2 durable boundaries. Maxnewbase0.235244792s/load0.572999464s, no >=3s allowance. T0/allT1/fallbackallT2hub+Neovim/Web complete; T3/T4 unrun, Web0newfiles/0reps. Linuxc-8lon1 x64 kernel6.8.0-142-generic Node24.21/Neovim0.12.5 CHS156.0.8078.4/v1248 isolated browser; workers2/Web4. Hostgate8c07095e reused, not repeated remote typecheck. Budget/lint/ratchet report-only and inherited missing Web baseline retained; lifetime733s/$0.0509 accounting, not test wall. Prior refusal/pre-merge run remain separately labelled. No Reviewer executions/edits/QA. Lead new-ready/conflict report and Coordinator integrated cover/enqueue/landing separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-27T12:36:49.086Z

Merged 73f485ab5fb44745c933f19ccb53c53525630a0f onto dev.
