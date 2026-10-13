---
id: T-283
kind: task
title: The request send kind and needsYou over the inbox's four kinds
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - nvim
  - ready-for-agent
assignee: null
parent: E-274
blocked_by: []
topic: topic-171
branch: t/T-283-the-request-send-kind-and-needsyou-over
created: 2026-10-12T11:57:19.566Z
updated: 2026-10-12T14:30:47.426Z
closed: 2026-10-12T14:30:48.089Z
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

- [x] C1. `send` with `kind: "request"` to the human, a `request` of `review`, `qa` or `handover` and a known subject is accepted from any role, including one the human did not mention; with addressees, a bad request value or a missing subject it is refused with a reason naming the fix.
  - done: impl-283 · 2026-10-12T12:34:35.258Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-2 · 2026-10-12T12:49:29.761Z · commit 18a0fa908cad4f21a56473b678e6f97f0b959cee
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-3 · 2026-10-12T13:07:53.274Z · commit 579364c6edb768dea2ef733974bef2f2581c8950
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-5 · 2026-10-12T13:27:48.065Z · commit 07511e7e08872b63bf47499f78aa75f19d547bdc
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-7 · 2026-10-12T13:45:26.281Z · commit aed0622321be0ab2e5e5779f02ced6dbd4e00b82
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-9 · 2026-10-12T14:14:56.936Z · commit d44a2c8ef6735088c356f1f5c0756d5a983d86be
- [x] C2. `inbox.list` returns the four kinds newest first with a waiting start on every row, and needsYou equals their total (asks and command approvals, pending plans under `approval = "human"`, open requests, now-layer messages to the human including a waiting topic's latest message).
  - done: impl-283 · 2026-10-12T12:48:09.736Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-2 · 2026-10-12T12:49:29.761Z · commit 18a0fa908cad4f21a56473b678e6f97f0b959cee
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-3 · 2026-10-12T13:07:53.274Z · commit 579364c6edb768dea2ef733974bef2f2581c8950
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-5 · 2026-10-12T13:27:48.065Z · commit 07511e7e08872b63bf47499f78aa75f19d547bdc
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-7 · 2026-10-12T13:45:26.281Z · commit aed0622321be0ab2e5e5779f02ced6dbd4e00b82
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-9 · 2026-10-12T14:14:56.936Z · commit d44a2c8ef6735088c356f1f5c0756d5a983d86be
- [x] C3. Each leave rule removes its row and lowers needsYou: an answered ask, an approval granted in the session, an approved plan, a reply or a human verdict on a request's subject, a message read through `topic.read` or answered in its topic; each departure is journaled with its reason.
  - done: impl-283 · 2026-10-12T12:34:36.120Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-2 · 2026-10-12T12:49:29.761Z · commit 18a0fa908cad4f21a56473b678e6f97f0b959cee
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-3 · 2026-10-12T13:07:53.274Z · commit 579364c6edb768dea2ef733974bef2f2581c8950
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-5 · 2026-10-12T13:27:48.066Z · commit 07511e7e08872b63bf47499f78aa75f19d547bdc
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-7 · 2026-10-12T13:45:26.281Z · commit aed0622321be0ab2e5e5779f02ced6dbd4e00b82
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-9 · 2026-10-12T14:14:56.936Z · commit d44a2c8ef6735088c356f1f5c0756d5a983d86be
- [x] C4. After `cland hub stop` and a new start, a left row stays gone, a read message stays read and a waiting request is still counted.
  - done: impl-283 · 2026-10-12T12:34:36.235Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-2 · 2026-10-12T12:49:29.761Z · commit 18a0fa908cad4f21a56473b678e6f97f0b959cee
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-3 · 2026-10-12T13:07:53.274Z · commit 579364c6edb768dea2ef733974bef2f2581c8950
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-5 · 2026-10-12T13:27:48.066Z · commit 07511e7e08872b63bf47499f78aa75f19d547bdc
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-7 · 2026-10-12T13:45:26.281Z · commit aed0622321be0ab2e5e5779f02ced6dbd4e00b82
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-9 · 2026-10-12T14:14:56.936Z · commit d44a2c8ef6735088c356f1f5c0756d5a983d86be
- [x] C5. The headless workbench's chip equals `cland inbox`'s needs-you count before and after the reply of the demo.
  - done: impl-283 · 2026-10-12T12:34:36.352Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-2 · 2026-10-12T12:49:29.761Z · commit 18a0fa908cad4f21a56473b678e6f97f0b959cee
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-3 · 2026-10-12T13:07:53.275Z · commit 579364c6edb768dea2ef733974bef2f2581c8950
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-5 · 2026-10-12T13:27:48.066Z · commit 07511e7e08872b63bf47499f78aa75f19d547bdc
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-7 · 2026-10-12T13:45:26.282Z · commit aed0622321be0ab2e5e5779f02ced6dbd4e00b82
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-9 · 2026-10-12T14:14:56.936Z · commit d44a2c8ef6735088c356f1f5c0756d5a983d86be
- [x] C6. Targeted tests pass (hub frame tests on a real hub with the CLI, the fake harnesses for the approval, nvim headless tests on the stub hub for the chip), and `hub/README.md` documents the `request` kind, the four kinds and the leave reasons.
  - done: impl-283 · 2026-10-12T14:13:52.629Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-283-9 · 2026-10-12T14:14:56.936Z · commit d44a2c8ef6735088c356f1f5c0756d5a983d86be

## Comments

### impl-283 · 2026-10-12T12:26:20.064Z

Implemented explicit request fields and human-only validation, four-kind needsYou, SQLite wait/departure records and existing read watermarks. Targeted real daemon/MCP/CLI tests pass for validation, replies, restart persistence, independent message reads, plans, asks and fake Claude command approvals. Headless stub protocol demo passes with the chip equal to real cland inbox snapshots before/after an Aide request reply. Preparing docs, regression checks and exact-head review.

### rev-23 · 2026-10-12T12:43:24.720Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-1
commit: 3990794853911564b0f7203388ab878dab4b96a3

Medium: hub/src/hub/store.ts:1266 (also 1272) computes latest across all records before excluding progress/event/hub rows. In a waiting-for-human topic with no open ask, append such an excluded row after the eligible unread agent report: inbox.ts:259–261 stops counting the report, the excluded row cannot replace it, and needsYou falls while the topic still waits. No read/answer departure is journaled. Select the latest eligible message using the same exclusions and cover this append/count/leave sequence through the real-hub frame protocol. Source trace is pinned to 3990794; the later approval-sorting commit b2d8583 does not change this finding.
Standards: no actionable findings. Other criteria and reported targeted passes inspected; full verify remains held for the canonical unrelated roles.test.ts fix. C2 failed; no verified marks on this verdict.
Evidence A-1512: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1512-t-283-review-not-clear-at-3990794.md.

Criteria: C2 failed (Latest-message selection includes excluded progress/hub records, which can hide the unread message of a waiting topic and lower needsYou without a read or answer.).

### rev-23 · 2026-10-12T12:49:29.762Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-2
commit: 18a0fa908cad4f21a56473b678e6f97f0b959cee

No findings. A-1512's C2 issue is resolved: the shared latest_messages CTE excludes progress/event/request/ask records before selecting the latest eligible ordinary message for both flags and admission. The real-daemon regression preserves the original waiting report/count after progress and a hub notice, then confirms exactly one read departure. Approval sorting now uses restored durable since values. Canonical 811f0d2 matches 06371a7's stable patch-id unchanged; exact assertions retain all prior fields and add permissions:null. C1–C6 checked at this head using the full review, this delta and updated targeted evidence A-1515 (hub 9/9 and typecheck), plus original A-1509 headless/CLI/ask/plan evidence. Worktree clean. A-1516: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1516-t-283-review-clear-at-18a0fa9.md. Full cland verify all remains pending; no full-suite pass is claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-23 · 2026-10-12T13:07:53.275Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-3
commit: 579364c6edb768dea2ef733974bef2f2581c8950

No findings from the merge with reviewed T-286. Request validation/fields, durable inbox projection and latest-eligible-message fix are retained; Events protocol/log publication and notification subjects coexist with them. Human-verdict settlement and journal wiring remain present. Store/tracker/request tests are unchanged from clear 18a0fa9. Events code/tests are unchanged from reviewed 95ea58e, with inbox-departure retained in the journal filter. C1–C6 rechecked and reverified at this exact head using A-1516/A-1515/A-1509 and merged-head A-1520 targeted evidence (typecheck; hub requests 9/9; hub events 3/3; headless requests 1/1; headless events 2/2). Clean worktree confirmed. Evidence A-1521: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1521-t-283-merged-head-review-clear-at-579364c.md. Replacement full cland verify remains pending; no full-suite pass claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-23 · 2026-10-12T13:25:25.391Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-4
commit: 579364c6edb768dea2ef733974bef2f2581c8950

Medium: hub/test/visibility.test.ts:244 (also 248) leaves the Direct human report from line 203 unread, then asserts needsYou zero while checking watch-layer verdict notifications. T-283 correctly counts the report; the fixture needs an explicit topic.read after the message placement assertions to isolate the notification checks and preserve their zero-count assertions. Do not delete/skip/weaken these checks. No new production defect found.
Full cland verify defdc637 at this exact head exited 1: 1344 tests, 1343 pass, one failure, no skips; the failed hub phase prevented full Neovim verification. C6 failed pending repair and verification of the corrected candidate. Evidence A-1524: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1524-t-283-full-verification-failure-at-579364c.md; durable suite log A-1523. No rerun by Reviewer.

Criteria: C6 failed (Full verification fails visibility.test.ts:244: its unread direct human report correctly contributes needsYou 1, while the legacy fixture still asserts zero.).

### rev-23 · 2026-10-12T13:27:48.066Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-5
commit: 07511e7e08872b63bf47499f78aa75f19d547bdc

No findings. The seven-line visibility fixture addition checks the required unread message/count, reads General through topic.read, and checks zero before the existing notification assertions. All prior assertions remain unchanged; no production delta. A-1524's C6 finding is resolved. A-1525 reports the focused regression passes after correction and the complete visibility file passes 15/15. C1–C6 checked at this exact head using the prior full/merge reviews and the new fixture evidence. Worktree clean. A-1526: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1526-t-283-fixture-delta-review-clear-at-07511e7.md. Replacement full cland verify remains pending; no full-suite pass claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-23 · 2026-10-12T13:42:42.126Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-6
commit: 07511e7e08872b63bf47499f78aa75f19d547bdc

Medium: hub/test/codex-adapter.test.ts:934 reads the journal after an Agents message without awaiting append completion. Journal.write is async and agentsRecord publishes in a microtask; receiving the notice does not guarantee the failure record is on disk. Full verify 9d513177 saw zero matches at line 935 (expected one). Before the read, request and assert successful existing hub.status with flushLogs:true, preserving every record/absence/notification/sender assertion; no new seam, timeout or test retry needed. No new production defect established; adapter/test are unchanged from green T-286 95ea58e. This failure is consistent with the missing barrier, but source review does not establish whether the record became visible later.
C6 failed: full verify exit 1, 1343/1344 passed; full Neovim phase not reached. Earlier visibility failure is absent. Evidence A-1528: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1528-t-283-recovery-journal-evidence-failure-at-07511e7.md; log A-1527. No rerun by Reviewer.

Criteria: C6 failed (Full verification fails codex-adapter.test.ts:935: journal read after an Agents notice lacks a barrier for asynchronous accepted appends.).

### rev-23 · 2026-10-12T13:45:26.282Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-7
commit: aed0622321be0ab2e5e5779f02ced6dbd4e00b82

No findings. The two-line delta awaits/asserts existing hub.status flushLogs:true before the recovery journal read, closing A-1528's append-ordering gap. All exact record/no-record/notification/sender checks remain unchanged. No production delta, new seam, polling or timeout change. C1–C6 checked for this exact head using prior full/merge/fixture evidence and A-1529's focused barrier checks. Worktree clean. A-1530: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1530-t-283-journal-barrier-delta-clear-at-aed0622.md. Replacement full cland verify remains pending; no full-suite pass claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-23 · 2026-10-12T14:12:25.949Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-8
commit: aed0622321be0ab2e5e5779f02ced6dbd4e00b82

Medium: nvim/test/sessions.test.ts:138 reads hub.log immediately after the panel shows death, without draining asynchronous processJournal appends. The log read lacks harness-exited. Use existing connectUi and assert successful hub.status {flushLogs:true} before log reads; launch/stop log assertions at lines 116/148 share this gap. Preserve all original screen, launch, attach, death and stop assertions, with no new seam/polling/retry/timeout increase. No new production defect established; Sessions.#exited enqueues the log in the same synchronous continuation as state publication, but disk completion follows later.
C6 failed: full verify 90c65cd6 exited 1 with 1637/1638 passing, zero skips. Hub phases passed, including prior fixes; one Neovim process-log assertion failed. Evidence A-1532: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1532-t-283-neovim-process-log-evidence-failure-at-aed0622.md; full log A-1531. No rerun by Reviewer.

Criteria: C6 failed (Full verification fails nvim/test/sessions.test.ts:138: process-log read after UI death state lacks a barrier for asynchronous log appends.).

### rev-23 · 2026-10-12T14:14:56.936Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-283-9
commit: d44a2c8ef6735088c356f1f5c0756d5a983d86be

No findings. The sole test-file delta uses existing connectUi and asserts successful hub.status flushLogs:true before each launch/death/stop process-log read. All original screen, attach and log assertions remain unchanged. A-1532's missing process-log barriers are resolved with no production/shared-helper/polling/retry/timeout change. C1–C6 checked for this exact head using prior source/delta evidence and A-1533's final barrier checks (complete sessions file 2/2). Worktree clean. A-1534: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1534-t-283-process-log-barrier-delta-clear-at-d44a2c8.md. Previous full run passed all hub tests and 1637/1638 total; replacement full verify remains pending, with no full-suite green claimed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-12T14:30:47.426Z

Merged ab772d8aafe350b092eb62782df9fbdb78fe01cb onto dev.
