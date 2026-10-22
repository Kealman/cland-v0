---
id: T-1111
kind: task
title: "The Codex relay: app-server approvals answered through the gate"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1110
topic: null
branch: null
created: 2026-10-22T15:16:11.398Z
updated: 2026-10-22T15:16:11.398Z
---

## Summary

The Codex adapter reports its app-server's approval requests as records and answers them through the gate. It closes a record when `serverRequest/resolved` says another client answered, and `approvalRelay` becomes `reliable` for Codex.

## Parent

E-414 (§3.8 "The Codex relay"; tracer step 2).

## What to build

The Codex adapter is already a client of each session's app-server. Each `item/commandExecution/requestApproval` and `item/fileChange/requestApproval` it receives now becomes a record. A command request carries the command with its cwd and reason; a file change carries the paths and the change as Codex reports them. The record is keyed by that request and offers three choices: Approve once (`accept`), Always for this command (`acceptForSession`, Codex's grant for the session) and Deny (`decline`, so the turn continues). The adapter answers the gate by responding to the server request, which needs the app-server client to gain a response call. A Deny is always `decline`. Codex carries no note, so the note goes to the session's topic through the gate.

`serverRequest/resolved` for a request the hub did not answer closes its record as answered in the harness. On a reconnect, the requests the app-server replays rebuild the same records. The adapter checks every request field it relies on. A request that fails the check becomes a record answered in the TUI, with a warn-level event. The capability table reads `approvalRelay: reliable` for Codex. Refresh the Neovim recordings that carry the capability table; if the OpenCode relay lands first, merge dev and refresh again.

Bring the fake Codex in line with the protocol as the research read it:
- one request id goes to every subscriber, and `serverRequest/resolved` names that id;
- the client's decision is read: the command runs, and the run is logged, only on accept, and a decline continues the turn without running it;
- pending requests are replayed to a connection that subscribes later;
- its own TUI path (the `approve` file and SIGUSR1) answers as another client would.

The scripted app-server double also takes responses.

## Acceptance criteria

- [ ] C1. Through the scripted app-server, a command request becomes one record answered in the hub, with the command, its cwd, its three choices and `pending` (test).
- [ ] C2. Approve once, Always for this command and Deny reach the app-server as `accept`, `acceptForSession` and `decline` responses to that request's id. A Deny never reaches it as anything else (test).
- [ ] C3. A file-change request becomes a record of kind file change, and its answer reaches the app-server the same way (test).
- [ ] C4. `serverRequest/resolved` for a request no hub client answered closes its record as answered in the harness, and every client reads that outcome (test).
- [ ] C5. A request missing a field the adapter relies on becomes a record answered in the TUI, with a warn-level event (test).
- [ ] C6. After the adapter's connection drops and returns, the replayed pending request keeps the same record id, and an answer given then reaches the app-server (test).
- [ ] C7. The capability table reads `approvalRelay: reliable` for Codex (test).
- [ ] C8. A targeted run of the Codex contract file, with its receipt posted in the item topic, shows through the fake binary that Approve once runs the command and Deny does not (test).
- [ ] C9. `hub/README.md`'s Codex capability row describes the relay, the three choices and their Codex decisions, and where the note goes (docs).
