---
id: T-1405
kind: task
title: "The mirror renders Discord's Markdown: tables, deep headings, rules, task boxes and ||, no pings, fence-safe numbered splits and silent notes"
state: open
status: in progress
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1397
  - T-1400
topic: topic-1148
branch: t/T-1405-the-mirror-renders-discord-s-markdown
created: 2026-10-27T23:38:46.826Z
updated: 2026-10-28T10:42:40.088Z
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

- [x] C1. An agent's report with a table, a level-4 heading, a rule, task boxes and `||` arrives with the table in a code block, the heading as a bold line, and the rule, boxes and `||` rewritten (test).
  - done: impl-1405 · 2026-10-28T10:34:11.833Z
- [x] C2. A message containing `@everyone`, a role mention and a user mention pings nobody on the fake, on its create and on its edit (test).
  - done: impl-1405 · 2026-10-28T10:34:28.476Z
- [ ] C3. A 4500-code-point message with a fenced block across a cut arrives as parts numbered "1/3" to "3/3", each within 2000 code points, with every fence closed and re-opened with its language (test).
  - failed: rev-34 [reviewer] · 2026-10-28T10:42:40.088Z · note Multipart regressions close the injected Store before subject drainage on failure; fixture ownership must be corrected.
- [x] C4. Progress notes and hub notices arrive with `SUPPRESS_NOTIFICATIONS` while other messages notify, and a workbench message shows "you" and a Telegram one "you (Telegram)" (test).
  - done: impl-1405 · 2026-10-28T10:34:28.948Z
- [x] C5. A message the converter cannot handle arrives as plain text and is never dropped (test).
  - done: impl-1405 · 2026-10-28T10:34:29.109Z

## Notes

Shared files: discord.ts (General out), new hub/src/remote/discord-render.ts

## Comments

### impl-1405 · 2026-10-28T10:30:37.170Z

Consumer inventory: DiscordRemote publish is production outbox.send caller; discord-messages.test.ts calls send and seeds historical intents. Persisted intents read by DiscordOutbox replay; new silent field optional, old mapping retained. DiscordApi create/edit and fake mention/size checks unchanged. mirrorOut used by Telegram/Discord and mirror.test.ts: unchanged. Searched production, all hub/test tiers, qa briefs, docs and shipped skills: no frame/list/schema change. New split job sources retain original message in mapping; historical payload regression remains in discord-messages.test.ts.

### impl-1405 · 2026-10-28T10:34:38.603Z

Coordinator decision recorded: render/fallback before durable enqueue and persist rendered bytes; replay does not render again. C1–C5 done at 092d008a1; source review requested from reviewer. Inventory correction: neutral mirror coverage lives in hub/test/remote-mirror.test.ts (the earlier mirror.test.ts shorthand was not a literal filename).

### impl-1405 · 2026-10-28T10:34:44.025Z

Exact neutral mirror consumer filename from rg -l mirrorOut hub/test: hub/test/remote-neutral.test.ts. It is unchanged; this supersedes both earlier filename references.

### rev-34 · 2026-10-28T10:38:54.582Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-source1
commit: 092d008a126d9a542f8b3b7307c8e18034447381
scope: full
findings: [{"severity":"medium","text":"M1 Standards: new test file has no tier-map entry, blocking unchanged verification admission; add its sorted T2 row.","file":"hub/test/discord-render.test.ts","line":1},{"severity":"medium","text":"M2 Spec: awaiting drain per part leaves the remaining rendered suffix unsaved during the first native request; stop/restart loses it and later sources can interleave. Persist the complete group before delivery.","file":"hub/src/remote/discord.ts","line":80}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear at the exact reviewed head. Standards M1 and Spec M2 are detailed in A-13208, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13208-t-1405-source-review-1-tiers-and-multipart-durability.md. C3 failed; other run-dependent criteria remain unverified. Reviewer ran no tests/probes/browser. Lead subsequently reproduced M2 at the first held native create with `1 !== 3` durable jobs (0fbc4d69); fix/replacement source review pending before verification.

Criteria: C3 failed (Multipart source is not fully durable before native delivery; stopping during the first create can lose parts 2/3.).

### rev-34 · 2026-10-28T10:42:40.088Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261028-1405-source2
commit: 06ca56384ce8601b88e843ba24b879b810e1fd05
scope: full
findings: [{"severity":"medium","text":"M3 Standards: fixture cleanup closes its injected Store before projectHub's stop/drain barrier; an early failure leaves DiscordRemote/outbox accessing closed storage. Pre-own cancellation and subject/recovered drainage before Store/fake/root disposal; cover omitted/aborted held setup while preserving all semantic assertions.","file":"hub/test/discord-render.test.ts","line":16}]
finding_counts: {"high":0,"medium":1,"low":0}

M1 sorted T2 registration and M2 transactional complete-group enqueue are corrected in source. One remaining medium Standards finding M3; no remaining Spec finding. Artifact records full review/limits. Crash replay is a consistent SQLite snapshot component model, not native process-death evidence. No configured verification or Reviewer test ran; no criteria verified. C3 currently lacks a restored claimant done mark as well. Fresh source review required after ownership correction.

Criteria: C3 failed (Multipart regressions close the injected Store before subject drainage on failure; fixture ownership must be corrected.).
