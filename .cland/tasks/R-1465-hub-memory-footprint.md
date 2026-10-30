---
id: R-1465
kind: release
version: 0.3.1
title: Hub memory footprint
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-30T06:38:19.300Z
updated: 2026-10-30T14:40:40.187Z
---

## Goal

The hub's memory footprint fits a consumer machine that runs more than one project. The human (General, 2026-10-30 06:37Z, voice via Telegram, A-14154) asked for a 0.3.1 patch: today one hub takes 2–3 GB, so a second project's hub doubles that. The release finds what holds the memory at startup and at rest, cuts it, and adds a budget test so it cannot grow back.

## Notes

- Version 0.3.1 is the human's choice (same message: «сделаем patch release 3.1 с оптимизацией»).
- Observed: hub 88459 (restart #60, v0.3.0) at 3.0 GB RSS 80 s after start on this project (about 1,460 tracker items, 14,000 artifacts); earlier hubs ran 2.8 GB at rest (pid 35680 on 10-29). The hub starts with an 8 GB heap cap after the restart-#22 OOM (T-912).

## Comments

### coord · 2026-10-30T14:40:40.187Z

Human, 2026-10-30 14:40Z via Telegram (General msg remote-328802bf): «Ок, я на сегодня ухожу уже, так что делай все, все баги которые находишь, тех долг и прочее, бери в 0.3.1 и когда ничего не останется - делай релиз». Recorded as the human's scope decision and conditional release approval for 0.3.1: every open Bug, Tech debt and Follow-up that can complete moves in (T-1484, T-373, T-1264, T-1268, T-1451, T-1433). T-1486 and T-1488 stay in Follow-ups because each needs a day of recorded evidence after its report-mode predecessor lands. Release when nothing open remains under R-1465, following the release skill with T-1463's conditional approval: conditions are every item landed or closed, release covers green, QA clear, dry-run notes shown in the release topic.
