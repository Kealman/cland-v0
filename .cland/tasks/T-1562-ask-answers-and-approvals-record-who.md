---
id: T-1562
kind: task
title: Ask answers and approvals record who answered
state: open
status: in progress
size: S
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1560
  - T-1561
topic: topic-1307
branch: t/T-1562-ask-answers-and-approvals-record-who
created: 2026-10-31T23:47:50.788Z
updated: 2026-11-01T20:04:59.362Z
---

## Summary

In users mode an ask's and an approval's outcome records the answering user's id, with `by` set to that user's name. The first answer still wins, and the journal's `ask-answered` and `inbox-departure` records carry the user id. Both workbenches show the name wherever they show `by` today.

Hot files: `hub/src/hub/asks.ts`, `hub/src/hub/inbox.ts` [Host] (approval outcome), `hub/src/hub/dispatch.ts` [Host] (`topic.answer`, `approval.answer`), `hub/src/protocol.ts` [Host] (`AskOutcome`, `ApprovalOutcome` gain `userId`), `web/src/ApprovalCard.tsx`, `nvim/lua/cland/inbox.lua`.

## Acceptance criteria

- [x] C1. An ask answered by a user in users mode has an outcome whose `by` is that user's name and whose `userId` is that user's id.
  - done: impl-1562 · 2026-11-01T20:01:38.824Z
- [x] C2. An approval answered by a user has an outcome whose `by` and `userId` name that user.
  - done: impl-1562 · 2026-11-01T20:01:44.637Z
- [x] C3. When two users answer one ask, the first answer wins and the second is refused with a message naming the first answerer.
  - done: impl-1562 · 2026-11-01T20:01:49.316Z
- [x] C4. The journal's `ask-answered` and `inbox-departure` records carry the answering user's id.
  - done: impl-1562 · 2026-11-01T20:01:50.898Z
- [x] C5. The web approval card and Neovim's inbox show the answering user's name in users mode, and "the human" in single mode as today.
  - done: impl-1562 · 2026-11-01T20:01:51.986Z
- [x] C6. Single-mode outcomes, including stand-in attribution, are unchanged.
  - done: impl-1562 · 2026-11-01T20:04:27.796Z
- [ ] C7. In users mode, the answer message an ask answer posts carries the answering user, the same user as the outcome's `by` and `userId`; a two-user test proves the outcome and the message agree.
  - failed: rev-37 [reviewer] · 2026-11-01T20:04:59.362Z · note Admitted answering user is not forwarded to the generated answer message; integration and two-user equality regression await T-1561 landing.

## Comments

### impl-1562 · 2026-11-01T19:56:14.825Z

Consumer scan (AskOutcome, ApprovalOutcome, ask-answered, inbox-departure, outcome.by plus answer entry points): hub protocol and shared/wire declarations; asks/dispatch/inbox producers; Store ask/inbox JSON persistence; core callback; adapters/session implementations and fake harness native outcomes; remote cards, Telegram/Discord renderers/outboxes/gateway; Web AskCard/ApprovalCard/store/notifications; Neovim inbox/store and fixture frames. Tests across hub/web/nvim include asks, ask-chain, approval-records/restart, inbox requests/actions/workload, gateway, Telegram/Discord cards/approvals/render, remote-via; QA/skills/startup searches included. Additive optional userId leaves legacy native/remote callers and persisted outcomes valid; both workbenches already display arbitrary by names. No caller-provided userId is trusted. New T2 authenticated cookie/frame regression is red-first: observed human != alex, missing winner name, missing journal userId, then approval human != alex; same single-mode case stays green.

### impl-1562 · 2026-11-01T19:59:35.921Z

Consumer scan published as A-15373 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15373-t-1562-outcome-contract-consumer-scan.txt). Named existing preservation checks for queued verification: hub/test/ask-outcomes.test.ts (single and stand-in outcomes), hub/test/approval-records.test.ts (native approvals), hub/test/approval-restart.test.ts. Local runs stay limited to touched files as brief directs. No role-clause line or new request field/permission is needed; help, Browser sign-in docs and implement skill updated.

### rev-37 · 2026-11-01T20:03:25.782Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1562-source-1
commit: c7df2ef34a064bdb25226a574b4636c74c97b30f
scope: full
findings: [{"severity":"medium","text":"Changed INBOX_USAGE and TOPIC_USAGE lack corresponding frozen commands.json entries (lines44/46). Existing cli-usage-compatibility full deepEqual/aggregate help readers reject these bytes. Migrate only matching independent blocks and inventory consumers; keep full assertions.","file":"hub/src/cli/usage/inbox.ts","line":2}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. Standards medium: inbox.ts:2/topic.ts:2 changed help without migrating frozen commands.json INBOX_USAGE/TOPIC_USAGE; full cli-usage-compatibility deepEqual necessarily mismatches. Source comparison only; no executed failure claimed. Spec outcome behavior otherwise appears correct: trusted transport user, captured approval identity, named ask loser, journal attribution, old optional wire and arbitrary-name UI renderers. C1–C5 runtime evidence unverified; C6 failed for existing compatibility consumer. A-15382 contains review; A-15381 targeted local checks do not replace full verification. Fix/new head requires fresh source review before mode-free verify. No Reviewer tests/browser.

Criteria: C6 failed (Existing single-mode CLI compatibility regression will fail: changed topic/inbox help bytes differ from independent frozen usage fixture.).

### impl-1562 · 2026-11-01T20:03:51.458Z

Review rev-37-1562-source-1 found frozen usage consumers omitted from inventory: hub/test/fixtures/cli-usage/commands.json INBOX_USAGE/TOPIC_USAGE, cli-usage-fixture.ts (frozenUsage/frozenHelp projection), cli-usage-compatibility full deepEqual, cli-usage export inventory, cli-help/cli-command-help aggregate output, cli-usage-merge fixture merging. Migrating only two frozen command blocks; exports.json and help.txt retain the same export placeholders, aggregate consumers need no code/assertion change. No verification submitted at rejected source head.

### rev-37 · 2026-11-01T20:04:59.362Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1562-source-2
commit: 5c7c4c1898d663ca3ced6d3256e860e3ecf25069
scope: full
findings: [{"severity":"medium","text":"New C7 remains pending: answering user is not passed to sendFromHuman port/core callback. With T-1561 the emitted answer message defaults to first user while outcome names the answering second user. Coordinator sequences fix/equality regression after T-1561 landing.","file":"hub/src/hub/asks.ts","line":255}]
finding_counts: {"high":0,"medium":1,"low":0}

Requested fixture-finding clearance: original medium help mismatch resolved. Delta from c7df2ef34 contains only matching independent INBOX_USAGE/TOPIC_USAGE updates; assertions/aggregate composition retained, inventory supplemented. Standards no remaining findings in delta. Whole-item source remains not clear for newly added C7 pending integration, per Coordinator sequencing; this is not permission to verify. Asks.ts:255 still drops admitted user on generated answer message. Authorized post-landing dev merge/fix/regression need fresh source review. Other runtime criteria unverified. No Reviewer test execution; local compatibility1/help5 reported targeted macOS Node evidence only.

Criteria: C7 failed (Admitted answering user is not forwarded to the generated answer message; integration and two-user equality regression await T-1561 landing.).
