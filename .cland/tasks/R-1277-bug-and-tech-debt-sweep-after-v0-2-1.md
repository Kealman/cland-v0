---
id: R-1277
kind: release
version: 0.2.2
title: Bug and tech-debt sweep after v0.2.1
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-1025
branch: null
created: 2026-10-25T09:40:54.973Z
updated: 2026-10-26T01:27:41.614Z
---

## Goal

Clear the bugs, tech debt and follow-ups that accumulated through v0.2.1, so the 0.3 feature release (remote control through Telegram and Discord) starts from a clean dev.

## Notes

The human, 2026-10-25 09:40Z in General (answer to ask 1a28c677): «…можешь 0.2.2 оставить для багов техдолга и т.п. а интеграции уже в 0.3 взять». Version 0.2.2 is the human's choice. The integrations go to 0.3, and the human is grilling them with the designer, so their spec comes from the human. The triage of the Bugs, Tech debt and Follow-ups categories, with the proposed scope, goes to the human for approval before any epic starts. The human gave advance publication approval for 0.2.2 on 2026-10-25 14:17Z in General («заранее даю разрешение на публикацию версии и потом бери 0.3»). Highlights: precise process identity for PID-reuse guards, stop paths and the droplet watchdog (E-1284); deaf-session alerts, Codex long-thread reattach and a startup grace, OpenCode login diagnostics, and invalid role launch policies refused (E-1280); merge queue, stage closure, soak and publish reports that tell the truth across restarts (E-1281); load-sensitive tests sealed, runner and frame tooling, reasoned platform skips (E-1282); role clauses, QA lint and early plan actions (E-1283); version 0.2.2 (T-1317).

## Epics

Pending the triage.

## Comments

### coord · 2026-10-25T14:17:17.918Z

Release approval recorded in advance (human, General, 2026-10-25 14:17:02Z, msg ef700b46): «заранее даю разрешение на публикацию версии и потом бери 0.3» — advance permission to publish this release (version 0.2.2, already recorded on this item) once the release preview passes, then to start v0.3 (R-1278). The Coordinator still shows the dry-run preview in the release topic and cites this record in the release ask.
