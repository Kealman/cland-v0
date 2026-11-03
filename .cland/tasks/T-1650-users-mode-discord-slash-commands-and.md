---
id: T-1650
kind: task
title: Users-mode Discord slash commands and first-answer-wins across paired users have no test
state: open
status: backlog
size: S
labels:
  - needs-triage
  - release-blocker
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: null
created: 2026-11-03T02:48:20.364Z
updated: 2026-11-03T10:12:49.705Z
---

## Summary

T-1574 (head c35d60b5, queued 2026-11-03) changed users-mode Discord slash commands, but no test covers them. Its docs say `/cland inbox` re-sends only in the invoking channel and folds every copy, and it also changed the users-mode help line and the user attribution of `/cland decision` and `/cland question`. `discord-users.test.ts` has no slash-command case, and `discord-commands.test.ts` is single-mode. The spec's "the first answer wins" across two paired users (spec §3.8) is untested on both remotes too: every card test has a stranger press it, then one paired user answers, and a second paired user never presses. Found while drafting the E-1536 stage-4 QA brief, which lists these as out of scope.

## What to build

Tests only, using the fake native Telegram and Discord doubles: users-mode `/cland inbox`, help, decision and question with two paired Discord users; and a card pressed by two paired users on each remote. The second press must be refused or ignored as the spec states, and every copy must fold once with the first answerer's name.

## Acceptance criteria

- [ ] C1. A users-mode Discord test with two paired users covers `/cland inbox` (re-sent only in the invoking channel, every copy folded), the help line, and `/cland decision` and `/cland question` attributed to the invoking user (test).
- [ ] C2. On Telegram and on Discord, a card answered by one paired user and then pressed by a second paired user records only the first answer, folds every copy once with the first answerer's name, and gives the second user the documented refusal (test).
