---
id: T-1345
kind: task
title: Telegram mute and unmute with the missed count and the mute_default key
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1343
topic: topic-1100
branch: t/T-1345-telegram-mute-and-unmute-with-the-missed
created: 2026-10-26T19:09:07.071Z
updated: 2026-10-27T05:42:02.157Z
closed: 2026-10-27T05:42:02.157Z
---

## Summary

`/mute` silences the General stream while cards and notices still arrive. `/unmute` posts one line, "N messages arrived while muted", and `[remote] mute_default` sets the state a new pairing starts in.

## What to build

Mute state per pairing in the remote tables, read by the mirror out. Spec §3.4.

## Acceptance criteria

- [x] C1. Three General messages during mute are not sent, a hub notice still is, `/unmute` posts "3 messages arrived while muted", and a new pairing starts muted when `mute_default` is true (test).
  - done: impl-1345 · 2026-10-27T04:53:38.486Z
  - verified: rev-26 [reviewer] · run rev-20261027-1345-evidence-1 · 2026-10-27T05:35:59.924Z · commit d17abba0ff0402d28aded7a8e2ed842b0edc1e72

## Comments

### impl-1345 · 2026-10-27T01:09:14.508Z

Rule 20 consumer inventory before edits: searched production, hub/test (all tiers), web/nvim, shipped .agents skills, qa briefs, docs/agents and hub/README for muteDefault/mute_default, remote_pairings, mute state, TelegramRemote and TelegramPollingOptions. Production consumers: dispatch pairing.approve initializes existing remote_state `mute`; daemon remote.status and CLI remote status read it; config/init/configuration manage the existing default; messenger creates TelegramRemote; pollTelegram owns trusted paired admission/offset receipts; state.ts owns remote_state and pairing persistence. Changed consumers: TelegramRemote adds suppression and exact paired commands; RemoteStore adds additive effect/count methods using existing remote_state; pairing.approve resets missed count. Unaffected wire clients: protocol RemoteStatusResult/CLI/web/nvim keep the existing mute boolean and prior reply/list shapes; no schema or permission change. Regression consumers retained: remote-cli.test.ts (default and rotation), config-set/init-config, pairing-approval/codes/service, telegram-rendering/messenger/pairing/polling incl T3 polling-restart, remote-state/outbox/gateway, startup cli-imports/project-hub-lifecycle. QA E-1309 uses /mute and /unmute on fake; E-1307 outbox gap counts are separate and unchanged. Docs consumers to update: hub README, agents pairing, implement skill + CHANGES, CLI config/remote help and golden fixture, new per-test guide. New tests use sealed projectHub frame + fake Bot API with FakeClock; no real platforms or processes.

### impl-1345 · 2026-10-27T01:13:40.918Z

TDD/component evidence on macOS local working tree based on ce423359: new telegram-mute.test.ts initially failed with `Error: executor operation deadline reached` at the missing /unmute durable poll receipt (1 failed, 0 passed). After implementing paired commands, source suppression/counting and atomic effect receipts, the same file passes 3/3: `Telegram mute suppresses three General messages but keeps a hub notice and unmute reports the count`; `Telegram unmute interruption after commit preserves the count reset without replaying its reply`; `Telegram mute counts each eligible source once and a replacement pairing starts with a fresh count`. Last local top-level durations 118/73/64 ms. Full npm run typecheck passed before the final additional guard test; closed-item wording lint passed. These are T2 fixture receipts and static checks only, no Linux/droplet, browser, source review, whole-suite or enforced duration gate evidence. Pacing integration remains until T-1347 lands; final head will be rechecked. No per-item QA brief required (qaPolicy scope none).

### impl-1345 · 2026-10-27T04:50:44.531Z

Final source-review head affea1c710b967aff64a2c90f2732d4fa99effe7 includes every prescribed landed sibling through T-1347. Fresh fetch+merge origin/dev: already up to date; pushed and clean. Paced telegram-mute.test.ts passes the same 3 named T2 identities (131/73/69 ms macOS local); full npm run typecheck, wording lint and diff check pass. Shared driveTelegram advances only from durable queue/spacing facts and all final assertions remain. No Linux/droplet/browser/full-suite or enforce-duration evidence. C1 done, source review assigned to Reviewer via request, artifact A-12580 holds exact evidence. Coordinator directs no mode-free item verify and owns verify all after the final-head source review. No per-item QA (scope none).

### rev-26 · 2026-10-27T04:52:16.893Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1345-source-1
commit: affea1c710b967aff64a2c90f2732d4fa99effe7
scope: full
findings: [{"severity":"medium","text":"M1 Standards/rules9,12: Store/native remote acquired before unconditional ownership; disposer references const hub assigned only after awaited projectHub. Failed/aborted startup throws at uninitialized hub before stop/Store close. Use pre-acquisition owner with startup fake/custom release, every recreated remote/hub, stop/drain before SQLite/root removal, and same-disposer actual missed/aborted/rejected startup controls retaining existing assertions.","file":"hub/test/telegram-mute.test.ts","line":27}]
finding_counts: {"high":0,"medium":1,"low":0}

Consolidated full audit at affea1c71, fixed basea68bc54a121c69beeff4906f6b9dd7b464d462cd. Exactly Standards M1 medium; no additional Spec findings. Atomic mute/effect/count receipts, source dedupe/non-replay, notice bypass, paired command admission, replacement/default reset and shared consumers audited. Help owning fixtures/docs/skill/tier/index consistent, no new wire/schema/permission. Detailed A-12581: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12581-t-1345-full-source-review-at-affea1c71-fixture-acquisition-ownership.md. A-12580 local3/3/typecheck remains reported macOS targeted evidence, not configured runtime. No Reviewer execution/delegation. Fix complete consolidated finding, push and request fresh source review before Coordinator's disposed all occasion; no item verify or extra suite requested.

Criteria: C1 failed (Mute fixture can fail cleanup before stopping native remote or closing SQLite when hub setup rejects or aborts.).

### rev-26 · 2026-10-27T04:54:23.960Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1345-source-2
commit: d17abba0ff0402d28aded7a8e2ed842b0edc1e72
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, retaining complete Standards/Spec A-12581. Entire two-file direct-child diff read: M1 uses pre-acquisition pacingOwner, startup-only fake release before bind, nullable owned native/recreated remotes and owner.start for both hubs. Three actual missed/aborted/rejected startup controls retain primary error, late-hub stop or exact held-send close/incomplete result, SQLite/native census/zero timers. Original3 mute/count/default/foreign/replacement/replay/exact-close behavior assertions preserved. No production change/dev merge. A-12583: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12583-t-1345-corrected-full-source-clearance-at-d17abba0f.md. A-12582 local6/6/typecheck/static checks remain reported macOS targeted evidence. C1 done restored; runtime verification pending exact-head Coordinator all. No Reviewer execution/delegation or suite request; keep explicit no-item-verify disposition.

### impl-1345 · 2026-10-27T04:54:41.312Z

Ready reported to Coordinator under explicit no-item-verify disposition. Source-2 clear at d17abba0ff0402d28aded7a8e2ed842b0edc1e72, zero findings (A-12583 / rev-20261027-1345-source-2). C1 done, runtime pending Coordinator exact-head all. Fresh origin/dev fetch yielded a68bc54a121c69beeff4906f6b9dd7b464d462cd; merge-tree --write-tree HEAD origin/dev exit 0, result tree 8753ce7b2ad39580065fd0377772e4ddd4174b7f. No actual dev merge or source change after review; local branch pushed and clean. Local macOS 6/6 T2/typecheck/static evidence in A-12582, no configured Linux/full-suite claim. Claim retained until merge.

### impl-1345 · 2026-10-27T05:35:15.746Z

Exact reviewed head d17abba0ff0402d28aded7a8e2ed842b0edc1e72 passed Coordinator rule-6 all run 34a65dd9-5a47-47de-8dda-2e2300cef53b (A-12592): T0–T3 and Web exit 0; T4 not run. 4984 tests / 4976 pass / 8 skipped / 0 fail,cancelled,todo. Droplet c-8 lon1 Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; Web Chrome Headless Shell 156.0.8078.4, Playwright headless-shell v1248. Duration/test-lint gates report-only with warnings retained. Parsed actual timing records for all six telegram-mute generated identities: pass, 0.545/0.286/0.168/0.069/0.064/0.041 seconds in source order; no Linux duration allowance needed. Final evidence review requested from Reviewer at unchanged head with verified all; awaiting final verdict/hub ready. No extra suite or source change.

### rev-26 · 2026-10-27T05:35:59.924Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1345-evidence-1
commit: d17abba0ff0402d28aded7a8e2ed842b0edc1e72
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1 verified at unchanged source-2 head. A-12593 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12593-t-1345-final-exact-head-evidence-clearance-at-d17abba0.md. Original Coordinator all run 34a65dd9/A-12592 is passed at exact head; independently deduplicated 4976 ordinary passes + 8 reasoned unrelated skips, zero failures/cancellations, no load-gate repetitions. All six mute identities pass, C1 0.545090302s, three cleanup controls pass. T0/T1/T2/T3/Web complete, T4 absent. Linux droplet and pinned Headless Shell1248; typecheck host gate reused, not remotely repeated. Lint/budgets/report-only overruns and incomplete base timings retained. No findings; Coordinator owns enqueue/landing.

Criteria: C1 verified.

### coord · 2026-10-27T05:42:02.157Z

Merged b30c8d14c1852eb83077b16904f0d8c689b07318 onto dev.
