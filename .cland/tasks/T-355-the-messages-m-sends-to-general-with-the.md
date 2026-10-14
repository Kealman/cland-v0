---
id: T-355
kind: task
title: "The messages: m sends to General with the item context, M creates the item's topic when it has none and sends there, and a visual selection goes to General with one line per item, naming items by their display ids"
state: open
status: review
size: M
criterion_seq: 8
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by:
  - T-354
topic: topic-232
branch: t/T-355-the-messages-m-sends-to-general-with-the
created: 2026-10-13T20:53:51.934Z
updated: 2026-10-14T04:55:30.149Z
---

## Summary

The explorer's one action is a message to the Coordinator. `m` on a row or on the card sends to General with the item context riding along. `M` creates the item's topic when it has none and sends there. A `V` selection sends one message to General with the scope and one line per item. The Coordinator's clause says what these messages look like and that it acts on them through the tracker.

## Parent

E-276: The explorer and the card, tracer bullet 3. Spec: `docs/spec/v0.1.2.md` §3.8 (Read-only; the accepted mockups: P20, the message about a selection; the prototype's answers: two message keys, display ids) and §3.9 (the composer stays one line on the card until `m` opens it in place). Prototype: `explorer.lua` (`context_lines`, `destination`, `message`, `close_composer`, `payload`, `send`) on `prototype/explorer`. Board: `CardEpic.dc.html` block 9.

## What to build

**A composer module.** `nvim/lua/cland/explorer_compose.lua` holds the composer, the context lines, the destination and the send, ported from the prototype with its choices changed as below. `explorer.lua` and `explorer_card.lua` only call it.

**The keys** (action registry, scopes `explorer` and `card`):

| Key | Where | Destination |
| --- | --- | --- |
| `m` | tree row (normal), card | General, with the item's context line. From the card, the card line under the cursor rides along. |
| `M` | tree row (normal), card | The item's topic, through `items.topic(it)`. When it has none, `topic.create` with `title = "<id> <title>"` (cut to 200 characters) and `item = <id>`, then the send into the new topic. |
| `m`, `M` | tree, visual line selection (`x`) | General, with the scope and one line per selected item. Label and virtual rows in the selection are skipped. |

**`M` refusals.** A closed item cannot get a new topic, and the hub refuses it. `M` on a closed item without a topic says `<id> is closed: a closed item gets no topic; m sends to General` and opens nothing. `M` on a virtual row says it has no item.

**The context**, exactly as the Coordinator receives it, after the human's text and a blank line:

```
from the explorer · scope R-228 0.1.2 Working with items › E-276 · 3 items selected
E-276 · epic · in work · R-228 Working with items · rank 2760 · The explorer and the card
T-341 · task · planned · C-219 Bugs · rank 3410 · Claude Code relaunch keeps stale tool schemas
...
card line: <the card line under the cursor, trimmed>   (only from the card)
```

- Each item line carries the id, kind, status, container, rank and title.
- The id is the item's display id, its `id` since T-314. A container's status is its derived status. The container is the parent's id and title, or `no container`.
- The scope line is the breadcrumbs of ticket T-351.
- The frame is `topic.send` with `topic`, `text` and `to = { 'coordinator' }`, sent through the plugin's client as the human.
- A message over the hub's 8192-byte cap is cut before sending. Item lines are kept while they fit, then `… and K more: <ids>`, and the ids are cut too when they still do not fit. The test checks it with 300 selected rows.

**The composer** (P20). Two floats over the card, widened to 64 columns over the tree when the card is narrower:

- The read-only context: `to <coordinator> [Coordinator] · in <General | E-276's topic | E-276's topic, created on send>`, then `rides with it, as the Coordinator receives it:` and the context lines.
- A prompt buffer for the human's text. `↵` sends, `S-↵` adds a newline, and `Esc` or `q` closes it and keeps the draft per item or selection.
- A failed send keeps the draft and says why in the status line. A send while the hub is disconnected keeps the draft.
- Role `explorer_compose`, with its keys in the registry.
- The card's last line is the composer line: `m  message the Coordinator in General · M in <id>'s topic`, or `· M creates <id>'s topic` when it has none.

**The Coordinator's clause.** In `.cland/roles.toml` and the default template in `hub/src/roles/default-roles.ts`, the Coordinator's clause gains one line:

> The explorer's messages come from the human in General or the item's topic: the text, then `from the explorer · scope …` and one line per item (id · kind · status · container · rank · title). Act on them through the tracker.

- Cut as many bytes elsewhere in the Coordinator's clause as the line adds. The delivered-clause guard in `hub/test/roles.test.ts` (reply bytes within `MAX_TEXT_BYTES - CLAUSE_REPLY_HEADROOM_BYTES`) holds for both sources, and the test asserts the new line.
- The Coordinator relaunches after the merge to take the clause.

**The stub hub.** `nvim/test/stub-hub.ts`'s `topic.create` binds `item` when given: it sets the topic's `item`, writes the item's `topic`, sends a `task` event, and refuses a closed item or one that already has a topic, as `core.createTopic` does.

**Docs.**

- `nvim/README.md`'s Explorer section: `m`, `M`, the selection, the context format and the composer keys.
- The help lines.
- `docs/agents/issue-tracker.md` is untouched.
- `hub/README.md`'s roles section names the clause line only if it lists the clause's topics.

**Demo** (the epic's tracer bullet 3). `V` over three rows and `m` sends one message to General naming the three items by their display ids, as the Coordinator receives it. The stub hub's control socket returns the frame. `M` on an item without a topic creates the topic bound to it and sends there.

**Out of scope.** Any hand edit (§3.8). The board's rank keys and the plan approval stay as they are. Replies from the Coordinator are shown by the usual thread and inbox.

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input` (`V`, `jj`, `m`, text, `<CR>`), the screen read with `screenstring()`. The sent frames are read through the stub's control socket, as `vboard.test.ts`'s `control` helper does.
- The clause change is tested through the frame protocol with a real hub and spoke (`hub/test/roles.test.ts`). No new seams inside the hub.
- Tests wait on state, never on a sleep. Every key goes through the action registry.
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder. This delta touches the hub's clause, so it is not Neovim-only.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. `m` on a task row opens the composer with the context. `↵` sends one `topic.send` to General with `to = ["coordinator"]`, the text, a blank line, the scope line and the item's line, with the display id.
  - done: impl-355 · 2026-10-14T02:25:23.058Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.868Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
- [x] C2. `m` from the card adds the `card line:` line for the line under the card's cursor.
  - done: impl-355 · 2026-10-14T02:25:23.514Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.868Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
- [x] C3. `M` on an item with a topic sends into that topic. `M` on an open item without one sends `topic.create` with `item`, then `topic.send` into the new topic. The item's card then reads `M in <id>'s topic`.
  - done: impl-355 · 2026-10-14T02:25:24.112Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.868Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
- [x] C4. `M` on a closed item without a topic sends nothing and says why.
  - done: impl-355 · 2026-10-14T02:25:24.582Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.868Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
- [x] C5. `V` over three rows and `m` sends one message to General with `3 items selected` and three item lines. Label rows inside the selection are skipped.
  - done: impl-355 · 2026-10-14T02:25:25.201Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.869Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
- [x] C6. `Esc` keeps the draft, and the next `m` on the same item or selection shows it. A refused send keeps the draft. A 300-row selection is cut under 8192 bytes with `… and K more`.
  - done: impl-355 · 2026-10-14T02:25:25.829Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.869Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
- [x] C7. Both clause sources deliver the explorer line to the Coordinator within the byte guard (`hub/test/roles.test.ts`).
  - done: impl-355 · 2026-10-14T03:15:52.323Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.869Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
- [x] C8. `nvim/README.md`, the help lines and the Coordinator's clause describe the messages.
  - done: impl-355 · 2026-10-14T04:00:26.228Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-5 · 2026-10-14T04:01:08.818Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-6 · 2026-10-14T04:52:07.869Z · commit 812fa578b1e2cea815ebdcbc4614875da0d7324f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-355-7 · 2026-10-14T04:55:30.149Z · commit 4168a6e4870384d9188d2b0de199ca6b937005a5

## Comments

### impl-355 · 2026-10-14T02:22:24.865Z

Implemented explorer_compose.lua, registry mappings for row/card/visual messages, bound topic creation in the stub, context/draft handling and 8192-byte truncation, Coordinator clauses and docs. Seven targeted frame/UI tests pass (including real Coordinator delivery); both default/project delivered-clause guards pass. Typechecking and card regressions are being checked before source review. Full verification will follow a clear review at its exact head.

### rev-23 · 2026-10-14T02:30:51.454Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-355-1
commit: be077daeefd422d67b93fef9244c3e4055fdca06
scope: full

No high/medium findings. Complete source review covers row/card/visual routing and context, draft/failure handling, Unicode byte/title caps, stub bound topics, registry/help/docs and both compensated Coordinator clauses. Shared T-371 delta exactly matches reviewed/full-green patch. C8 source docs/help/clause verified; C1–C7 await ordinary full cland verify at this exact head, including both clause deliveries. Task requires an empty holder before submission; no per-item QA. A-2197: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2197-t-355-full-source-clear-at-be077dae.md. Source clear only; Coordinator relaunch after merge adopts its clause.

Criteria: C8 verified.

### rev-23 · 2026-10-14T03:13:42.420Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-355-2
commit: be077daeefd422d67b93fef9244c3e4055fdca06
scope: evidence

Medium — hub/src/roles/default-roles.ts:54 / .cland/roles.toml:45: changed opening fails handover.test.ts:103's delivered Coordinator clause assertion.
Medium — hub/src/roles/default-roles.ts:68 / .cland/roles.toml:60: compacted review/QA loop fails review-qa.test.ts:104's existing item-lead guard.
Exact-head full d55e55b1/A-2203 passes typecheck but exits 1 (1587/1589 hub tests; 2 failures; zero cancellations/skips). Neovim was not reached. C7 failed; preserve the assertions' meaning/strength, the explorer line and byte/headroom checks, obtain new source review and full evidence. UI source review otherwise retained. A-2204: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2204-t-355-full-verification-not-clear-coordinator-clause-guards.md (the review-loop source line is 68).

Criteria: C7 failed (Coordinator clause compaction breaks existing delivered handover and item-lead review/QA guards; full exact-head suite exits 1 before Neovim.).

### impl-355 · 2026-10-14T03:16:07.200Z

Full run d55e55b1 at be077dae failed two existing Coordinator wording guards; Neovim did not run (A-2203). Restored their original phrases with compensating cuts in both clause sources, committed/pushed 9dd2c1e9. Both reproduction tests and both delivered-clause guards now pass; typecheck and diff check pass. A-2205 records the repair; source re-review requested before the next exact-head full run.

### rev-23 · 2026-10-14T03:16:43.247Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-355-3
commit: 9dd2c1e9b2b3604f2d938c2bd19260d948fb45e6
scope: full

No high/medium findings remain. Both Coordinator guarded phrases restored verbatim; compensating status/handover cuts retain semantics and four sections/skill/revocation rule. New explorer line and all tests/byte guards unchanged; original complete UI source review retained. Project clause 6978 bytes versus 6987 pre-task; diff check clean. C8 refreshed; C1–C7 await new exact-head ordinary full evidence. Failed A-2203 preserved. A-2206: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2206-t-355-corrected-clause-source-clear-at-9dd2c1e9.md. Source clear, not final readiness.

Criteria: C8 verified.

### rev-23 · 2026-10-14T03:59:15.060Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-355-4
commit: 9dd2c1e9b2b3604f2d938c2bd19260d948fb45e6
scope: evidence

Medium — nvim/test/explorer.test.ts:234: expected complete action inventory lacks explorer:m and explorer:M introduced by this feature, so A-2225 fails unchanged deep equality (1954/1955 pass; zero skips/cancellations). Add both to the exact inventory, preserve previous entries/equality/help/hint checks, and assert their message help. Corrected-head source review and ordinary full verification required. A-2226: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2226-t-355-full-evidence-not-clear-explorer-action-inventory.md.

Criteria: C8 failed (The existing exact explorer action inventory lacks newly registered m/M actions; full Neovim help regression fails.).

### impl-355 · 2026-10-14T04:00:41.305Z

Full 0caffd51 at 9dd2c1e9 passed 1954/1955 tests; exact explorer action inventory lacked required m/M (A-2225/A-2226). Preserved and extended all existing assertions, added message help checks, and fixed missing static Keys instructions. Committed/pushed 812fa578. Entire explorer.test.ts: 13 pass; typecheck/diff check pass. A-2227 records the repair; source re-review requested before new exact-head full verification.

### rev-23 · 2026-10-14T04:01:08.818Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-355-5
commit: 812fa578b1e2cea815ebdcbc4614875da0d7324f
scope: full

No high/medium findings remain in corrected source. The exact inventory now includes m/M while preserving every previous action and mapping audit. Static Keys instructions match composer destinations, selection context, send/newline and draft-preserving close; status/help checks are stronger. Earlier complete feature/role review remains applicable. C8 source verified; C1–C7 and complete fresh exact-head full evidence pending. A-2228: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2228-t-355-corrected-keys-and-action-inventory-source-clear.md.

Criteria: C8 verified.

### impl-355 · 2026-10-14T04:51:47.447Z

Fresh full verification d6714fad at source-reviewed head 812fa578 passed: 1955/1955 tests, no failures/skips, typecheck included. Durable log A-2241: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2241-suite-d6714fad-589c-4a5c-8025-ec7dcdd1e0d1-all-at-812fa57.log. Working tree remains clean at that head. Awaiting the Reviewer’s final same-head verdict; the hub will notify the supervising lead when ready.

### rev-23 · 2026-10-14T04:52:07.869Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-355-6
commit: 812fa578b1e2cea815ebdcbc4614875da0d7324f
scope: evidence

No findings remain. Exact-head full d6714fad/A-2241 exits 0: typecheck, 37 hub free + 1552 hub machine + 366 Neovim = 1955/1955, zero failures/cancellations/skips/todo. Real hub delivery/topic binding and composer/context/draft/refusal/selection/cap cases pass, as do repaired registry/help/status and delivered default/project byte guards. Complete source assessments A-2197/A-2206/A-2228 retained; C1–C8 all checked. A-2242: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2242-t-355-final-exact-head-review-clear-explorer-messages.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### impl-355 · 2026-10-14T04:54:48.289Z

Coordinator merge conflicted with T-348 executor clauses. Per b8689dab merged origin/dev 4e127928, preserving both executor and explorer instructions in both clause sources and existing byte limits. Committed/pushed 4168a6e4. Typecheck and all 8 roles.test.ts tests, including both delivered-clause guards, pass. A-2243 records resolution; delta source review requested before new full exact-head verification.

### rev-23 · 2026-10-14T04:55:30.149Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-355-7
commit: 4168a6e4870384d9188d2b0de199ca6b937005a5
scope: delta

No high/medium integration findings. Both clause sources retain explorer and executor instructions, guarded Coordinator/review ownership and byte budget; role assertions combine both parents without removal. All nvim source/help/tests and shared PID cases match previous reviewed head, incoming nonoverlap matches landed dev exactly, and harness adds only landed token/ledger isolation. C8 source refreshed; C1–C7 require fresh integrated-head full evidence. A-2244: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2244-t-355-integration-delta-clear-executor-and-explorer-clauses.md.

Criteria: C8 verified.
