---
id: T-1136
kind: task
title: "Acting on a session: Stop, Resume, Archive, Capabilities and the session's page"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1132
topic: topic-873
branch: t/T-1136-acting-on-a-session-stop-resume-archive
created: 2026-10-22T15:16:15.750Z
updated: 2026-10-22T23:09:43.677Z
---

## Summary

Stop, Resume, Archive and Capabilities work from the selected row and from the session's page, Stop and Archive after a confirmation in place.

## Parent

E-418 (§3.2, P22; §3.6 the session's page, P30; v0.1.2 §3.5; tracer step 3).

## What to build

- **The actions.** The unfolded row and the session's page carry Stop (`x`), Resume (`r`), Archive (`d`) and Capabilities (`c`), each where it applies: Stop on a live session, Resume and Archive on a stopped one.
- **Confirmations.** Stop and Archive ask once, in place: the actions give way to one line naming the session, where Enter or Confirm runs it and Esc or Cancel leaves it. Resume and Capabilities do not ask.
- **Resume** relaunches through the harness's own resume, keeping the name, role and claim; when the harness cannot resume, the hub's answer says so and the row offers a fresh launch with the same brief (v0.1.2 §3.5).
- **Capabilities** shows the session's adapter capability table read-only (the state signals, history, usage, model change, approval relay, terminal), or that the session has no adapter.
- **The session's page** holds the session's model, account, usage and capabilities with the same four actions and confirmations. On the desktop it opens with ⌘Enter in the other pane; the narrow slice opens it on a tap or Enter.

A refused or failed action shows its reason in place; the cookie's refused actions stay refused. Neovim's `sessions.lua` (stop and the capability float) defines the behaviour.

## Acceptance criteria

- [ ] C1. `x` on a busy fake session asks for a confirmation in place, Esc leaves it running, and Enter stops it as `cland session list` reads (Web test with the fake harness).
- [ ] C2. `r` on the stopped session resumes it with its name and role, as `cland session list` reads (Web test with the fake harness).
- [ ] C3. `d` on a stopped session asks for a confirmation and archives it, and it leaves Stopped for the archive (Web test).
- [ ] C4. `c` shows the session's adapter capability table read-only, and a session without an adapter says so (Web test).
- [ ] C5. The session's page shows the model, account, usage and capabilities and runs the same four actions with the same confirmations (Web test).
- [ ] C6. A resume the harness cannot perform shows the hub's reason and offers a fresh launch with the same brief (Web test with the fake harness).
- [ ] C7. `web/README.md` documents the actions, the confirmations and the session's page (docs).
