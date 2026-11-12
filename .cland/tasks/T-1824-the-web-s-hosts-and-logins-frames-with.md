---
id: T-1824
kind: task
title: The web's hosts and logins frames, with web-started card sign-ins
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: null
branch: null
created: 2026-11-12T10:07:20.325Z
updated: 2026-11-12T10:07:42.604Z
---

## Summary

The hub accepts the hosts view's frames from an authenticated web user: the human in single mode, an admin in users mode. These are `login.list`, `host.stop`, `login.remove` and `login.snapshot`, plus web starts of `login add` and `login signin`. A web start runs the harness's sign-in on a pool host through the card runner, not a terminal. Sessions and the remotes stay refused, and the other host and login frames stay local.

## What to build

Today every `host.*` and `login.*` frame is refused from the web, in both the web authority table and the dispatcher's locality check. Open exactly these to the web edge, under the user-role column:
- **Reads and stops.** `login.list` and `host.stop` answer as they do from the local CLI.
- **Removal and snapshots.** `login.remove` and `login.snapshot` answer the same way.
- **Starting a sign-in.** A web `login.add` for a disk login of a pool and harness, and a web `login.signin` of a signed-out login, enter the card runner's start path directly, with no card answer needed. They answer at once with the login name and the id of the `login-signin-code` card that carries the link and code (question 11).

A key login is refused from the web, since a key enters only through stdin. `host.create`, `host.destroy`, `host.revoke`, `host.prepare` and `login.set` stay local. Each web action's audit and journal records carry the acting user's id in users mode.

## Acceptance criteria

- [ ] C1. From an authenticated web connection, `login.list`, `login.snapshot` and `login.remove` answer as from the local CLI, and `host.stop` stops a fake host and ends its sessions as exited (test).
- [ ] C2. A web `login.add` of a pool and harness, and a web `login.signin` of a signed-out login, run the sign-in on a pool host through the card runner and answer at once with the login name and the sign-in card's id (test).
- [ ] C3. A web-started sign-in leaves the fake Codex login `ready` with no answer, and the fake Claude Code login `ready` once the card's answer reaches the prompt (test).
- [ ] C4. A key login, `host.create`, `host.destroy`, `host.revoke`, `host.prepare` and `login.set` from the web, and every host and login frame from a session or a remote, are refused naming the rule (test).
- [ ] C5. In users mode each web action's audit and journal record carries the acting user's id (test).

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/hub/web-authority.ts`, `hub/src/host/login-card-signin.ts` (the start path), `hub/src/hub/dispatch.ts` (the host and login case's locality check). Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts`.
- Tests: new `hub/test/web-hosts-authority.test.ts` (T2, `projectHub`, an authenticated web frame client, the fake host provider and the fake harness binaries); `hub/test/web-authority.test.ts` extended.
- Serves epic C2.
