---
id: T-1825
kind: task
title: "The web's hosts view: hosts with `Stop`, and the logins"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1820
  - T-1824
topic: null
branch: null
created: 2026-11-12T10:07:20.571Z
updated: 2026-11-12T10:07:25.258Z
---

## Summary

Opening the Hosts row in the web opens the hosts view inside the Sessions area (spec §3.9, assumed). It lists each pool's hosts with a `Stop` behind a confirmation, and the logins with harness, account, state, host and last sign-in.

## What to build

The folded-open Hosts row of T-1820 becomes the hosts view, on desktop and phone:
- **Hosts.** Each pool's hosts with their facts, as in the host list, and a `Stop` button. Stop asks for confirmation naming the host and the number of its sessions, which end as exited, and goes through `host.stop`. Confirm and Cancel follow the session actions' pattern.
- **Logins.** The logins from `login.list`: name, harness, account, kind, state, host and last sign-in. The list is refreshed when the hub pushes a change to the pool's login counts or the host list, so a login bound, released or signed out updates in place. A signed-out login reads in the warning token.

The hub's refusals show on the line they concern. Explanations go in tooltips. No key binding is added.

## Acceptance criteria

- [ ] C1. With two fake hosts and two logins, the hosts view lists each host with its facts and each login with harness, account, state, host and last sign-in, matching `cland login list` (test).
- [ ] C2. `Stop` on a host asks for confirmation naming the host and its session count, and Confirm stops it through the hub: the host leaves the view and its sessions read exited (test).
- [ ] C3. Cancel, or closing the view, stops nothing (test).
- [ ] C4. A login bound, released or signed out updates its line in the open view within one second (test).
- [ ] C5. At phone width the view fits with no horizontal scroll, the typecheck's colour and contrast checks pass, and the hooks check finds no key listener outside the key map (test).

## Blocked by

- T-1820
- T-1824

## Notes

- Hot files: `web/src/sessions/HostsView.tsx` and `HostsView.module.css` (new), `web/src/sessions/HostsLine.tsx`, `web/src/sessions/SessionsArea.tsx`.
- Tests: new `web/test/hosts-view.test.ts` (Web, `projectHub` with the fake host provider, the fake transport and the fake harness binaries, isolated Headless Shell).
- Serves epic C2.
