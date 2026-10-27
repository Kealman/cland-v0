---
id: T-1411
kind: task
title: Codex and OpenCode approvals arrive as Discord cards, and the other needs-you rows as 📥 notices
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1410
topic: null
branch: null
created: 2026-10-27T23:38:48.033Z
updated: 2026-10-27T23:38:48.033Z
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

- [ ] C1. A fake Codex approval for a 5000-character command arrives as a card naming the session and "codex", with the command truncated, "full command in the workbench" and Success, Primary and Danger buttons for the offered choices (test).
- [ ] C2. A click on "Approve once" records the approval with `via = "discord"` before the callback, and the card turns into "Approved once" with who and when and no components (test).
- [ ] C3. A plan, a review request, an item-topic message and a Claude Code approval arrive as 📥 notices without buttons, with the plan's link only when `[web] origin` is set (test).
- [ ] C4. A reply to a request notice goes to its topic, and a reply to a plan notice goes to General with its reference (test).

## Notes

Shared files: discord-cards.ts, discord-interactions.ts, discord-inbound.ts
