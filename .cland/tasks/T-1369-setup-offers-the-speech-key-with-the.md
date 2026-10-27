---
id: T-1369
kind: task
title: Setup offers the speech key with the provider's data-use line
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1366
  - T-1367
  - T-1368
  - E-1311
topic: null
branch: null
created: 2026-10-27T05:46:51.082Z
updated: 2026-10-27T22:46:20.450Z
---

## Summary

After the messengers, setup's remote step offers the ElevenLabs key. It shows the provider's data-use line (the same text `cland remote status` prints), then stores the key through the hidden question. The docs page and the tour stage gain the speech key.

## What to build

Spec §3.11 (setup offers the speech key) and §3.6 (data use). The offer appears only when `[speech] provider` is a cloud provider whose key is missing. For `command` and for `""` it prints one line and asks nothing. The data-use line comes from E-1311's single constant. The key goes to `speech.elevenlabs_key` through 05's hidden question.

- A decline prints `skip`. A present key prints `ok`.
- Without a terminal the offer prints `open` with `cland secret set speech.elevenlabs_key`.

The remote-control page gains the speech key and its data-use line, and the tour stage gains one sentence on voice notes.

**External wait and shared files:** E-1311 (the speech providers and the data-use line) · **Shared files:** hub/src/setup/steps/ (the remote step), .agents/skills/onboarding/TOUR.md, the remote-control docs page

## Acceptance criteria

- [ ] C1. With a scripted prompter, setup shows the data-use line that `cland remote status` prints, reads a made-up key through the hidden question and stores it, ending in `done`; a decline prints `skip` and a present key `ok` (test).
- [ ] C2. With `provider = "command"` or `provider = ""`, setup asks nothing about a key, and without a terminal a missing ElevenLabs key prints `open` with `cland secret set speech.elevenlabs_key` (test).
- [ ] C3. The docs page and the tour stage name the speech key's command, and they pass the docs and onboarding command checks (test).
