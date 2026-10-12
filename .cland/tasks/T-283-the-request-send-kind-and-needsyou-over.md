---
id: T-283
kind: task
title: The request send kind and needsYou over the inbox's four kinds
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: T-274
blocked_by: []
topic: topic-171
branch: t/T-283-the-request-send-kind-and-needsyou-over
created: 2026-10-12T11:57:19.566Z
updated: 2026-10-12T12:00:33.993Z
---

## Summary

Sessions can send the human a `request` (a review, a QA run or a handover), and the hub's needsYou grows from asks, approvals and waiting topics to the four kinds of spec v0.1.2 §3.7, each leaving by its rule and each departure journaled with its reason. The chip in the workbench counts the new needsYou with no Neovim redesign yet.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**The `request` send kind.** `send` accepts `kind: "request"` only when the message is addressed to the human (no `to`, or an empty `to`). It then requires a `request` field of `review`, `qa` or `handover` and a `subject` naming an item (`T-n`), an artifact (`A-n`) or a session name. Every other combination is refused with a reason that names the fix (a request with addressees, an unknown request value, a missing or unknown subject, `request`/`subject` on another kind). Any session may send a request, whatever its role. This is an exception to the rule that only the Coordinator, an Aide or a session the human just mentioned writes to the human, and it covers the `request` kind only (the Coordinator's decision of 2026-10-12). The message goes to the topic the sender names, General by default. The MCP `send` tool in the spoke takes the two new fields and describes them. `SEND_KINDS`, the refusal text and `hub/README.md`'s `send` section name the new kind. The mockup's older idea of feeding requests from first lines ("review request", "qa request") is superseded: the explicit kind wins, and no first line is parsed.

**needsYou over four kinds.** `inbox.list` and the pushed `inbox` event carry the four now-layer kinds, newest first within each, and needsYou equals their total:

1. Asks and approvals: the human's open asks (as today) and the sessions waiting for a command approval (as today), together. An approval row carries the command it waits on when the harness reported one.
2. Plan approvals: every open epic whose valid plan waits for approval under `[plan] approval = "human"` (the tracker's `approval.state` is `pending`). With `[plan] approval = "none"` no plan row exists.
3. Requests: every `request` message not yet left, with its sender, its role, its request value, its subject, its topic and its time.
4. Messages: one row per message a session addressed to the human that the hub places in the now layer, excluding progress notes, hub events, asks and requests; a topic waiting for the human without an open ask contributes its latest message as a row (it replaces today's `waiting` list as the source of that count).

Every row carries the instant it began to wait, so the UI can show its age.

**Leave rules.** A row leaves the inbox, and needsYou drops, when:

- an ask is answered (`answered`); an ask withdrawn or cancelled leaves with that state as its reason (`withdrawn`, `cancelled`);
- a command approval's session stops waiting for approval (`approved`);
- a plan is approved in the plan view or through `task plan approve` (`approved`), or the epic closes or its plan stops being valid (the plan's own state as the reason: `closed`, `invalidated`);
- a request gets the human's reply, meaning a human message replying to it or any later human message in its topic (`replied`), or a review or QA verdict the human writes on the request's subject item (`replied`);
- a message's topic is read past it through the existing `topic.read` (`read`), or the human posts in its topic after it (`answered`).

Each departure is logged to the journal as one record with the row's kind, its id, its subject and its reason, through the hub's existing log tap. The hub also keeps it where the inbox archive of a later ticket can list seven days of departures without reading the whole journal. The read marks and the departures are stored in `hub.db`, so a hub restart neither brings a left row back nor drops a waiting one. Removing a row with `d` (decline, mark read) is a later ticket; the frames it needs are out of scope here.

**Neovim.** The chip in the top bar already shows the hub's needsYou. It must keep doing so with the new frame shape. The current inbox renderer must tolerate the new lists without errors (it may ignore them until the four sections land). The stub hub learns the new `Inbox` shape so the headless tests can drive it.

**Demo.** In a scratch project with the fake harnesses, an Aide sends a `request` of kind review on an item to the human: `cland inbox` ends with a needs-you count one higher, and the headless workbench's chip shows the same. The human replies in the request's topic: the count drops by one, and `cland hub journal` shows the departure with reason `replied`.

Out of scope: the four sections' drawing and `cland inbox`'s new layout (the next ticket); `r`, `d` and `A` (the ticket after); the events view; the retirement of the notification list. The `notifications` list in the frame stays as it is.

**Constraints.**

- Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project, `hub/test/harness.ts`) and the fake harnesses second; Neovim headless on the stub hub from the protocol's other side. Keep new test helpers in the new test files, not in the shared harness: the hub lane (T-268) is rewriting the harness's process and fixture handling at the same time.
- No new seams inside the hub.
- Suites run through `cland verify`.
- Commit on the task branch and push it to `origin`, the local territory; `dev` only through `cland merge`.
- English everywhere.
- The leave rules and read marks survive a hub restart.

## Acceptance criteria

- [ ] `send` with `kind: "request"` to the human, a `request` of `review`, `qa` or `handover` and a known subject is accepted from any role, including one the human did not mention; with addressees, a bad request value or a missing subject it is refused with a reason naming the fix.
- [ ] `inbox.list` returns the four kinds newest first with a waiting start on every row, and needsYou equals their total (asks and command approvals, pending plans under `approval = "human"`, open requests, now-layer messages to the human including a waiting topic's latest message).
- [ ] Each leave rule removes its row and lowers needsYou: an answered ask, an approval granted in the session, an approved plan, a reply or a human verdict on a request's subject, a message read through `topic.read` or answered in its topic; each departure is journaled with its reason.
- [ ] After `cland hub stop` and a new start, a left row stays gone, a read message stays read and a waiting request is still counted.
- [ ] The headless workbench's chip equals `cland inbox`'s needs-you count before and after the reply of the demo.
- [ ] Targeted tests pass (hub frame tests on a real hub with the CLI, the fake harnesses for the approval, nvim headless tests on the stub hub for the chip), and `hub/README.md` documents the `request` kind, the four kinds and the leave reasons.
