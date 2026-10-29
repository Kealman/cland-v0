---
id: T-1411
kind: task
title: Codex and OpenCode approvals arrive as Discord cards, and the other needs-you rows as 📥 notices
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1410
topic: topic-1169
branch: t/T-1411-codex-and-opencode-approvals-arrive-as
created: 2026-10-27T23:38:48.033Z
updated: 2026-10-29T01:12:17.293Z
closed: 2026-10-29T01:12:17.293Z
---

## Summary

A Codex or OpenCode approval answered in the hub becomes a card. It names the session, the harness and the truncated command, with Success, Primary and Danger buttons, and a click answers it through `approval.answer` with `via = "discord"`. Plans, requests, item-topic messages and Claude Code approvals arrive as 📥 notices without buttons, and a reply to a notice goes to its topic.

## What to build

**Approval cards.** They render `approvalCard` as content: the title, then the command or the files in a code block, truncated to fit 2000 code points, with "full command in the workbench". There is one button per offered choice: "Approve once" (Success), "Always allow" (Primary) and "Deny" (Danger), with custom ids `approval:<id>:<choice>`. A click goes through `approval.answer`, is stored first and is answered by `UPDATE_MESSAGE` with `approvalOutcomeLine`. An approval closed elsewhere, withdrawn or answered in the harness edits every copy, as 14 does.

**Notices.** They render `noticeCards` without components. The plan's link appears only when `[web] origin` is set, and never as a `web.link` credential URL.

**Replies to notices.** A reply to a request or item-message notice goes to its topic. A reply to a plan or Claude Code approval notice goes to General with its reference, as on Telegram. `/cland inbox` and the publication order now include approvals and notices through `inboxPublication`.

The tests use the scripted Codex and OpenCode harnesses in `hub/test/fakes/`.

Spec §3.5 (cards, notices), §3.1 (approvals); v0.2 §3.4 and §3.8.

## Acceptance criteria

- [x] C1. A fake Codex approval for a 5000-character command arrives as a card naming the session and "codex", with the command truncated, "full command in the workbench" and Success, Primary and Danger buttons for the offered choices (test).
  - done: impl-1411 · 2026-10-29T00:43:52.348Z
  - verified: rev-26 [reviewer] · run rev-20261029-1411-evidence-1 · 2026-10-29T01:05:49.552Z · commit 788f6fedde25826a6aac5e57818c284b257dbde0
- [x] C2. A click on "Approve once" records the approval with `via = "discord"` before the callback, and the card turns into "Approved once" with who and when and no components (test).
  - done: impl-1411 · 2026-10-29T00:43:52.579Z
  - verified: rev-26 [reviewer] · run rev-20261029-1411-evidence-1 · 2026-10-29T01:05:49.553Z · commit 788f6fedde25826a6aac5e57818c284b257dbde0
- [x] C3. A plan, a review request, an item-topic message and a Claude Code approval arrive as 📥 notices without buttons, with the plan's link only when `[web] origin` is set (test).
  - done: impl-1411 · 2026-10-29T00:49:58.658Z
  - verified: rev-26 [reviewer] · run rev-20261029-1411-evidence-1 · 2026-10-29T01:05:49.553Z · commit 788f6fedde25826a6aac5e57818c284b257dbde0
- [x] C4. A reply to a request notice goes to its topic, and a reply to a plan notice goes to General with its reference (test).
  - done: impl-1411 · 2026-10-29T00:43:52.753Z
  - verified: rev-26 [reviewer] · run rev-20261029-1411-evidence-1 · 2026-10-29T01:05:49.553Z · commit 788f6fedde25826a6aac5e57818c284b257dbde0

## Notes

Shared files: discord-cards.ts, discord-interactions.ts, discord-inbound.ts

## Comments

### impl-1411 · 2026-10-29T00:40:41.280Z

Rule 20 consumer inventory before edits: DiscordCards/discordAsk callers: remote/discord.ts; publication callback remote/discord-commands.ts; DiscordOutbox card/closeCard consumers: discord-cards.ts plus discord-cards.test.ts direct persisted-job tests. Persisted readers: discord-outbox.ts resume/prove/sourceOpen/deliver and RemoteStore messagesForAsk/messagesForApproval; inbound references: discord-inbound.ts. Neutral models cards.ts/inboxPublication also consumed by Telegram cards/commands and their T1/T2 fixtures. Protocol approval.answer/results/approval/departures already supported by gateway, web, nvim and adapters; no wire changes planned. Searched production, hub/test, web, nvim, docs, shipped skills (including T3/T4); only Discord adapter consumers need migration. Preserve old ask mapping/payload/closure shape; add optional approval/notice metadata. Existing direct outbox old-payload tests retain previous persisted shape. New evidence uses authorized production frame + fake Discord + scripted native approval harness seams.

### rev-26 · 2026-10-29T00:49:45.373Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1411-source-1
commit: 3524b64e3f76991fef3bf5b487442ef0932875de
scope: full
findings: [{"severity":"medium","text":"M1: slicing the complete plan notice to 2000 code points can discard its fixed workbench instruction and configured origin after a long valid title. Reserve that tail and visibly truncate the title; retain set/unset-origin native controls.","file":"hub/src/remote/discord-cards.ts","line":206},{"severity":"medium","text":"M2: new mapped/copied/folded until() promises start before intervening awaited triggers without immediate catch or disposal ownership. On failed setup they can reject unhandled and consult Store during teardown. Await each durable-state trigger first, then start/await its predicate; preserve exact assertions.","file":"hub/test/discord-cards.test.ts","line":693}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear at 3524b64e3. Consolidated Standards M2 / Spec M1 in A-13540 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13540-t-1411-full-source-review-1-not-clear.md). All nine changed files and C1–C4 inspected; no reviewer execution or runtime verification. Existing ask compatibility, approval durable result/closure paths, notice reply routing and factory origin propagation inspected. M1/M2 are the complete findings; commit/push corrections and request a fresh exact-head review, retaining red/green receipts. Configured verification remains pending replacement source clearance.

Criteria: C3 failed (Long valid plan title removes the fixed workbench instruction and configured origin under the whole-content slice; source defect plus implementer-reported native red controls.).

### rev-26 · 2026-10-29T00:50:36.756Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1411-source-2
commit: 788f6fedde25826a6aac5e57818c284b257dbde0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full replacement source clear. Standards: M2 resolved by starting/awaiting durable-state predicates after their triggers settle, with exact native mapping/copy/content/outcome assertions retained. Spec: M1 resolved by reserving plan instruction/link tail and visibly clipping only title; supplementary-Unicode long-title controls cover set/unset origin and retain native budget, empty components and reply assertions. Original nine-file audit carried forward; all four correction diffs inspected. A-13542 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13542-t-1411-full-source-review-2-clear.md). No dev merge; parent 3524b64e3. C1–C4 done present; local A-13541 remains macOS targeted evidence only. No reviewer execution or runtime verification. Proceed with configured mode-free verification at unchanged head, then original-record final evidence review.

### rev-26 · 2026-10-29T01:05:49.553Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1411-evidence-1
commit: 788f6fedde25826a6aac5e57818c284b257dbde0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear; C1–C4 verified at unchanged source-clear 788f6fedde. A-13543/run f5f24ccc independently parsed: 4067 ordinary pass outcomes plus 75 separately scoped load passes, no failed/cancelled/skipped or unfinished test identities. T0/T1/all fallback T2/Web exit0; T3/T4 unexecuted, no full-all claim. Changed card file 39 ordinary passes; all seven new generated identities each base +5/5 load pass. C1/C2 scripted Codex/OpenCode preview/styles and durable Discord outcome before callback; C3 four native notice kinds, origin set/unset and long-title instruction/link; C4 stored-topic request reply and referenced General plan reply. All-copy/refusal control retained. New base max0.318758s, load max0.717575s. Linux c-8 lon1, Node24.21/Neovim0.12.5, browser setup CHS156.0.8078.4/v1248; host gate039833e reused, not remote typecheck. Budget/lint/ratchet report-only; no Web repetitions required or claimed. Full evidence/provenance and limits A-13544 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13544-t-1411-final-evidence-review-1-clear.md).

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-29T01:12:17.293Z

Merged 4f6aee6009653b77dd108f6974003faadd7eb9ee onto dev.
