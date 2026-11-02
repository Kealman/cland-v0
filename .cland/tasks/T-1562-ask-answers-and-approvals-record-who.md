---
id: T-1562
kind: task
title: Ask answers and approvals record who answered
state: closed
status: done
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
updated: 2026-11-02T02:39:54.870Z
closed: 2026-11-02T02:39:54.870Z
---

## Summary

In users mode an ask's and an approval's outcome records the answering user's id, with `by` set to that user's name. The first answer still wins, and the journal's `ask-answered` and `inbox-departure` records carry the user id. Both workbenches show the name wherever they show `by` today.

Hot files: `hub/src/hub/asks.ts`, `hub/src/hub/inbox.ts` [Host] (approval outcome), `hub/src/hub/dispatch.ts` [Host] (`topic.answer`, `approval.answer`), `hub/src/protocol.ts` [Host] (`AskOutcome`, `ApprovalOutcome` gain `userId`), `web/src/ApprovalCard.tsx`, `nvim/lua/cland/inbox.lua`.

## Acceptance criteria

- [x] C1. An ask answered by a user in users mode has an outcome whose `by` is that user's name and whose `userId` is that user's id.
  - done: impl-1562 · 2026-11-01T20:01:38.824Z
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-1 · 2026-11-01T22:50:13.366Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-2 · 2026-11-02T01:27:09.066Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
- [x] C2. An approval answered by a user has an outcome whose `by` and `userId` name that user.
  - done: impl-1562 · 2026-11-01T20:01:44.637Z
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-1 · 2026-11-01T22:50:13.366Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-2 · 2026-11-02T01:27:09.067Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
- [x] C3. When two users answer one ask, the first answer wins and the second is refused with a message naming the first answerer.
  - done: impl-1562 · 2026-11-01T20:01:49.316Z
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-1 · 2026-11-01T22:50:13.366Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-2 · 2026-11-02T01:27:09.067Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
- [x] C4. The journal's `ask-answered` and `inbox-departure` records carry the answering user's id.
  - done: impl-1562 · 2026-11-01T20:01:50.898Z
  - verified: rev-37 [reviewer] · run rev-37-1562-source-3 · 2026-11-01T22:31:54.520Z · commit 6532d5917ebd167aa460b95ebdbdd5438fa8fea2
  - verified: rev-37 [reviewer] · run rev-37-1562-source-4 · 2026-11-01T22:32:17.628Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-1 · 2026-11-01T22:50:13.366Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-delta-1 · 2026-11-02T01:07:39.809Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-2 · 2026-11-02T01:27:09.067Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
- [x] C5. The web approval card and Neovim's inbox show the answering user's name in users mode, and "the human" in single mode as today.
  - done: impl-1562 · 2026-11-01T20:01:51.986Z
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-1 · 2026-11-01T22:50:13.366Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-2 · 2026-11-02T01:27:09.067Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
- [x] C6. Single-mode outcomes, including stand-in attribution, are unchanged.
  - done: impl-1562 · 2026-11-01T20:04:27.796Z
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-1 · 2026-11-01T22:50:13.366Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-2 · 2026-11-02T01:27:09.067Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
- [x] C7. In users mode, the answer message an ask answer posts carries the answering user, the same user as the outcome's `by` and `userId`; a two-user test proves the outcome and the message agree.
  - done: impl-1562 · 2026-11-01T22:30:14.973Z
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-1 · 2026-11-01T22:50:13.366Z · commit da3d7ef497a26c44efcc0fe2e54435fa0d421c31
  - verified: rev-37 [reviewer] · run rev-37-1562-evidence-2 · 2026-11-02T01:27:09.067Z · commit 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2

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

### impl-1562 · 2026-11-01T22:30:10.395Z

C7 integration on authorized landed dev ed81ac0be: merge conflicted only in Browser sign-in docs/skill; preserved both landed authority/message guidance and outcome text. Shared seam consumers: AsksPort.sendFromHuman, core constructor callback and HubCore.sendFromHuman (landed T-1561 optional trailing userId); only the ask callback drops id. Forward admitted id through both existing optional boundaries; other direct human-message producers remain untouched. Added response-message plus saved topic.history equality assertions against the outcome in answer-users. Red: actual jane-doe != expected alex at posted.from; green after propagation: both single/users generated cases pass 2/2, local macOS arm64 Node24.21.0. First-answer refusal and journal assertions retained.

### rev-37 · 2026-11-01T22:31:54.520Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1562-source-3
commit: 6532d5917ebd167aa460b95ebdbdd5438fa8fea2
scope: full
findings: [{"severity":"low","text":"New change record still says 'After T-1561 lands' although this head merges that landing and implements the callback. Describe the completed edit to avoid stale future instruction (rule16).","file":".agents/skills/implement/CHANGES/T-1562-answer-users.md","line":3}]
finding_counts: {"high":0,"medium":0,"low":1}

Fresh full source clear with one low Standards wording finding; Spec no findings. Both prior mediums resolved: frozen help entries match production; admitted answering userId now travels AsksPort/core callback to landed human producer. C7 regression compares returned and saved answer authors with second-user outcome; old single-mode case retained. Optional wires, approval captured identity/settlement, named ask loser and existing arbitrary-name renderers reviewed. C4 journal id source-verified; all other runtime criteria await exact-head mode-free verify. Low: skill CHANGES:3 future 'After T-1561 lands' is stale at merged head. A-15436 macOS arm64 Node24.21.0 focused2/typecheck/lint0 supplemental only; no full tier/browser rerun. Required unedited outcome/approval/restart preservation and workbench generated cases need receipts. No Reviewer execution.

Criteria: C4 verified.

### rev-37 · 2026-11-01T22:32:17.628Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1562-source-4
commit: da3d7ef497a26c44efcc0fe2e54435fa0d421c31
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at refreshed exact head. Only diff from source-clear6532d5917 is one CHANGES prose line; prior low stale-future wording resolved. Runtime/tests unchanged, carrying forward full review rev-37-1562-source-3/A-15439. Standards/Spec no findings. C4 source reverified; remaining runtime criteria C1–C3/C5–C7 await mode-free verify at this head. No Reviewer execution or prose-only test rerun.

Criteria: C4 verified.

### rev-37 · 2026-11-01T22:50:13.366Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1562-evidence-1
commit: da3d7ef497a26c44efcc0fe2e54435fa0d421c31
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final current-head evidence clear, C1–C7 verified. A-15457 run1efd068e Finished exit0 at exact source head/tree7c223fef61539877717c432b17be73417eb462df, noncached Linux x64 droplet Node24.21.0 Neovim0.12.5, isolated Headless Shell1248 Chrome156.0.8078.4. T0/T1/all-T2/Web and selected T3 passed; mapped T4 base-only, repetitions skipped; remaining T3 deferred, no full T3/T4 claim. Aggregate4682pass,0fail/cancel/skip/todo. Independently checked named outcomes: answer-users2, ask-outcomes6, approval-records19, Neovim24 incl panel/full human/alex, phone-approvals8 incl both authors, compatibility1 all pass. A-15459 adds unchanged exact-head approval-restart1/1 native_exit0 (macOS arm64 Node24.21.0, fake harness, no browser); named restart/archive replay assertion intact. Budget/lint/ratchets report-only. No Reviewer execution; no findings. Coordinator's pending T-1563-dependent dev merge still requires fresh source delta/reverification; current evidence does not waive it.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### rev-37 · 2026-11-02T01:07:39.809Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1562-delta-1
commit: 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, no Standards/Spec findings. Authorized landed-dev merge compared both ways; README resolution preserves outcome plus incoming artifact/invite guidance. Existing C7 trusted userId port/core propagation survives; new saved-history userDisplayName assertion uses admitted id and keeps single-mode omission/equality checks. Incoming Store/live projection compatible. Prior full source review carried forward. C4 source reverified; remaining runtime criteria await fresh exact-head mode-free verify (runtime imports, no waiver). A-15508 and final lint0 receipt are targeted supplemental macOS arm64 Node24.21.0 evidence only. A-15507 exact-head unedited approval-restart named1/1 native_exit0 inspected, usable supplemental T3 evidence; not full tier. No Reviewer tests/browser.

Criteria: C4 verified.

### rev-37 · 2026-11-02T01:27:09.067Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1562-evidence-2
commit: 12bbf22a71554e8d87d5fee5f2c8766e3c0077f2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final integrated-head evidence clear; C1–C7 verified. A-15510 run51f79932 Finished exit0 at exact reviewed head/treec33978ef2ff1b0a8f13fdc3d58b371c277d1aade, noncached Linux x64 droplet Node24.21.0 Neovim0.12.5; isolated Headless Shell1248 Chrome156.0.8078.4. T0/T1/all-T2/Web plus selected T3 completed; remaining T3 deferred to batch. Mapped T4 base-only, repetitions skipped; no full T3/T4 claim. Aggregate4743pass,0fail/cancel/skip/todo. Independently checked named outcomes: answer-users2 (C7 returned/saved identity and display), unedited ask-outcomes6/approval-records19, Neovim24 human/alex panel/full, Web8 both author cases, frozen compatibility1 all pass. Deferred approval-restart covered by inspected exact-head A-15507 retained1/1 native_exit0 macOS arm64 Node24.21.0 fake-harness receipt (bound by A-15508). Budget/lint/ratchets report-only. No Reviewer execution/browser; no findings on either axis. QA after-stage.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-02T02:39:54.870Z

Merged ca366370d596c27c6859a15f86edf44cfcb7a0df onto dev.
