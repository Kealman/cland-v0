---
id: T-1358
kind: task
title: Plans, requests, item-topic messages and Claude Code approvals arrive as 📥 notices, and a reply goes to their topic
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1353
topic: topic-1114
branch: t/T-1358-plans-requests-item-topic-messages-and
created: 2026-10-27T05:43:02.026Z
updated: 2026-10-27T12:02:18.418Z
---

## Summary

The other needs-you rows arrive marked 📥 and without buttons: a plan waiting for approval, a request for a review, a QA run or a handover, a message to the human in an item topic, and a Claude Code approval answered in its TUI. A reply to a notice goes to its topic, and the remote does not follow that thread.

## What to build

The card model gains notices, rendered as entities text with no keyboard and sent as `card` jobs when their inbox row appears:
- a plan names its epic and title, says plans are approved in the workbench, and links the web through `[web] origin` when one is set (never a `web.link` credential);
- a request names its kind, sender and item;
- an item-topic message names its sender and item and shows the text, truncated;
- a Claude Code approval (`answerIn = "tui"`) names the session and command and says to answer in its terminal.

Each notice is mapped in `remote_messages` with its topic and source message. A reply then goes through the inbound's reply path as `topic.send` with `replyTo` into that topic, which the gateway's authority already allows. The mirror stays General-only, so later messages in that topic reach the chat only as new cards and notices. Pairing rows never appear (`gatewayInbox`). Spec §3.5 and §3.4; v0.2 §3.8.

## Acceptance criteria

- [x] C1. A Claude Code approval, a waiting plan, a review request and an item-topic message to the human each arrive once as a notice starting with 📥 with no `reply_markup`, and the plan notice offers no approve action (test).
  - done: impl-1358 · 2026-10-27T12:00:02.134Z
- [x] C2. A reply to the item-topic notice lands in that topic as a reply to its message "via Telegram", and the agent's ordinary answer in that topic is not sent to the chat (test).
  - done: impl-1358 · 2026-10-27T11:45:03.147Z
- [x] C3. A plan notice carries the `[web] origin` link when one is set and no link without one, and no notice contains a web credential (test).
  - done: impl-1358 · 2026-10-27T11:45:03.403Z

## Comments

### impl-1358 · 2026-10-27T11:30:26.392Z

Pre-change consumer inventory (rule 20). Existing protocol/inbox/authority shapes stay unchanged; additive notice model and adapter-local reference keys only. Production consumers: remote/cards.ts (askCard/RemoteCard), telegram-cards.ts (renderer/publisher), telegram.ts (inbox dispatch/lifecycle), telegram-inbound.ts (mapped replies), telegram-outbox.ts and remote/state.ts (existing source/topic mapping), messenger.ts and hub/daemon.ts (configured origin injection), remote/authority.ts and gateway.ts (unchanged authority/filter/redaction). Client wire readers: shared/wire inbox types, web connection/InboxArea/inbox visit and Neovim inbox remain unaffected, no new fields. Search covered hub/web/nvim tests all tiers, qa/, docs, shipped .agents skills and startup probes: telegram-*.test.ts plus their fixtures, outbox*.test.ts, gateway*.test.ts, asks*.test.ts and inbox*.test.ts; no external consumer of RemoteCard or TelegramCards. Existing gateway old-client tests preserve previous wire shapes. Source-message-backed request/message notices use existing replyTo; plan/TUI notices have no message and use adapter-local stored reference to General, per Coordinator decision cabbd851. No new authority or hub metadata.

### coord · 2026-10-27T11:42:48.007Z

Coordinator decision (2026-10-27 11:30Z, answered in topic-1114), and it supersedes the "reply routed to the notice's topic" wording in What to build. Request and item-topic message notices route a reply into their topic as a reply to the real source message (C2). Plan and Claude Code TUI approval notices have no source message, so a reply goes to General as the human's message with via telegram, starting with a reference such as "re plan E-n:" or "re approval <session>:". The gateway's authority is unchanged. Any later move of plan replies into the epic's topic would be an authority change for the human to decide.

### impl-1358 · 2026-10-27T11:46:51.840Z

Implementation pushed at 5f7e786a440b396302870c3ae6ddf511d6516caa (tree 88addca1b7d42f8253a1148f4d3cb40055392b13), source review requested. Actual local Darwin arm64 / Node v24.21.0 targeted receipts: 30 files serial, 277 passed, 0 skipped; new notice file 10 T2 cases. Includes requested existing T3/T4 inbox/polling files, no browser or real platform. npm run typecheck, npm run test:lint (135 report-only diagnostics, 0 refusals), npm run test:tiers and wording guard passed. A-12738 retains exact per-case/per-file local receipts. R/G and routing details are in the implementation artifact and docs/agents/tests/hub-test-telegram-notices.test.ts.md. No Linux/full-task verification claim yet; waiting for clear source review before mode-free verify. Origin/dev fetch+merge was current at 1748b9c0a; task tree clean.

### rev-31 · 2026-10-27T11:51:29.443Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261027-1358-source1
commit: 5f7e786a440b396302870c3ae6ddf511d6516caa
scope: full
findings: [{"severity":"medium","text":"M1 [Standards]: REMOTE_USAGE changed but its commands.json frozen row did not. Independent JSON decoding confirms inequality, so the existing frozen usage/full-help contracts are stale. Reproduce the unchanged owning guards, migrate only REMOTE_USAGE, retain native red/green output/exits, and preserve guard/composition/order assertions.","file":"hub/src/cli/usage.ts","line":67},{"severity":"medium","text":"M3 [Spec/C1]: New plan notices copy an unrestricted tracker title into card.title, but telegramCardText only clips card.question. A valid 5,000-code-point epic title alone makes the header 5,015 code points, beyond the 4,096 plain-message budget before any question/link; the bold entity also retains the full title length. Fallback removes entities but keeps the same oversized text, so it cannot deliver this notice. Bound the complete rendered notice, including title/link/marker, and derive entities from the actual clipped spans while retaining full source and stable reply mapping. Add an independently asserted long-plan-title control; existing long-body test covers only question clipping.","file":"hub/src/remote/telegram-cards.ts","line":143},{"severity":"medium","text":"M4 [Spec]: New notices are enqueued in section/array order rather than oldest first. Inbox plans/approvals are newest-first and messages are descending sequence; noticeCards concatenates sections unchanged, then the native queue assigns increasing order and sends that order. A fresh publication with two waiting plans therefore puts the newer notice above the older one, contrary to spec §3.5's oldest-first publication order. Sort newly published notices by their stable since with a deterministic tie-break before enqueueing, preserve per-row dedup, and add a single-publication backlog/order control rather than sequential one-notice production.","file":"hub/src/remote/telegram-cards.ts","line":82}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear; A-12742 consolidates Standards M1 and Spec M3/M4 at tree88addca1b7d42f8253a1148f4d3cb40055392b13. Coordinator cabbd851 routing exception applied; authority unchanged and source-backed vs referenced-General paths appear sound. Preliminary M2 dedup concern withdrawn after complete Store.waitInInbox timestamp trace; no dedup correction/test requested for it. Existing30file/277pass local transcript A-12738 remains macOS selected evidence only; no Linux/full/load/allowance claim. M3/M4 are source/path reasoning, not Reviewer-executed native red. Preserve full-source/mapping/receipt assertions, migrate only owning frozen help row, bound complete notice/header/link/marker and entities, order newly published notices by stable since with deterministic tie-break. Fresh pushed-head source review before configured verification; C2/C3 remain runtime-unverified. No Reviewer execution, extra dev merge or QA requested.

Criteria: C1 failed (M1 frozen remote help mismatch; M3 new plan header can exceed full plain-message budget; M4 pending notice backlog sends newest/section order instead of oldest first.).

### impl-1358 · 2026-10-27T12:00:19.059Z

Source1 M1/M3/M4 corrected at 6a012904619ce05082e186b22efb00c7cc80509c (tree 4f861fdbb64f3f44146687c18b9e88a0c311fe12); fresh source2 review requested. Original CLI guards exit1→0 after only REMOTE_USAGE frozen-row migration; long public plan controls reproduce 5047/10065-code-point red then ≤4096 green with actual entity spans and retained sources/targets; one backlog publication reproduces section-order red then chronological/stable-tie green. Original eight red/green native outputs/exits are A-12754, durable folder /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12754-t-1358-source-review-corrections-original-red-and-green-receipts. Corrected local serial transcript A-12755: 33 files,304/304 cases,0 skipped, all native exits0;13 notice T2 cases. Darwin arm64 Node24.21.0. Typecheck/admission lint/tier lint pass (135 report-only diagnostics,0refusals); no Linux/full-task/browser/real-platform claim. No dev merge after source1. Waiting for source clear before exact-head verify.

### rev-31 · 2026-10-27T12:02:18.418Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261027-1358-source2
commit: 6a012904619ce05082e186b22efb00c7cc80509c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, A-12756, tree4f861fdbb64f3f44146687c18b9e88a0c311fe12. M1/M3/M4 resolved: only frozen REMOTE_USAGE row migrated with guard sources/order unchanged; complete header/link/body bounds and actual UTF16 entities shared by ask/notice/outcome callers; notices sort retained wait time/id/kind before enqueue. Three public-frame size/backlog controls preserve full source/map and original assertions. Withdrawn M2 remains withdrawn; dedup unchanged. Coordinator cabbd851 source-backed versus General-reference routing exception preserved. A-12754 original native guard/size/order red→green read; A-12755 independently counted33files/304pass/0fail/cancel/skip, macOS selected source evidence only. No configured/Linux/full/load proof yet; C1–C3 runtime-unverified. Submit one ordinary configured mode-free verify at this unchanged head and request final original-log evidence review. Linux durations/allowances pending actual cases; no extra dev merge or QA requested. Reviewer read-only, no test execution.
