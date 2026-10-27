---
id: T-1405
kind: task
title: "The mirror renders Discord's Markdown: tables, deep headings, rules, task boxes and ||, no pings, fence-safe numbered splits and silent notes"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1400
topic: null
branch: null
created: 2026-10-27T23:38:46.826Z
updated: 2026-10-27T23:38:46.826Z
---

## Summary

General messages arrive in Discord's Markdown. Tables become code blocks, and deep headings, rules, task boxes and `||` are rewritten. Splits fall at 2000 code points, re-open code fences and are numbered "n/m". No mention pings anyone, progress notes and hub notices arrive silently, and a conversion error never drops a message.

## What to build

**The converter** in `discord-render.ts`:
- a table becomes a fenced code block with aligned columns;
- a heading deeper than `###` becomes a bold line;
- a rule becomes a line of `─`;
- task boxes become ☐ and ☑;
- `||` is escaped so that it shows no spoiler.

**The splitter.** It cuts at block boundaries within 2000 code points, leaving room for the header and the "n/m" mark. A fenced block across a cut is closed and re-opened with its language. A conversion error falls back to plain text.

**Silence and authors.** Silent messages, which are progress notes and hub notices (`mirrorOut`'s `silent`), carry `SUPPRESS_NOTIFICATIONS`. Every create and every edit keeps the empty `allowed_mentions`. Authors come from `mirrorOut`: "you" from a workbench and "you (Telegram)" from the other remote.

The fake checks the 2000 code points and reports pings.

Spec §3.4 (Discord rendering, splitting, silence); Q-1293 (the rewrites the human accepted); research rules 19 and 20.

## Acceptance criteria

- [ ] C1. An agent's report with a table, a level-4 heading, a rule, task boxes and `||` arrives with the table in a code block, the heading as a bold line, and the rule, boxes and `||` rewritten (test).
- [ ] C2. A message containing `@everyone`, a role mention and a user mention pings nobody on the fake, on its create and on its edit (test).
- [ ] C3. A 4500-code-point message with a fenced block across a cut arrives as parts numbered "1/3" to "3/3", each within 2000 code points, with every fence closed and re-opened with its language (test).
- [ ] C4. Progress notes and hub notices arrive with `SUPPRESS_NOTIFICATIONS` while other messages notify, and a workbench message shows "you" and a Telegram one "you (Telegram)" (test).
- [ ] C5. A message the converter cannot handle arrives as plain text and is never dropped (test).

## Notes

Shared files: discord.ts (General out), new hub/src/remote/discord-render.ts
