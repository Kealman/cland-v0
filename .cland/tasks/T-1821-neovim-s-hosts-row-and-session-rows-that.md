---
id: T-1821
kind: task
title: Neovim's Hosts row, and session rows that name their host
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1819
topic: null
branch: null
created: 2026-11-12T10:07:19.751Z
updated: 2026-11-12T10:07:41.677Z
---

## Summary

Neovim's sessions panel shows a Hosts row beside Remotes, one line per pool, with the same facts as the web's, red at once when its pool is alerted. `za` on the row's header expands it to the host list. A session on a host names its host on its panel row.

## What to build

The panel reads T-1819's frame into state and draws the Hosts row after the Remotes row, in that row's pattern: a dim header, one wrapped line per pool, the error highlight while the pool is alerted with the host or the failure named. The row folds as the Accounts header does: `za` on its header goes through the existing fold handler, with no new key binding. The expanded list shows each host's id, size, region, uptime, sessions, price per hour and spend today. The row is hidden when no pool is configured and no host is live. A session whose process row has a host shows the host id on its panel row and in its selected meta line; a local session shows none. The recorded protocol-frame fixtures gain the frame.

## Acceptance criteria

- [ ] C1. Headless Neovim's sessions panel shows the Hosts row after Remotes with one line per pool from the hub's frame, with hosts, slots and logins per harness (test).
- [ ] C2. `za` on the Hosts header expands and folds the host list with id, size, region, uptime, sessions, price per hour and spend today (test).
- [ ] C3. A fake host made unreachable turns its pool's line red within one second and names the host, and the line is plain again on recovery (test).
- [ ] C4. A session on a fake host names its host id on its panel row and in its selected meta line, and a local session names none (test).
- [ ] C5. The panel shows no Hosts row when no pool is configured, and the recorded protocol-frame fixtures include `hosts.state` (test).

## Blocked by

- T-1819

## Notes

- Hot files: `nvim/lua/cland/panels.lua` (the sessions panel and its fold handler), `nvim/lua/cland/state.lua`, `nvim/lua/cland/hub.lua`, `nvim/lua/cland/init.lua`, `nvim/test/fixtures/protocol-frames.json`, `nvim/test/fixtures/protocol-frames/sessions.json`.
- Tests: new `nvim/test/hosts.test.ts` (headless Neovim against `projectHub` with the fake host provider and the fake transport), after `nvim/test/remotes.test.ts`.
- Serves epic C1 and C3.
