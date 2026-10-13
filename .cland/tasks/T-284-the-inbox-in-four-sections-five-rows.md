---
id: T-284
kind: task
title: The inbox in four sections, five rows each, with ages, in Neovim and the CLI
state: closed
status: done
criterion_seq: 7
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-274
blocked_by:
  - T-283
topic: topic-173
branch: t/T-284-the-inbox-in-four-sections-five-rows
created: 2026-10-12T11:57:19.628Z
updated: 2026-10-12T17:21:51.289Z
---

## Summary

The inbox is redrawn on the now layer in its four sections (asks and approvals, plan approvals, requests to you, messages to you), newest first, five rows per section with an "N more" line naming the oldest wait, a waiting age on every row and the selected row unfolded in place. `cland inbox` prints the same four sections.

## Parent

T-274: Inbox and the events view. Spec: docs/spec/v0.1.2.md §3.7.

## What to build

**The four sections.** The panel inbox (`␣n`) and the full-width inbox (`␣N`) show only the now layer, in this order, each with its title and count:

1. Asks and approvals: the human's asks (`?`) and the sessions waiting for a command approval (`▲`).
2. Plan approvals: one row per epic whose plan waits for the human, with its title and its plan's size. Enter opens the plan view, where `a` approves, as today.
3. Requests to you: one row per request, with its glyph for review, QA or handover, its subject, its first line, and its sender in the sender's role colour.
4. Messages to you: one row per message, with its topic or bound item, its first line, and its sender in the sender's role colour.

Each section is newest first and shows its last five rows. The rest fold into one line, "▸ N more · the oldest waits <age>, since <time>", which `za` unfolds and folds again. Every row shows its waiting age, which refreshes at least once a minute with no hub frame. The selected row unfolds in place: an ask shows its question, its numbered options and its free-answer hint (`1`–`9` and `i` answer as today); a command approval shows the command in full; the other rows stay one line. Moving the cursor folds the previous row back. An empty section is not drawn. When nothing waits, the inbox says so ("✓ nothing needs you") and the chip is green. The empty state's events line and archive line arrive with the tickets that build them. The layout follows `docs/design/main-screen/InboxNow.dc.html`.

The v0.1.1 notification list stays below the four sections, unchanged, with its `d`, `D` and cap, until the last ticket of the epic retires it. Nothing the human sees today disappears before the events view exists.

**The CLI.** `cland inbox` prints the four sections in the same order, newest first, with a header per section and its count, one line per row with its id, its subject or topic, its first line, its sender and its waiting age, all rows (no cap). The last line stays `needs you: <n>`. `cland inbox --json` stays the frame as the hub returns it. The usage text describes the new layout.

**The hub.** Only what the drawing needs and the previous ticket did not provide (for example a plan row's title and size, a message's topic title), stated in `hub/README.md` beside the frame.

**Demo.** The headless workbench, on a scenario with one row of each kind, shows an ask first, a plan approval second, a request third and a message fourth, each with its age. A section of seven rows shows five and "▸ 2 more" with the oldest wait.

Out of scope: `r`, `d` on the new rows, and `A` (the next ticket); the events line (the events view ticket, which adds one line below the sections in parallel with this one: leave room for it and keep the renderer's sections and footer separable).

**Constraints.**

- Neovim is the host with no plugins (ADR 0005).
- Tests run the Neovim UI headless from the protocol's other side on the stub hub. The CLI is tested against a real hub on a temporary project.
- A Neovim-only delta needs `npm run test:nvim` green; suites run through `cland verify`.
- Every key goes through the action registry, so the palette and `␣?` list it.
- Commit on the task branch and push it to `origin`; `dev` only through `cland merge`.
- English everywhere.

## Acceptance criteria

- [x] C1. The panel and full-width inbox show the now layer in four sections in the order asks and approvals, plan approvals, requests to you, messages to you, each newest first with its count; senders are in their role colour.
  - done: impl-284 · 2026-10-12T14:47:22.059Z
  - verified: rev-24 [reviewer] · run rev-2026-10-12-284-3 · 2026-10-12T17:21:38.370Z · commit d09c4d855e355302eb1f480eb5aa4115ba5fa8db
- [x] C2. A section with more than five rows shows five and a "N more" line naming the oldest wait and its time; `za` on it unfolds and folds the rest.
  - done: impl-284 · 2026-10-12T14:47:34.246Z
  - verified: rev-24 [reviewer] · run rev-2026-10-12-284-3 · 2026-10-12T17:21:38.371Z · commit d09c4d855e355302eb1f480eb5aa4115ba5fa8db
- [x] C3. Every row shows its waiting age, and the age advances without a hub frame.
  - done: impl-284 · 2026-10-12T14:47:34.414Z
  - verified: rev-24 [reviewer] · run rev-2026-10-12-284-3 · 2026-10-12T17:21:38.371Z · commit d09c4d855e355302eb1f480eb5aa4115ba5fa8db
- [x] C4. The selected ask unfolds its options and free-answer hint in place and the selected approval its full command; other rows stay one line, and Enter on a plan row opens the plan view.
  - done: impl-284 · 2026-10-12T14:47:34.552Z
  - verified: rev-24 [reviewer] · run rev-2026-10-12-284-3 · 2026-10-12T17:21:38.371Z · commit d09c4d855e355302eb1f480eb5aa4115ba5fa8db
- [x] C5. `cland inbox` prints the four sections in the same order with ages and ends with `needs you: <n>` equal to the chip.
  - done: impl-284 · 2026-10-12T14:47:34.673Z
  - verified: rev-24 [reviewer] · run rev-2026-10-12-284-3 · 2026-10-12T17:21:38.371Z · commit d09c4d855e355302eb1f480eb5aa4115ba5fa8db
- [x] C6. Targeted tests pass (nvim headless tests on the stub hub, read with `screenstring()`; a hub test of `cland inbox` on a real hub), and `nvim/README.md` describes the four sections, their order, the five-row fold and the ages.
  - done: impl-284 · 2026-10-12T16:45:18.764Z
  - verified: rev-24 [reviewer] · run rev-2026-10-12-284-3 · 2026-10-12T17:21:38.371Z · commit d09c4d855e355302eb1f480eb5aa4115ba5fa8db
- [x] C7. A regression test bounds the inbox's work per hub event and at startup on a store with thousands of messages (T-293's first follow-up), and the finding on T-293's second point (whether a durable wait start is recorded one tick late) is stated in the item.
  - done: impl-284 · 2026-10-12T15:28:59.385Z
  - verified: rev-24 [reviewer] · run rev-2026-10-12-284-3 · 2026-10-12T17:21:38.371Z · commit d09c4d855e355302eb1f480eb5aa4115ba5fa8db

## Comments

### impl-284 · 2026-10-12T14:37:08.668Z

Implemented the four now sections in both views and CLI, per-section five-row folds, selected ask/command details and a local age clock. Added frame metadata for plan stage/lane/item counts and sender roles. Headless and real-hub tests are being updated to the new layout; legacy notifications and events footer remain separate.

### impl-284 · 2026-10-12T15:27:31.984Z

C7 / T-293 regression and timing audit: hub/test/inbox-workload.test.ts seeds 3,200 messages (same-topic answers and cross-topic explicit replies) and 256 remembered processes, starts the actual project hub and drives two 100-frame topic-read event bursts through the JSON-lines protocol. Native SQLite tracing observes real queries without substituting their results. Startup stays within a fixed ≤3 inbox-query budget including its first tick; observed 0 synchronous queries at serving. Each 100-event burst performs no synchronous full query and exactly one next-tick recompute. Reintroducing the pre-b75e0fe observe()->list() call made the test fail on 512 startup queries; the temporary mutation was removed. Timing audit through request/reply protocol frames: inbox_waits is persisted one tick after send, but its since equals the original message.ts, not the recompute time. A request resolved by the human within the same tick never reaches inbox_waits and has no inbox-departure/archive record. The audit test records this existing coalescing limitation; the frame rendering adds no per-event recompute.

### rev-24 · 2026-10-12T16:02:35.649Z

verdict: review
result: not clear
by: rev-24 [reviewer]
run: rev-2026-10-12-284-1
commit: ca7290a0083378db1a78337515397b2741b2ad12

Medium — hub/src/cli/inbox.ts:48: describe drops all legacy notifications after the four sections, so not-clear verdict/death warnings disappear from plain cland inbox; visibility.test.ts:502 fails /notification: ⚠ / in full verify 1a5e5929 at this exact head. Preserve warning visibility through the planned legacy retirement; do not remove its assertion without equivalent coverage and an explicit contract decision.
Validation: 1345/1347 tests passed, full exit 1. A second artifact-delete restart failure at hub/test/artifact-delete.test.ts:54 remains unattributed to this diff. C7 workload/timing tests passed; the same-tick durable-wait omission is explicitly audited and documented as required.
Evidence: review artifact in topic-173 and A-1555 durable suite log. C6 failed; no criteria verified in this not-clear verdict.

Criteria: C6 failed (Exact-head full verification fails the existing real-hub CLI warning compatibility test: the four-section renderer omits legacy notification warnings; Neovim phase was not reached.).

### impl-284 · 2026-10-12T16:04:34.975Z

Review correction: the D17 test passed alone on clean dev but failed on ca7290a because plain cland inbox omitted legacy notification lines. Restored those lines after the four response sections, preserving notification: ⚠ … and final needs you. D17's assertion is unchanged and passes on the corrected branch. The real-hub four-section CLI test now asserts legacy notification output and ordering. Merged origin/dev 8e5ec1e containing the existing verified-exit fix for the absorbed-artifact restart race; its targeted test passes. A-1555 remains the failed ca7290a run; a fresh full suite follows delta review request.

### rev-24 · 2026-10-12T16:43:28.186Z

verdict: review
result: not clear
by: rev-24 [reviewer]
run: rev-2026-10-12-284-2
commit: 764a0168ad4b1a9f719094b66aa55b02e327b3a4

Medium — nvim/test/qa-cases/STATE-001.lua:46: the case expects the full question while its ask remains unselected, so the new clipped collapsed row never satisfies its predicate. Full verify b2c09803 shows this exact screen and fails qa.test.ts:167 and :389. Select the ask through normal UI keys, then retain the exact full-question screen/state and read-only PASS assertions; do not lengthen the timeout or weaken predicates.
Prior CLI warning regression is fixed: unchanged D17 coverage passes, as do artifact restart, four-section CLI, C7 workload/audit, both inbox views and age advancement. Full run: 1644/1646 pass, exit 1, zero skips. C6 failed; no criteria verification marks on this verdict.
Evidence A-1564 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1564-t-284-review-at-764a016-qa-fixture-migration-incomplete.md; suite A-1563.

Criteria: C6 failed (STATE-001 never selects the collapsed ask before waiting for its full question; both ordinary qa.state and read-only rescue headless cases deterministically time out in full verify b2c09803.).

### impl-284 · 2026-10-12T16:45:21.702Z

Review correction after A-1563: both Neovim failures run STATE-001.lua, which expected the full question on an unselected, collapsed row. Added an inbox-section readiness wait and selected the ask through keys before the existing exact full-question/state predicate. The two targeted tests failed deterministically before the fix and pass afterward (2/2, 2.98 s), including the all-writes-denied rescue path. No product code or assertions changed. A-1563 remains the failed previous-head run; delta review and a fresh full suite follow.

### impl-284 · 2026-10-12T17:20:03.904Z

Full verify 40925663 is green at 76c65162: 1646/1646, A-1568. Under the Coordinator's batch rule, merged origin/dev including T-287. inbox.lua merged cleanly; manually resolved nvim/README.md by retaining T-284 Topics/Inbox documentation and T-287 Events documentation, and actions.lua by retaining inbox za with all events-filter registrations in separate contexts. The authorized targeted set passes: inbox-sections 3, inbox snapshot 1, events 2, events-quiet 2, CLI inbox 1, full palette/registry file 18. Additional headless checks reject duplicate za within inbox/events contexts, permit it in a distinct context, validate all expected inbox/event keys and audit mappings, and verify palette/Space-? listings. Added two keys-summary hint lines because Space-? omitted the merged keys; no callbacks changed. Requesting delta review of the integration/manual resolutions and text-only help correction, without another full suite as authorized.

### rev-24 · 2026-10-12T17:21:38.371Z

verdict: review
result: clear
by: rev-24 [reviewer]
run: rev-2026-10-12-284-3
commit: d09c4d855e355302eb1f480eb5aa4115ba5fa8db

No high, medium or low findings remain. C1–C7 verified at d09c4d855e355302eb1f480eb5aa4115ba5fa8db.
Both prior findings are fixed without weakening assertions. The integrated README/action registry preserves inbox folds and all events actions; inbox.lua changes only its independent events footer, and help additions are text-only.
Evidence: A-1571 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1571-t-284-integrated-head-review-clear-at-d09c4d8.md. Full run 40925663 is green at pre-integration 76c65162 (1646/1646, no skips; A-1568). Authorized integration checks on the combined tree pass 28/28 (A-1570), including inbox/CLI/events plus registry duplicate/context and palette/help listings. Coordinator batch authorization explicitly substitutes these checks and delta review for another full run; integrated dev verification follows T-291. No claim of a full suite run at this combined head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-12T17:21:51.289Z

Merged 37a6a2348b518c08e2c855560443ba77d0cfd355 onto dev.
