---
id: T-1112
kind: task
title: "The OpenCode relay: permissions answered through the gate"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1110
topic: null
branch: null
created: 2026-10-22T15:16:11.536Z
updated: 2026-10-22T23:07:33.722Z
---

## Summary

The OpenCode adapter reports `permission.asked` as records, answers them on the permission reply endpoint through the gate, and closes them on `permission.replied`. `approvalRelay` becomes `reliable` for OpenCode.

## Parent

E-414 (§3.8 "The OpenCode relay"; tracer step 3).

## What to build

Each `permission.asked` the OpenCode adapter tracks becomes a record of the parent session, whether it comes from the session or one of its children. The record carries the action, the full shell command read from the tool part where the action is one, and the resources. It offers three choices: Approve once (`once`), Always for this command (`always`, OpenCode's own wider grant) and Deny (`reject`). The adapter answers the gate with `POST /api/session/{id}/permission/{requestID}/reply` on the session that asked, sending the decision with the note as its message. A Deny is always `reject`.

`permission.replied` closes the record. When another client, an attached TUI, replied, the record takes the harness's reply as its outcome. A reply the server refuses as not found leaves the outcome to that event. At a reconnect, the pending permissions in the snapshot rebuild the same records, and a permission answered while the stream was down closes its record. The adapter checks every field it relies on. A permission that fails the check becomes a record answered in the TUI, with a warn-level event. The permission's private metadata never enters a record. The capability table reads `approvalRelay: reliable` for OpenCode. Refresh the Neovim recordings that carry the capability table; if the Codex relay lands first, merge dev and refresh again.

The fake OpenCode logs the decision and the message each reply carries. The scripted transport double takes replies.

## Acceptance criteria

- [ ] C1. A scripted `permission.asked` with a shell tool part becomes one record answered in the hub, with the full command, its three choices and `pending` (test).
- [ ] C2. Approve once, Always for this command and Deny with a note reach the reply endpoint as `once`, `always` and `reject`, with the note as the message (test).
- [ ] C3. `permission.replied` from another client closes the record with that reply as the harness's outcome, and every client reads it (test).
- [ ] C4. A child session's permission is a record of the parent session, and its answer goes to the child's endpoint (test).
- [ ] C5. After the event stream reconnects, the snapshot's pending permission keeps the same record id, and a permission answered while the stream was down reads as closed (test).
- [ ] C6. A permission missing a field the adapter relies on becomes a record answered in the TUI, with a warn-level event, and the permission's private metadata never reaches a frame (test).
- [ ] C7. The capability table reads `approvalRelay: reliable` for OpenCode (test).
- [ ] C8. A targeted run of the OpenCode contract file, with its receipt posted in the item topic, shows through the fake binary that a Deny with a note reaches the fake as `reject` with that note (test).
- [ ] C9. `hub/README.md`'s OpenCode capability row describes the relay, the three choices and their OpenCode replies, and that the note travels as the reply's message (docs).
