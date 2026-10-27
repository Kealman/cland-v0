---
id: T-1346
kind: task
title: Telegram commands laid out for a phone and the menu registered only on change
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1342
topic: topic-1098
branch: t/T-1346-telegram-commands-laid-out-for-a-phone
created: 2026-10-26T19:09:07.381Z
updated: 2026-10-27T03:45:19.041Z
closed: 2026-10-27T03:45:19.041Z
---

## Summary

The Telegram commands `/status`, `/inbox`, `/mute`, `/unmute`, `/decision`, `/question`, `/cancel`, `/help` and `/start` answer in a layout made for a phone screen. The command menu is registered for private chats only when it differs from what Telegram holds.

## What to build

Replies open with a title line, then groups under bold labels (Hub, Coordinator, Sessions, Queues, Release, This chat), one fact per line, with sessions as bullets and the gateway's numbers last as small text. `/help` has short headed sections with the commands as a bullet list and the trust lines last. Replies are text with entities. The reads go through the gateway's allowed reads (T-1321). Spec §3.10.

## Acceptance criteria

- [x] C1. `/status`, `/inbox` and `/help` render in the specified layout as text with entities, and `/cancel` and `/start` answer as spec §3.10 says (test).
  - done: impl-1346 · 2026-10-27T02:58:34.866Z
  - verified: rev-26 [reviewer] · run rev-20261027-1346-evidence-1 · 2026-10-27T03:39:12.600Z · commit 9c62de09e0c074cc3f78227bb11ab79c715849a3
- [x] C2. The first hub start registers the menu for private chats, and a second start with the same menu registers nothing (test).
  - done: impl-1346 · 2026-10-27T03:02:15.468Z
  - verified: rev-26 [reviewer] · run rev-20261027-1346-evidence-1 · 2026-10-27T03:39:12.600Z · commit 9c62de09e0c074cc3f78227bb11ab79c715849a3

## Comments

### impl-1346 · 2026-10-27T00:19:42.097Z

Pre-change consumer audit (rule 20): no hub wire shape/authority/schema changes planned. New Bot API methods getMyCommands/setMyCommands and additive sendMessage entities affect TelegramApi, TelegramRemote, loopback fake, telegram-api/pairing/polling/messenger tests (T2) and polling-restart (T3). Production factory messenger.ts supplies existing persistence/project name; gateway's existing allowed hub.status/task.list/inbox.list reads suffice. Sibling T-1343 adds format/entities; T-1344 adds RemoteSend ingress and optional Remote.start fourth receipt callback; retain both at merge. Searches cover hub/src, hub/test all tiers, nvim/test, web/test, qa/briefs, .agents/skills and docs. No menu callers or persisted menu readers exist; reconcile against platform rather than a new DB cache. Existing injected/legacy remotes remain unchanged; existing gateway previous-wire tests cover optional startup arguments. /decision,/question remain T-1344; /mute,/unmute T-1345. Cards pending-answer state is absent until the cards epic, so /cancel must never clear frame correlation or answer an ask.

### impl-1346 · 2026-10-27T00:25:32.550Z

Checkpoint 281d3dfc8 and artifact A-12534 record five red→green command/menu cases. Local macOS targeted T2 telegram-commands.test.ts completed (5/5), telegram-pairing.test.ts completed (3/3); npm run typecheck completed. No T0–T4 suite, remote executor or browser evidence claimed. Coordinator decision 58808755-e6ca-4134-a495-9b05ac62cc2f keeps command replies direct, no outbox/jobs; durable native chat/message fence precedes replies, and replay after effect-before-receipt interruption emits no duplicate. Integration and source review await the required sibling landings; full verify is Coordinator-owned.

### impl-1346 · 2026-10-27T01:10:25.000Z

Integrated the landed T-1343 via origin/dev (ce423359), preserving rendering format and both receive paths; merged head 4a1fd1017. All six command cases pass, including the newly green long literal card split case. On this macOS local tree: npm run typecheck completed; targeted telegram-api (15/15), telegram-rendering (6/6), telegram-pairing (3/3) and cli-help (5/5) passed, run one file at a time. The updated help fixture is committed separately. No full-suite/Linux/browser evidence claimed. T-1344 and T-1349 must land and merge before source review.

### rev-26 · 2026-10-27T03:01:42.186Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1346-source-1
commit: aaf0044e63377e88f3a7be4b914762effc94672e
scope: full
findings: [{"severity":"medium","text":"M1 Standards/rule20: native rejected-input consumer still allows only getMe/getUpdates, but startup now adds getMyCommands/setMyCommands. Migrate owning full-file expectation to exact startup prefix plus polling-only traffic; retain all handler/history/offset/no-download/no-reply controls and original red/green receipts.","file":"hub/test/telegram-polling.test.ts","line":82},{"severity":"low","text":"L1 Standards/rule16: merged guidance duplicates /control/fault rows and the fake-method paragraph, leaving 'Updates stay queued until an offset' unfinished. Consolidate while preserving description/setMessageReaction/menu methods and account for hold-after-send committing its effect.","file":"docs/agents/tests/hub-test-telegram-api.test.ts.md","line":75}]
finding_counts: {"high":0,"medium":1,"low":1}

Consolidated full audit complete at requested aaf0044e6, fixed base7c227fdf4075b6eeddf3ddc64449a426b906e8b3. Standards M1 medium/L1 low; Spec no findings under directly read Coordinator decisions58808755/b9c3cf2b: direct replies/no outbox here, mute and card actions assigned elsewhere. Command/inbound result correlation, fourth startup receipt callback, native ingress/rendering, scoped menu actual-state comparison, literal entities/splitting and replay fence audited. A-12560: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12560-t-1346-full-source-review-at-aaf0044e6-polling-consumer-migration.md. Implementer reports local polling red5/1 then green6/6; this does not change the reviewed commit. Final ref read now points to993fa61ade23faac122565cab4a61a1371bbf676, not yet reviewed. C1 runtime unverified; C2 failed for consumer migration. No Reviewer execution/delegation or suite request. Fresh corrected-head review precedes Coordinator's all occasion; retain no-mode-free instruction.

Criteria: C2 failed (Menu startup changed native API traffic without migrating the existing rejected-input polling consumer; exact-head configured runtime remains pending.).

### impl-1346 · 2026-10-27T03:02:15.657Z

Source-1 findings addressed at 9c62de09e0c074cc3f78227bb11ab79c715849a3. M1: full original polling test file at aaf0044e6 reproduced failure 'no download or reply work for rejected input' (5 pass/1 fail); after migration it passed all 6 locally on macOS. The assertion now requires getMe/getMyCommands/setMyCommands startup prefix and only getUpdates afterwards; all native handled/history/offset/rejection assertions stay. L1: consolidated /control/fault row and method paragraph, retaining description, scoped menu methods, reactions and hold-after-send's committed-effect semantics. Wording lint passed. A renewed startup-expectation search across all-tier hub/nvim/web tests, QA briefs, skills and docs found the migrated messenger and polling consumers only. No new runtime source or suite run; no dev merge after first review.

### rev-26 · 2026-10-27T03:02:56.551Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1346-source-2
commit: 9c62de09e0c074cc3f78227bb11ab79c715849a3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear, retaining complete Standards/Spec audit A-12560. Read all three corrected files/two direct child commits: M1 exact native menu startup prefix then polling-only traffic preserves every rejection/history/offset/native-close assertion and matching guide; L1 consolidates fault row and complete menu/send/reaction method paragraph. No production change, dev merge or new runtime identity. Actual branch/head/tree match9c62de09e/48a73f84. A-12561: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12561-t-1346-corrected-full-source-clearance-at-9c62de09e.md. Local polling red5/1→green6/6 remains implementer-attributed macOS targeted evidence. C1/C2 claimant done restored; runtime verification pending exact-head Coordinator-disposed all result. No Reviewer execution/delegation or suite request; retain explicit no-mode-free occasion and approved direct-reply/card/mute scope.

### impl-1346 · 2026-10-27T03:03:16.314Z

Ready reported to Coordinator at source-cleared head 9c62de09e0c074cc3f78227bb11ab79c715849a3 (rev-20261027-1346-source-2, A-12561). Fresh origin/dev fetch returned 7c227fdf; merge-tree check exited 0 with tree 48a73f84fcccf992849b3e3c6baaa26d7c702888; clean worktree. No mode-free verification. Coordinator owns the required exact-head verify all and enqueue; claim retained.

### impl-1346 · 2026-10-27T03:38:28.873Z

Exact-head full configured evidence: run d4147553-57e9-4b03-9762-ea12711e51a1 at 9c62de09e, A-12565. Linux x64 droplet c-8 lon1; T0/T1/T2/T3/Web exit 0; T4 not run. 4943 tests, 4935 pass, 8 platform/binary skips, zero fail/cancel. Duration/test lint/ratchet are report-only. Lifetime 2001 s, $0.1390; Chrome Headless Shell 156.0.8078.4 prepared. Six generated command tests individually retained pass receipts: Telegram registers the private menu on first start and only repairs platform changes (0.266949435 s); Telegram help is phone text with bold sections, command bullets and trust last (0.073033946 s); Telegram status reads gateway facts with six session bullets and transport numbers last (0.273312545 s); Telegram inbox repeats open asks and cancel leaves them open while start names the project (0.11609324 s); Telegram command replay does not repeat a reply committed before its lost HTTP receipt (0.093438804 s); Telegram command replies split long literal card text without treating it as Markdown (0.095561295 s). These are individual recorded case times, not suite wall times. Requested final evidence review with all criteria; head held.

### rev-26 · 2026-10-27T03:39:12.600Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1346-evidence-1
commit: 9c62de09e0c074cc3f78227bb11ab79c715849a3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final C1/C2 evidence clear at unchanged9c62de09e. Original Coordinator all run d4147553/A-12565: independently deduplicated4935 ordinary passes+8 reasoned unrelated skips, no failure/cancel/TODO; T0/T1/T2/T3/Web exit0, T4 absent, no scoped load repetitions. Six exact command identities pass0.073–0.273312545s, including scoped menu/no-op restart/drift repair, phone entities/facts, cancel/start, long literal split and committed-effect/lost-response restart fence. Migrated rejected-input polling identity passes0.086071349s; related native inbound/liveness/rendering/pairing/help/legacy guards pass. No >=3s new identity. Linux x64 c-8lon1, Node24.21/Neovim0.12.5, isolated Headless Shell156.0.8078.4/v1248. Host typecheck prepared tree c1269fc7 not repeated remotely; budgets/lint/incomplete ratchet remain report-only. Detailed A-12566: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12566-t-1346-final-evidence-clearance-at-9c62de09e.md. A-12560/A-12561 source chain retained; Coordinator direct-reply/pacing/card/mute scope unchanged. No Reviewer execution/delegation, live-platform/QA/epic claim or additional run requested. Coordinator owns enqueue/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-27T03:45:19.041Z

Merged 4af3b001c87e41834e9a0563819cca56f0199711 onto dev.
