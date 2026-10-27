---
id: T-1363
kind: task
title: The web's Sessions area shows the Remotes row
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1362
topic: null
branch: null
created: 2026-10-27T05:46:50.067Z
updated: 2026-10-27T05:46:59.506Z
---

## Summary

The web's Sessions area shows the same Remotes row as Neovim, fed by 02's frame, red at once on a failure.

## What to build

Spec §3.11 and v0.2 §3.2 and §3.6. The web edge passes the remote-state frame to browsers, and the web authority still refuses `remote.status`. The connection model keeps the latest frame.

Model a `RemotesLine` component on `VerifyLine` and place it in the Sessions area beside the accounts strip and the verification line, with a CSS Module and colours from `tokens.css` only. It lists facts per messenger and puts no explanation in the UI: the meaning of each field goes in its `title`, and the docs come in 08. While a remote is offline or stopped, its row uses the error token, and secondary text keeps 4.5:1 contrast. At phone width the row sits in the Sessions screen without horizontal scroll. Any key binding goes through `keymap.ts`. None is needed beyond the existing focus movement.

**External wait and shared files:** none · **Shared files:** web/src/sessions/SessionsArea.tsx, web/src/connection.ts, hub/src/hub/web-authority.ts

## Acceptance criteria

- [ ] C1. Headless Chromium's Sessions area shows the Remotes row with connection, paired name, mute, outbox depth and last error, styled as an error within one second of a fake outage and plain on recovery (test).
- [ ] C2. The browser receives the frame while a `remote.status` request from the web edge is still refused (test).
- [ ] C3. At phone width the row renders inside the Sessions screen with no horizontal page scroll (test).
