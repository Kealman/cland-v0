---
id: T-1372
kind: task
title: Discord's stopped causes reach doctor, and Discord shows in both workbenches
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1361
  - T-1362
  - T-1363
  - T-1364
  - T-1368
  - E-1312
topic: topic-1175
branch: t/T-1372-discord-s-stopped-causes-reach-doctor
created: 2026-10-27T05:46:51.767Z
updated: 2026-10-29T10:41:39.774Z
---

## Summary

The fake Discord gateway's 4004 and 4014 closes give doctor's lines and fixes. A Discord outage turns its Remotes row red in both workbenches. Messages, approvals, voice messages and pairing codes from Discord read with their marks and rows in Neovim and the web.

## What to build

Spec §3.11, §3.8 (close codes) and §3.2. E-1312's fatal closes record 01's structured causes (4004 → `token`, 4014 → `message-content`), and Discord's liveness feeds 02's offline transition. Doctor's Discord block also shows the paired guild, channel and user ids. Everything else is end-to-end checking of 02, 03, 04 and T-1322 through the fake Discord gateway and REST. The docs page's doctor table gains the Discord causes.

**External wait and shared files:** E-1312 (its voice messages also need E-1311) · **Shared files:** hub/src/remote/ (the Discord stop cause mapping), the remote-control docs page

## Acceptance criteria

- [ ] C1. A 4004 and a 4014 close on the fake Discord gateway each give doctor's line with its fix (a new token; the Message Content toggle), and the fake records no request during the doctor run (test).
- [ ] C2. A fake Discord outage turns the Discord Remotes row red in headless Neovim and headless Chromium within one second, and recovery clears it (test).
- [ ] C3. A message, a voice message and a card approval from the fake Discord read "via Discord" (the voice message with its 🎤 mark) in both workbenches, and a waiting `/cland pair` code shows as a pairing row in both inboxes (test).
- [ ] C4. The docs page's doctor causes name 4004 and 4014 with their fixes, and the page passes the docs check (test).

---

## Comments

### impl-1372 · 2026-10-29T10:38:40.071Z

Plan: use pre-agreed seams (production frames + fake Discord REST/gateway; headless Chromium and Neovim). Existing structured doctor causes and generic workbench rendering are present; inspect native-path coverage and add Discord regressions. No wire/schema/authority changes planned. Shared-contract consumer inventory will be recorded before any such change. Skill files frozen: propose workflow guidance in topic instead.

### impl-1372 · 2026-10-29T10:41:39.774Z

C2 red receipt: Neovim renders 'discord · offline' but never 'offline since'; native Discord status omits the existing optional offlineSince and outage lastError. Consumer inventory before filling those existing fields: hub/src/hub/daemon.ts (remote UI projection); web/src/sessions/RemotesLine.tsx; nvim/lua/cland/panels.lua (render facts/red, no migration); shared/wire/index.ts + hub/src/protocol.ts (already optional); Telegram producer unchanged. Tests: hub/test/remote-workbench.test.ts, web-area-state.test.ts, nvim/test/sessions.test.ts and protocol-frames fixture JSON (optional defaults unaffected), web/test/remotes.test.ts and nvim/test/remotes.test.ts (new native coverage); existing web previous-hub snapshot regression retained. Search included all tiers, shipped skills, qa, docs/agents and persisted consumers. No shape/removal/authority change, old omitted-field clients remain supported.
