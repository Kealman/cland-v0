---
id: T-285
kind: task
title: "Acting from an inbox row: r replies, d declines or marks read, A the archive"
state: open
status: backlog
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-274
blocked_by:
  - T-284
topic: null
branch: null
created: 2026-10-12T11:57:19.680Z
updated: 2026-10-12T11:58:16.524Z
---

## Summary

The human acts on inbox rows without leaving the inbox: `r` replies from a row, `d` declines a request (its sender is told) or marks a message read, and `A` shows the inbox archive, what left in the last seven days and why. `cland inbox --archive` prints the archive.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**`r` replies from a row.** On a request or a message row, `r` opens the composer on the row's topic as a reply to that message. Sending it makes the row leave as `replied` (a request) or `answered` (a message), by the leave rules the first ticket built. On an ask, `r` gives the free answer, like `i`. On a command approval, it says the approval is answered in the session.

**`d` removes a row.**

- On a request, `d` declines it. The hub records the decline and journals the departure as `declined`. It sends the request's sender one line from the hub saying the human declined the request and naming it. The row leaves.
- On a message, `d` marks that one message read and journals `read`. Other messages in the same topic keep their rows.
- On an ask, a command approval or a plan approval, `d` refuses in the status line and says how that row is answered.

The hub gains the frames for decline and mark-read, refusing an unknown or already-left row by name. Both are the human's alone in the permission table. The decline notice reaches the sender after a hub restart if the sender was offline, as other queued deliveries do.

**`A` shows the archive.** `A` in the inbox toggles the archive below the sections: the rows that left in the last seven days, newest first, each with its kind, its subject, its first line, when it left and why (`answered`, `approved`, `replied`, `declined`, `read`, or the state a withdrawn ask or a closed plan left with). `inbox.list` with `archive: true` returns them. The archive survives a hub restart and does not read the whole journal. `A` takes over the key that today shows the inbox's archive layer (T-191); that toggle goes, by the Coordinator's decision of 2026-10-12. When the archive is hidden, a line below the sections reads "▸ archive · N rows left today · A". This line also shows in the empty state.

**The CLI.** `cland inbox --archive` prints the archive, one line per row with when it left, its kind, its subject, its first line and its reason, newest first. `--json` with it prints the frame.

**Demo.** A session's request waits in the inbox. `d` on its row sends the sender the decline, the chip drops by one, and `A` lists the row as `declined`. `cland inbox --archive` prints the same row.

Out of scope: the events view and the events line; the retirement of the notification list. Until that retirement, `d` on a v0.1.1 notification row still dismisses it and `D` still dismisses all.

**Constraints.**

- Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project) and the fake harnesses second. Neovim runs headless on the stub hub from the protocol's other side.
- No new seams inside the hub.
- Neovim is the host with no plugins (ADR 0005).
- Every key goes through the action registry.
- Suites run through `cland verify`.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.
- Declines, read marks and the archive survive a hub restart.

## Acceptance criteria

- [ ] `r` on a request or message row opens the composer as a reply in the row's topic, and sending it removes the row with reason `replied` or `answered`.
- [ ] `d` on a request declines it: its sender receives one hub line naming the declined request, the row leaves and needsYou drops; `d` on a message marks only that message read; `d` on an ask or an approval refuses with how to answer it.
- [ ] `A` shows the rows that left in the last seven days with when and why, and hides them again; the archive line shows how many rows left today, in the empty state too.
- [ ] `cland inbox --archive` prints the same rows with their reasons, and both the archive and a decline survive a hub restart.
- [ ] Targeted tests pass (hub frame tests on a real hub with a real spoke receiving the decline, the CLI on a temporary project, nvim headless tests on the stub hub), and `hub/README.md` and `nvim/README.md` describe the frames, `r`, `d`, `A` and `--archive`.
