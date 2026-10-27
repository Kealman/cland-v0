---
id: T-1353
kind: task
title: An ask arrives as a Telegram card and one tap answers it and edits the card into its outcome
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1352
topic: topic-1108
branch: t/T-1353-an-ask-arrives-as-a-telegram-card-and
created: 2026-10-27T05:43:00.974Z
updated: 2026-10-27T09:56:16.707Z
closed: 2026-10-27T09:56:16.707Z
---

## Summary

An open ask to the human in the inbox becomes a card in the paired chat. The card names who asks and in which topic, shows the question, and has one button per option, "Other answer…" when the ask takes a free answer, and "Decline…", one per row. A tap answers the ask through `topic.answer` with `via = "telegram"`, and every copy of the card is edited into its outcome without buttons.

## What to build

A messenger-neutral card model, which turns the inbox's asks into cards and works out each outcome line. Telegram rendering builds on it. When an inbox publication brings an ask with no card yet, a `card` job goes to the outbox. The card is plain text with entities (not a Rich Message), at most nine option buttons, one button per row, then "Other answer…" (only when `free`) and "Decline…". Each button carries an opaque key of at most 64 bytes, stored in the remote tables and mapped to the ask and the option. The chat message is mapped in `remote_messages` with its ask.

A press resolves its key, checks that the ask is open, and sends `topic.answer` with the option. Once the hub's result is stored it answers the press at once (outside the outbox and pacing), and only then is the offset confirmed. On the ask's outcome, every mapped copy gets an `edit` job: the outcome line, no buttons. "Message is not modified" counts as success, and a failed edit becomes an outcome reply to the card. Until ticket 04 lands, "Other answer…" and "Decline…" answer the press with a short "not available yet" toast. Spec §3.5 and §3.1; builds on the outbox's `card` and `edit` jobs (T-1324, T-1347), the message map (T-1323) and the polling's store-then-confirm (T-1341).

## Acceptance criteria

- [x] C1. A nine-option ask with free answers arrives as one entities card naming the asker and the topic, with eleven buttons one per row in order ending "Other answer…" and "Decline…", and every `callback_data` of at most 64 bytes (test).
  - done: impl-1353 · 2026-10-27T09:18:43.980Z
  - verified: rev-26 [reviewer] · run rev-20261027-1353-evidence-2 · 2026-10-27T09:50:25.678Z · commit d83f8e1a1a355b5e9493a80875d4474be2aba245
- [x] C2. A tap on option 3 records the answer with `via = "telegram"` before the press is answered and before the offset is confirmed, and the card is edited to the outcome naming the option, who, "via Telegram" and the time, with no buttons (test).
  - done: impl-1353 · 2026-10-27T09:18:44.470Z
  - verified: rev-26 [reviewer] · run rev-20261027-1353-evidence-2 · 2026-10-27T09:50:25.678Z · commit d83f8e1a1a355b5e9493a80875d4474be2aba245
- [x] C3. A press whose data is not a key the hub issued, or names another ask, changes nothing and answers the press (test).
  - done: impl-1353 · 2026-10-27T09:18:45.701Z
  - verified: rev-26 [reviewer] · run rev-20261027-1353-evidence-2 · 2026-10-27T09:50:25.678Z · commit d83f8e1a1a355b5e9493a80875d4474be2aba245
- [x] C4. An outcome edit refused as "message is not modified" counts as done, and one the fake fails becomes one outcome reply to the card (test).
  - done: impl-1353 · 2026-10-27T09:18:46.089Z
  - verified: rev-26 [reviewer] · run rev-20261027-1353-evidence-2 · 2026-10-27T09:50:25.678Z · commit d83f8e1a1a355b5e9493a80875d4474be2aba245

## Comments

### impl-1353 · 2026-10-27T08:56:58.508Z

Shared-contract consumer audit before implementation: no wire fields or response shapes will change. The additive callback identity will use the existing trusted gateway ingress and messenger-scoped remote_state receipts. Existing topic.answer callers without native ingress retain the same gate/result/refusal; old Remote.start/RemoteSend signatures and payloads remain supported. New native edit payloads retain all old TelegramOutbox send payloads. Consumers searched across production, all test tiers, startup probes, persisted readers, shipped skills and QA briefs; inventory follows.
qa/briefs/E-417-stage-2.md
hub/src/remote/gateway.ts
docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md
hub/src/remote/telegram-inbound.ts
nvim/README.md
hub/src/remote/telegram.ts
nvim/lua/cland/topic_view.lua
hub/src/remote/telegram-outbox.ts
hub/src/remote/telegram-polling.ts
shared/wire/index.ts
hub/src/remote/authority.ts
web/src/AskCard.tsx
.agents/skills/implement/SKILL.md
qa/briefs/T-274.md
hub/test/durations.json
qa/briefs/E-419.md
qa/briefs/E-419-stage-3.md
qa/briefs/T-113.md
qa/briefs/E-419-stage-2.md
qa/briefs/E-468.md
hub/src/hub/dispatch.ts
qa/briefs/E-420.md
hub/test/telegram-rendering.test.ts
qa/briefs/E-413-stage-2.md
nvim/lua/cland/ask_card.lua
hub/src/hub/asks.ts
qa/briefs/E-413.md
qa/cases/GRAPH-001.items.json
qa/briefs/E-417.md
hub/src/hub/web-authority.ts
nvim/test/shell-component.test.ts
nvim/test/panel-placement-component.test.ts
nvim/test/shell.test.ts
nvim/test/palette-component.test.ts
nvim/test/stub-hub.ts
nvim/test/inbox-actions.test.ts
nvim/test/fixtures/graph-t19.json
web/README.md
nvim/test/fixtures/protocol-frames/inbox-actions.json
hub/test/pairing-codes.test.ts
web/test/topics.test.ts
web/test/pairing.test.ts
nvim/test/fixtures/protocol-frames.json
web/test/asks.test.ts
nvim/test/fixtures/protocol-frames/panel-placement-component.json
web/test/phone.test.ts
nvim/test/fixtures/protocol-frames/shell-component.json
hub/test/cli-identity.test.ts
hub/src/spoke/task-tools.ts
web/test/phone-disconnected.test.ts
web/test/remote-via.test.ts
web/test/inbox.test.ts
web/test/shell.test.ts
web/test/phone-asks.test.ts
web/test/phone-install.test.ts
hub/src/protocol.ts
hub/test/asks-cli.test.ts
hub/test/telegram-pacing.test.ts
hub/test/ask-outcomes.test.ts
hub/test/outbox-gateway.test.ts
hub/test/inbox-requests-component.test.ts
docs/agents/tests/hub-test-outbox-gateway.test.ts.md
hub/test/inbox-requests.test.ts
hub/test/handover.test.ts
hub/test/ask-chain.test.ts
hub/test/inbox-archive-workload.ts
hub/test/asks.test.ts
hub/test/fixtures/cli-usage/commands.json
hub/test/topic-model.test.ts
hub/src/cli/usage.ts
hub/test/worktree-cli.test.ts
hub/test/gateway.test.ts
hub/src/cli/inbox.ts

Migration: gateway/dispatch native answer replay, Telegram renderer/polling/outbox and their tests/docs are affected. Existing asks/core, authority, workbench clients and recorded fixtures retain their wire shape and require no migration; previous-shape gateway and outbox regressions remain. No authority expansion, no new schema fields.

### rev-26 · 2026-10-27T09:13:52.262Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1353-source-1
commit: 7d8212deb205bfed6e9519b6e68317dbeaf4ccda
scope: full
findings: [{"severity":"high","text":"H1 Spec: core.asks.answer synchronously publishes/delivers the human answer and ask outcome before gateway.answer receipt persistence and outer COMMIT. Receipt-write/commit failure rolls back SQLite after phantom answer delivery. Defer external publication/delivery until the combined transaction commits; retain lost-result replay and add receipt-failure/no-delivery followed by exactly-one retry control.","file":"hub/src/hub/dispatch.ts","line":1862},{"severity":"medium","text":"M1 Spec: terminal 400 query-is-too-old acknowledgement propagates into polling's endless same-update retry; no offset confirmation or later input progress is possible. Settle definite expiry after preserving durable result, retaining transient retries/fatal errors, and prove exactly-one answer plus subsequent input under injected expiry.","file":"hub/src/remote/telegram-cards.ts","line":49},{"severity":"medium","text":"M2 Standards: C3's extra API uses a stationary fake clock while directly awaiting editMessageText, so its HTTP deadline cannot fire; no independent native case bound exists. Keep fake server time but independently bound the actual I/O and case, retaining all final security/toast/offset assertions.","file":"hub/test/telegram-cards.test.ts","line":138}]
finding_counts: {"high":1,"medium":2,"low":0}

Consolidated audit A-12669: Standards M2; Spec H1/M1. No other current-scope findings. Preliminary competing-client/held-send/withdrawn/cancelled observations are excluded after checking successor T-1354/T-1356 scope; no expansion requested. Reviewed model/rendering, native ingress, poller/outbox/replay, consumer compatibility, docs/help/skill and registered fixture ownership. A-12668 remains local macOS summary, no configured/Linux/browser proof. C2 failed H1; other criteria unverified. Fresh corrected pushed-head full source review required before verification; Coordinator owns cover/QA/landing.

Criteria: C2 failed (Native answer/receipt transaction can roll back after synchronous human-answer and outcome publication (H1).).

### impl-1353 · 2026-10-27T09:14:27.655Z

Source-1 corrections extend the consumer inventory before modifying core publication: sendFromHuman (HubCore callers/core tests), the Asks port (only HubCore supplies it), dispatcher topic.answer native path, legacy ask/core/gateway request tests, existing afterCommit transaction readers and artifact publication. Search results:
hub/src/hub/dispatch.ts
hub/src/hub/core.ts
hub/src/hub/asks.ts
hub/src/hub/store.test.ts
hub/test/inject-stalled.test.ts

Migration plan: put human-send publication/delivery/hygiene side effects behind Store.afterCommit and use afterCommit for Asks port publications/logs; outside an outer transaction they remain synchronous. Native callback responses freeze the admission snapshot saved with the answer, before post-commit delivery; existing callers without native identity keep their normal result semantics. Add SQLite trigger failure proof at real frame/fake seam. Run asks, ask-chain and ask-outcomes locally in addition to the already required Telegram/outbox/gateway files. No new wire fields or permission changes.

### rev-26 · 2026-10-27T09:20:31.304Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1353-source-2
commit: 5b8afe5ee8139aa3c1b21e23b92abe633ac608a9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source-2 clear, A-12672. H1 resolved through Store.afterCommit for human publication/delivery/hygiene and Asks port events/logs; native replay snapshot detached. SQLite-trigger rollback control retains no phantom delivery/frame/edit and exactly-one retry. M1 terminal expiry permits offset/later input; separate 500 retains saved-result retry. M2 live C3 HTTP clock/abort and independent case bound present. All original assertions retained; no dev merge. A-12670 raw local serial counters independently total 185 passes across 18 result blocks; A-12671 preserves copied red details and excludes invalid held-HTTP expiry experiment. Local macOS only, no configured/Linux/browser result; C1–C4 remain unverified. Keep reviewed head stable for authorized mode-free verify and original-record final evidence review; Coordinator owns cover/QA/landing.

### rev-26 · 2026-10-27T09:31:16.641Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1353-evidence-1
commit: 5b8afe5ee8139aa3c1b21e23b92abe633ac608a9
scope: evidence
findings: [{"severity":"medium","text":"M3 affected publication consumer: two original tests expect artifact.create refusal via a human-send log throw, but this callback now runs after commit and is isolated, so both fail true !== false (:298/:432). Preserve rollback/no-publication/directory/id-reservation assertions using actual pre-commit write/admission fault; retain separate post-commit log-failure acceptance coverage. Corrected source review required before another verify.","file":"hub/test/artifact-lifecycle.test.ts","line":298}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear, A-12674. Original A-12673/21f58fa7 exits 1; independent record counts 2,983 ordinary passes / 2 failures, plus 70 separate load passes, no skip/cancel. All 14 card cases passed, but required gate is red. T0/T1 pass; T2 fails; mapped T4/Web unrun, T3 absent. Host typecheck reused, budgets/lint report-only. Exact-head fixture explains both failures as publication-contract consumer migration, not an established unrelated flake. C1–C4 remain unverified; preserve failed receipt and obtain corrected-head source clearance before verification.

### impl-1353 · 2026-10-27T09:31:34.892Z

Rule-20 refusal-class audit supplement (before artifact fixture migration). The human-send diagnostic now runs after commit; its failure cannot refuse/roll back an already stored/published/delivered message. Authoritative precommit record/admission failures remain refusals. Search terms: sendFromHuman, human-send, failPost, post failed inside artifact, publication-failed, topic.send; production, CLI/web/Neovim, shared wire, shipped skills, QA fixtures and every test tier included.
docs/agents/tests/hub-test-telegram-inbound.test.ts.md
docs/agents/tests/hub-test-telegram-polling-restart.test.ts.md
docs/agents/tests/hub-test-telegram-polling.test.ts.md
docs/agents/tests/hub-test-topics-component.test.ts.md
docs/agents/tests/web-test-composer.test.ts.md
hub/src/hub/asks.ts
hub/src/hub/core.ts
hub/src/hub/dispatch.ts
hub/src/hub/journal.ts
hub/src/hub/store.test.ts
hub/src/hub/web-authority.ts
hub/src/protocol.ts
hub/src/remote/authority.ts
hub/src/remote/telegram-inbound.ts
hub/test/account-limited.test.ts
hub/test/account-limits.test.ts
hub/test/adapter-composition.test.ts
hub/test/agents-journal.test.ts
hub/test/aide-claims.test.ts
hub/test/aide-component.test.ts
hub/test/aide.test.ts
hub/test/approval-restart.test.ts
hub/test/artifact-delete.test.ts
hub/test/artifact-folders.test.ts
hub/test/artifact-lifecycle.test.ts
hub/test/artifacts.test.ts
hub/test/asks.test.ts
hub/test/claude-code-accounts.test.ts
hub/test/claude-code-adapter.test.ts
hub/test/claude-code-schedule.test.ts
hub/test/claude-code-sessions-lifecycle.test.ts
hub/test/claude-code-sessions.test.ts
hub/test/cli-identity.test.ts
hub/test/codex-adapter.test.ts
hub/test/codex-delivery.test.ts
hub/test/computed-sessions.test.ts
hub/test/connection-snapshot.test.ts
hub/test/custom-roles-component.test.ts
hub/test/default-subscriptions-lifecycle.test.ts
hub/test/default-subscriptions.test.ts
hub/test/durations.json
hub/test/edges.test.ts
hub/test/fake-harness.test.ts
hub/test/fakes/scripted-codex.ts
hub/test/gateway-secrets.test.ts
hub/test/gateway-state.test.ts
hub/test/gateway.test.ts
hub/test/handover-integrity-component.test.ts
hub/test/handover-process.test.ts
hub/test/handover.test.ts
hub/test/heartbeat.test.ts
hub/test/human-marks.test.ts
hub/test/human-routing.test.ts
hub/test/in-process-spoke.test.ts
hub/test/inbox-actions.test.ts
hub/test/inbox-archive-workload.ts
hub/test/inbox-requests-component.test.ts
hub/test/inbox-workload.test.ts
hub/test/inject-stalled.test.ts
hub/test/item-lead.test.ts
hub/test/item-summary.test.ts
hub/test/lead-launch.test.ts
hub/test/lead-routing-process.test.ts
hub/test/lead-routing.test.ts
hub/test/merge.test.ts
hub/test/mod-bridge.test.ts
hub/test/name-reservation.test.ts
hub/test/nvim-artifacts-rules.test.ts
hub/test/nvim-inbox-requests-rules.test.ts
hub/test/opencode-adapter.test.ts
hub/test/permissions.test.ts
hub/test/progress.test.ts
hub/test/project-clock.test.ts
hub/test/release.test.ts
hub/test/role-integrity-component.test.ts
hub/test/rule-sessions-component.test.ts
hub/test/rule-sessions.test.ts
hub/test/scenarios/crew-launch.test.ts
hub/test/session-brief-component.test.ts
hub/test/session-brief.test.ts
hub/test/session-launch-component.test.ts
hub/test/session-launch-lifecycle.test.ts
hub/test/session-launch.test.ts
hub/test/session-native-lifecycle.test.ts
hub/test/subscription-hygiene.test.ts
hub/test/subscriptions.test.ts
hub/test/task-worktrees-lifecycle.test.ts
hub/test/telegram-catchup.test.ts
hub/test/telegram-commands.test.ts
hub/test/telegram-inbound.test.ts
hub/test/telegram-liveness.test.ts
hub/test/telegram-polling-fixture.ts
hub/test/telegram-rendering.test.ts
hub/test/thread-runs.test.ts
hub/test/topic-model.test.ts
hub/test/topic-withdraw.test.ts
hub/test/topics-component.test.ts
hub/test/topics.test.ts
hub/test/visibility-component.test.ts
hub/test/visibility.test.ts
hub/test/web-authority-unit.test.ts
hub/test/web-authority.test.ts
nvim/lua/cland/agents_log.lua
nvim/lua/cland/explorer_compose.lua
nvim/lua/cland/topic_view.lua
nvim/test/artifact-browser-component.test.ts
nvim/test/artifact-browser.test.ts
nvim/test/explorer-compose-component.test.ts
nvim/test/explorer-roots-component.test.ts
nvim/test/fixtures/protocol-frames.json
nvim/test/fixtures/protocol-frames/inbox-actions.json
nvim/test/fixtures/protocol-frames/shell-component.json
nvim/test/fixtures/protocol-frames/shell.json
nvim/test/inbox-actions.test.ts
nvim/test/rulebook.test.ts
nvim/test/shell-component.test.ts
nvim/test/stub-hub.ts
qa/briefs/E-412-stage-2.md
qa/briefs/E-412-stage-3.md
qa/briefs/E-413-stage-2.md
qa/briefs/E-414-stage-1.md
qa/briefs/E-414-stage-2.md
qa/briefs/E-414-stage-3.md
qa/briefs/E-414.md
qa/briefs/E-416-stage-3.md
qa/briefs/E-416.md
qa/briefs/E-417-stage-1.md
qa/briefs/E-417-stage-2.md
qa/briefs/E-417-stage-3.md
qa/briefs/E-417.md
qa/briefs/E-418-stage-1.md
qa/briefs/E-418-stage-3.md
qa/briefs/E-418.md
qa/briefs/E-419-stage-2.md
qa/briefs/E-419-stage-3.md
qa/briefs/E-419.md
qa/briefs/E-423.md
qa/briefs/E-468.md
qa/briefs/E-611.md
qa/briefs/T-108.md
qa/briefs/T-269.md
qa/briefs/T-270.md
qa/briefs/T-272.md
qa/briefs/T-274.md
qa/briefs/T-275.md
qa/briefs/T-276.md
qa/reports/T-236.md
shared/wire/index.ts
web/src/Composer.tsx
web/src/ItemsPlan.tsx
web/src/QuickMessage.tsx
web/test/artifacts.test.ts
web/test/asks.test.ts
web/test/composer.test.ts
web/test/inbox.test.ts
web/test/messages.test.ts
web/test/phone-composer.test.ts
web/test/phone-disconnected.test.ts
web/test/phone-thread.test.ts
web/test/remote-via.test.ts
web/test/session-drawer.test.ts
web/test/sessions.test.ts
web/test/thread-artifacts.test.ts
web/test/thread-runs.test.ts
web/test/topics.test.ts
web/test/withdraw.test.ts

Migration/disposition: HubCore/Asks and dispatch native replay already migrated to afterCommit with rollback failure proof. Dispatcher topic.send, CLI send/inbox paths, web composer/asks, Neovim topic/ask paths and gateway inbound keep the same request/result shapes and success/error branches: postcommit logging now succeeds with an operator publication-failed log, while record/admission refusals still return errors. Artifact creation's shared synchronous post is the affected nested consumer: migrate its two artifact-lifecycle rollback controls from a logger throw to a SQLite messages insertion refusal, retaining subscription/directory/id assertions. Keep a separate logger fault in artifact-lifecycle to prove one stored post, one publication/delivery and observable publication-failed diagnostic; no replay/retry of a committed post. Existing core message/store/gateway/asks/artifact/CLI/web/Neovim tests keep their authoritative refusal assertions and old wire fixtures, unaffected unless they deliberately used the human-send logger as an admission failure. Searches found that deliberate log injection only in artifact-lifecycle.test.ts. QA/skills/startup probes and persisted readers consume request status or stored rows, not thrown diagnostic logger errors, so need no wire migration. Update hub README and the file guide with this changed logging outcome.

### impl-1353 · 2026-10-27T09:33:41.805Z

Refusal audit named CLI supplement: hub/src/cli/artifact.ts uses askHubFrame in hub/src/cli/socket-client.ts, and hub/src/cli/inbox.ts carries human ask answers. They retain the existing accepted/error wire handling and never inject a human-send logger error; real precommit admission/record errors still refuse. hub/src/hub/journal.ts/daemon log wiring consume the publication-failed record rather than treating logger exceptions as request admission. Only artifact-lifecycle intentionally used human-send logging for rollback and is now migrated. Existing schemas/authority tables and web/Neovim wire fixtures remain unchanged.

### rev-26 · 2026-10-27T09:36:14.536Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1353-source-3
commit: d83f8e1a1a355b5e9493a80875d4474be2aba245
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source-3 clear, A-12681. M3 resolved: both original artifact rollback tests use an actual pre-commit messages-write refusal with all original subscription/directory/id-reuse assertions preserved. Separate bounded log-failure control proves one committed post/publication/delivery, bytes, reopened Store and operator diagnostic. Comprehensive refusal consumer/disposition inventory plus CLI supplement reviewed; guide/index/README/skill consistent. Entire six-file correction inspected; no hub/src change or dev merge. A-12679 original local output 37/37 inspected; A-12680 copied red details/local scope retained. Old A-12673 remains failed and supplies no new-head runtime clearance. C1–C4 unverified; stable-head authorized mode-free verify then original-record evidence review.

### rev-26 · 2026-10-27T09:50:25.678Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1353-evidence-2
commit: d83f8e1a1a355b5e9493a80875d4474be2aba245
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final original-record evidence clear, A-12685; C1–C4 verified at unchanged source-3 head. Original af7673c2/A-12684 independently yields 3,645 ordinary passes and 75 separate load passes, no fail/cancel/skip/TODO. All14 card identities plus new artifact logger identity exact5/5; max individual0.684225938 s, no >=3 s allowance needed. Both prior artifact failures now pass with preserved rollback assertions; atomic receipt/expiry/retry controls pass. T0/all T1/fallback all T2/mapped T4 once/Web complete; broader T3/T4 soak unrun. Pinned Headless Shell156/v1248; host typecheck50e33a10 reused, budgets/lint report-only. Old A-12673 remains failed. Coordinator owns integrated cover/QA/enqueue/landing.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1353 · 2026-10-27T09:50:55.527Z

Ready handoff: head d83f8e1a1a355b5e9493a80875d4474be2aba245, branch pushed to origin. Source-3 and final evidence-2 clear (A-12681/A-12685); C1–C4 freshly verified. Configured mode-free run af7673c2/A-12684 passed: 3,645 ordinary passes plus75 separate load passes; T0/T1/fallback all T2/mapped T4 once/Web complete, broader T3/soak deferred, budgets/lint report-only. Droplet Linux x64 c-8 lon1, Node24.21.0, Neovim0.12.5, isolated Chrome Headless Shell156.0.8078.4 build1248; lifetime727s, cost$0.0505. Original failure A-12673 retained. Fresh git fetch --no-auto-maintenance origin dev plus merge-tree --write-tree HEAD origin/dev exited0 with no conflicts: current origin/dev8719f18ed7b3f04708ed181729c8b68b817fd2af, synthetic merge tree9e895dc578dc67240855dcfc86c431698161d55b. Working tree clean; no source mutation or dev merge since source clearance. Coordinator owns enqueue/integrated cover/epic QA/landing.

### coord · 2026-10-27T09:56:16.707Z

Merged 599dd446c27ee5207ba601326b093f2db244c0b2 onto dev.
