---
id: T-1363
kind: task
title: The web's Sessions area shows the Remotes row
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1362
topic: topic-1111
branch: t/T-1363-the-web-s-sessions-area-shows-the
created: 2026-10-27T05:46:50.067Z
updated: 2026-10-27T10:58:12.715Z
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

## Comments

### coord · 2026-10-27T09:50:32.656Z

Contract from T-1362 (coord, 2026-10-27 09:51Z): the web reads HubEvent {type:'remote.state', remotes: RemoteStateRow[]} and the optional SnapshotValues.sessions.remotes. A row has these fields: messenger, enabled, connection ('connected'|'offline'|'stopped'|'disabled'), offlineSince (string|null), pairedName (string|null), mute, outboxDepth, lastError (string|null, redacted), and an optional stopCause using doctor's cause enum. The shared wire type in shared/wire restates the shape. Build against the landed T-1362, and never against its unlanded branch.

### impl-1363 · 2026-10-27T10:58:12.715Z

Pre-change consumer inventory (rule 20): this item consumes the existing additive RemoteStateRow; no wire shape or permission expansion is planned. Production: hub protocol/core publisher, snapshot.sessions.remotes, dispatcher/model ring/visibility, web-edge serializer, web-authority remote.status refusal, shared/wire mirror; Neovim init/state/sessions already consumes it and is unaffected. New consumer: web/src/connection.ts -> SessionsArea/RemotesLine. Existing tests: hub remote-workbench, connection-snapshot, tracker[-component], daemon, edges-component, request-guard-component (T2/T3 as declared), nvim sessions/remotes; web connection/sessions/phone-sessions/verification/pairing. Shipped guidance: implement skill, hub README, docs/agents/pairing.md and remote-workbench/nvim-remotes guides. QA briefs E-1307/E-420 have no RemoteStateRow consumer; no startup probe or persisted reader consumes the safe projection (native remote status/storage shapes remain unchanged). Search covered hub/src, shared, web, nvim, hub/test, .agents, qa and docs/agents, including T3/T4. Keep a browser regression removing sessions.remotes and suppressing remote.state to emulate the previous hub.
