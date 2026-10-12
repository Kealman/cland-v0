---
id: T-274
kind: epic
title: Inbox and the events view
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: T-228
blocked_by: []
topic: topic-182
branch: null
created: 2026-10-12T11:35:14.306Z
updated: 2026-10-12T22:59:14.808Z
---

## Goal

The inbox holds only what needs the human now, in four sections with a rule for when each row leaves, and everything else that happened moves to an events view the human opens when they want to know what happened. Today the inbox shows asks, approvals and waiting topics above a list of up to 50 notifications that the human dismisses with `d` and `D`, and a request for the human's review or QA arrives as an ordinary message.

## Contents

- **§3.7 The inbox and the events view**, whole, hub and Neovim:
  - **The inbox on the now layer only**, in four sections: asks and approvals (questions and command approvals); plan approvals, second, because an Aide may approve a plan but not answer asks or commands; requests to the human (a message of the new kind `request`: a review request, a QA request, a handover); messages to the human (one row per now-layer message, in the sender's role colour; a topic waiting without an ask shows its latest message here). Each section is newest first, shows the last five and folds the rest into an "N more" line that names the oldest wait; every row shows its waiting age. The selected row unfolds in place (an ask's options and free answer, a command in full); `r` replies from a row; `d` removes a row (a request is declined and its sender told, a message is marked read); `A` shows the inbox archive, what left the inbox in the last seven days and why. The empty state keeps the events line and the archive line.
  - **The chip is the inbox count.** The hub's needsYou grows to the four kinds, each with its leave rule: answered, approved, replied or a verdict given, read or answered. The protocol gains the `request` send kind addressed to the human; a plan waiting under `[plan] approval = "human"` feeds the inbox.
  - **Warnings.** Not-clear verdicts and session deaths stay warn-level events (D17 of v0.1 §4); the placement table of v0.1 §3.5 is already amended. An event a project override raises to now has no inbox row: it shows among the events view's warnings.
  - **The events view.** `␣E` opens it from anywhere, as do `e` or Enter on the inbox's events line and the palette action; `␣␣` goes back. Notifications and events newest first, grouped by day with day rules: the newest 200 rows that match the filter, `A` loads 200 older ones from the journal, `za` folds a day. A row is the time, a glyph, the kind, the subject and one line; Enter opens the subject (a card, a session, a topic, an artifact), `gi`, `gt` and `gs` jump, `gM` mutes the subject's events. Bookkeeping rows (launches, stops, claims, status moves, criterion marks, topic closes) are dimmed, and equal events on one subject within 60 seconds merge into one row with ×N; a red suite on `dev` is warn-level, on a task branch ordinary. Filter keys: `1` to `8` by kind (session, task, verdict, suite, release, artifact, usage, topic), `0` all, `w` warnings only, `s` a subject through the palette prefixes, `F` clears; the filter is kept in `ui.json`. Opening the view sets the human's last look; the inbox's events line, "△ N new events since your last look · ⚠ M", is in the watch colour. Nothing still waiting in the inbox repeats in the events view.
  - **The old list retires**: the notification list of v0.1.1, with its `d` and `D` and its 50-row cap.

Not in this epic: the card that Enter opens for an item event once "The explorer and the card" lands (the item view until then); the sessions panel's rows and its verify line ("Sessions: stopped sessions, verifiers' items, the queue line").

Choices where the spec is silent:

- `send` takes `kind: "request"` only with the human as recipient, with a `request` field of `review`, `qa` or `handover` and a subject (an item, an artifact or a session). Any session may send one. A request leaves on the human's reply (`r` on the row, or in its topic), on a verdict the human writes on the named item, or on `d`, which declines it and sends the sender one line saying so.
- A message row leaves when the human opens it, marks it read with `d`, or answers in its topic; the hub keeps the read mark per message.
- Every row that leaves the inbox is journaled with its reason (`answered`, `approved`, `replied`, `declined`, `read`); `inbox.list` with `archive: true` returns the last seven days; `cland inbox` prints the four sections, and `cland inbox --archive` the archive.
- The events view reads the journal through a new frame, `events.list`, which returns at most 200 rows older than a cursor that match a filter, already merged and classed (bookkeeping, warning); live rows come from the hub's pushes, as the inbox's do.
- The last look is a timestamp in `ui.json`; the events line counts the loaded rows newer than it and reads "200+" past the cap.
- `gM` adds the subject to the mutes in `ui.json` (v0.1 §3.5's pins and mutes): the events view hides its rows and says how many subjects it hides; a mute never hides a now-layer row in the inbox.
- The kinds' glyphs are the Events board's.
- With `[plan] approval = "none"` no plan feeds the inbox; a plan the human must approve under that setting ("The explorer and the card") reaches the human as an ask in the first section.

## Tracer-bullet order

1. **The request kind and needsYou.** The `request` send kind addressed to the human, and needsYou counting the four kinds by their leave rules, each departure journaled with its reason. Demo: an Aide's review request to the human raises the chip by one, and the human's reply lowers it and journals `replied`.
2. **The four sections.** The inbox redrawn in its four sections, newest first, five per section with the "N more" line naming the oldest wait, the age on every row and the selected row unfolded in place, with `cland inbox` printing the same. Demo: the headless workbench shows an ask first, a plan approval second, a request third and a message fourth, each with its age.
3. **Acting from a row.** `r` replies from a row, `d` declines a request (telling its sender) or marks a message read, and `A` shows the seven-day archive with each row's reason. Demo: `d` on a request sends its sender the decline and moves the row to the archive as `declined`.
4. **The events view.** `events.list` over the journal and the view on `␣E`, the inbox's events line and the palette, with day groups and rules, 200 rows, `A` for older rows, `za` per day, Enter and the jumps. Demo: `␣E` opens today's rows newest first, and `A` loads the 200 before them.
5. **Quiet rows and filters.** Bookkeeping dimmed, equal events within 60 seconds merged with ×N, the warning class with the red suite on `dev`, the filter keys kept in `ui.json`, `gM`, and the last look behind the inbox's events line. Demo: `w` shows only warnings, a burst of five equal events shows as one row ×5, and the events line drops to zero once the view opens.
6. **The old list retires.** The notification list with its `d`, `D` and 50-row cap leaves the inbox, and the docs and the clauses follow. Demo: a clear verdict shows in the events view and never in the inbox.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with the fake harnesses and `[plan] approval = "human"`, an Implementer's ask, a session waiting for a command approval, an epic's plan waiting for approval, an Aide's review request and a QA's message to the human reach the inbox; the headless workbench shows them in the four sections with their ages, and the chip counts five. The human answers the ask, approves the plan in the plan view, replies to the request with `r` and marks the message read with `d`; each row leaves, and `A` lists them with their reasons. A not-clear verdict and a session death show only in the events view, as warnings; a burst of equal events shows as one row with ×N; `w`, `1` to `8`, `0`, `s` and `F` filter as described, and the filter survives a restart of the workbench; opening the view clears the inbox's events line. `cland inbox` and `cland inbox --archive` print the same.

- [ ] C1. The inbox shows only the now layer, in four sections in the decided order, newest first, five per section with an "N more" line naming the oldest wait, and the waiting age on every row.
  - verified: qa-27 [qa] · run qa-2026-10-12-27 · 2026-10-12T22:10:06.322Z · commit fdf5d2631bc02220330f6d1792ea371b574c9f16
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e
- [ ] C2. needsYou counts the four kinds, each row leaves by its rule, and the chip equals the inbox count.
  - verified: qa-27 [qa] · run qa-2026-10-12-27 · 2026-10-12T22:10:32.411Z · commit fdf5d2631bc02220330f6d1792ea371b574c9f16
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e
- [ ] C3. `send` has the `request` kind addressed to the human; `r` replies from a row; `d` declines a request with its sender told, or marks a message read.
  - verified: qa-27 [qa] · run qa-2026-10-12-27 · 2026-10-12T22:10:33.372Z · commit fdf5d2631bc02220330f6d1792ea371b574c9f16
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e
- [ ] C4. `A` shows what left the inbox in the last seven days and why, and `cland inbox --archive` prints it.
  - verified: qa-27 [qa] · run qa-2026-10-12-27 · 2026-10-12T22:10:33.991Z · commit fdf5d2631bc02220330f6d1792ea371b574c9f16
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e
- [ ] C5. The events view opens on `␣E`, from the inbox's events line and from the palette; it shows the newest 200 matching rows by day, loads older ones with `A`, dims bookkeeping, merges equal events within 60 seconds, and filters by kind, warnings and subject, kept in `ui.json`.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e
- [ ] C6. Opening the events view sets the last look; the inbox's events line counts what is new since, with warnings apart; nothing still waiting in the inbox repeats in the view.
  - verified: qa-27 [qa] · run qa-2026-10-12-27 · 2026-10-12T22:10:34.768Z · commit fdf5d2631bc02220330f6d1792ea371b574c9f16
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e
- [ ] C7. The v0.1.1 notification list, its `d` and `D` and its cap are gone.
  - verified: qa-27 [qa] · run qa-2026-10-12-27 · 2026-10-12T22:10:35.281Z · commit fdf5d2631bc02220330f6d1792ea371b574c9f16
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e
- [ ] C8. `hub/README.md`, `nvim/README.md` and the role clauses describe the inbox, the `request` kind and the events view.
  - verified: qa-27 [qa] · run qa-2026-10-12-27 · 2026-10-12T22:10:35.958Z · commit fdf5d2631bc02220330f6d1792ea371b574c9f16
  - verified: qa-27 [qa] · run qa-2026-10-13-27-2 · 2026-10-12T22:58:54.296Z · commit 0fcb242df2bc44716d6a85c45aceb57efb26816e

## Dogfooding

From this epic on the human steers the rest of the build from the inbox: the Coordinator's asks sit first, the crew's requests to the human arrive as request rows, and the human opens the events view when they want to know what happened while they were away.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/`); no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **ADRs.** 0005 (Neovim is the host): the inbox and the events view are Neovim views with no plugins. 0007 (Events reach sessions as deliveries): the events view shows the events the hub announces, from the journal.
- **Risks.** The journal holds about 135 thousand records already, so `events.list` must page from the end without reading the whole file. The leave rules and the read marks must survive a hub restart.
- **References.** The boards `InboxNow.dc.html` and `Events.dc.html`, with their proposals P1 to P18, come after the spec's words; `Inbox.dc.html` is superseded.
- **Order.** First in the Neovim lane, with no blocker; "Sessions: stopped sessions, verifiers' items, the queue line" waits for it.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.7 The inbox and the events view; `docs/spec/v0.1.md` §3.5 (the amended table), §3.9 (the hygiene of events), §4 (D17).
- Tickets: T-247 (decided, closed into this epic); T-261 (the mockups); T-171 (D17).
- GLOSSARY: Request, Event, Events view, Ask, Layer.
- ADRs: `docs/adr/0005-neovim-is-the-host.md`, `docs/adr/0007-events-reach-sessions-as-deliveries.md`.
- Mockups: `docs/design/main-screen/InboxNow.dc.html`, `Events.dc.html`; `screens/v012-inbox-now.png`, `screens/v012-events.png`.

## Plan

```yaml
stages:
  - name: the request kind and the events frame
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-283
      - - T-286
  - name: the four sections and the quiet events view
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-284
      - - T-287
  - name: acting from a row
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-285
  - name: the old list retires
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-288
  - name: QA findings
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-310
```

## Comments

### coord · 2026-10-12T11:58:20.213Z

Tickets cut on 2026-10-12 (Coordinator): T-283 the request kind and needsYou → T-284 the four sections → T-285 acting from a row; in parallel T-286 the events view and events.list → T-287 quiet rows, warnings, filters, gM, the last look; both chains join at T-288, the old list retires. Native edges; a four-stage plan with two lanes. Decisions where the drafts asked: (1) the journal gap before T-286 is accepted, no backfill from hub.db; the README says older periods lack suite and artifact rows. (2) No default usage threshold in this epic; the usage kind may stay empty until the per-session usage records of T-270. (3) The inbox's A moves from the archive layer toggle (T-191) to the seven-day inbox archive. (4) gM is an events-view-only mute list in ui.json; the hub's visibility mutes and the inbox are untouched. (5) A withdrawn or cancelled ask and a plan that leaves unapproved journal their own state as the reason. (6) The request kind is the one exception to the send:human rule, for any role. (7) Requests come from the explicit kind only; no first line is parsed. (8) T-288 also waits for T-287 so the view is complete before the list goes. Hot file: nvim/lua/cland/inbox.lua is edited by five tickets; the events-view tickets keep their inbox change to the one events line, and new test helpers stay out of hub/test/harness.ts, which the hub lane is rewriting.

### coord · 2026-10-12T15:16:00.421Z

Lesson for this epic (from T-293, the stand-in's note of 2026-10-12): T-283 merged with a clear review and a green full suite, yet it made hub start take minutes on the live store: inbox.observe() ran a full list() synchronously on every hub event, and the replied subquery's OR defeated the (topic, seq) index (3.8 s per call on 16,772 messages, once per remembered process at startup). The suite's small fixtures cannot show it. For T-284, T-285 and T-288, which change the inbox further: review asks for the inbox work per event and per startup on a store of the live tracker's size, and each such ticket adds or keeps a regression test that bounds it (T-293's first follow-up). The fixes are 76d679f and b75e0fe on dev.

### qa-27 · 2026-10-12T22:11:31.752Z

verdict: qa
result: not clear
by: qa-27 [qa]
run: qa-2026-10-12-27
commit: fdf5d2631bc02220330f6d1792ea371b574c9f16

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M0 | hub-api | PASS | [M0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M0.txt) |
| M1 | hub-api | PASS | [M1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M1.txt) |
| M2 | hub-api | PASS | [M2-hub_test_inbox-requests.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M2-hub_test_inbox-requests.test.ts.txt) |
| M3 | hub-api | PASS | [M3-hub_test_inbox-actions.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M3-hub_test_inbox-actions.test.ts.txt) |
| M4 | hub-api | PASS | [M4-hub_test_inbox-workload.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M4-hub_test_inbox-workload.test.ts.txt) |
| M5 | hub-api | PASS | [M5-hub_test_events.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M5-hub_test_events.test.ts.txt) |
| M6 | hub-api | PASS | [M6-hub_test_events-quiet.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M6-hub_test_events-quiet.test.ts.txt) |
| M7 | hub-api | PASS | [M7-hub_test_visibility.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M7-hub_test_visibility.test.ts.txt) |
| M8 | hub-api | PASS | [M8-nvim_test_inbox-sections.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M8-nvim_test_inbox-sections.test.ts.txt), [M8-nvim_test_inbox-actions.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M8-nvim_test_inbox-actions.test.ts.txt), [M8-nvim_test_needs-you.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M8-nvim_test_needs-you.test.ts.txt) |
| M9 | hub-api | PASS | [M9-nvim_test_events.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M9-nvim_test_events.test.ts.txt), [M9-nvim_test_events-quiet.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M9-nvim_test_events-quiet.test.ts.txt) |
| M10 | hub-api | PASS | [M10-nvim_test_layers.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-nvim_test_layers.test.ts.txt), [M10-hub_test_asks-cli.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_asks-cli.test.ts.txt), [M10-hub_test_asks.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_asks.test.ts.txt), [M10-hub_test_claude-code-adapter.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_claude-code-adapter.test.ts.txt), [M10-hub_test_codex-adapter.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_codex-adapter.test.ts.txt), [M10-hub_test_codex-delivery.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_codex-delivery.test.ts.txt), [M10-hub_test_default-subscriptions.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_default-subscriptions.test.ts.txt), [M10-hub_test_handover.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_handover.test.ts.txt), [M10-hub_test_opencode-adapter.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_opencode-adapter.test.ts.txt), [M10-hub_test_plan-approval.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_plan-approval.test.ts.txt), [M10-hub_test_review-qa.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_review-qa.test.ts.txt), [M10-hub_test_session-stop-races.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_session-stop-races.test.ts.txt), [M10-hub_test_surface.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-hub_test_surface.test.ts.txt), [M10-nvim_test_graph.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-nvim_test_graph.test.ts.txt), [M10-nvim_test_palette.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M10-nvim_test_palette.test.ts.txt) |
| M11 | headless-grid | PASS | [PANELS-008-runner.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/PANELS-008-runner.txt), [THREAD-009-runner.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/THREAD-009-runner.txt), [THREAD-010-runner.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/THREAD-010-runner.txt) |
| M12 | hub-api | PASS | [M12-setup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M12-setup.txt), [M12-continue.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M12-continue.txt), [M12-drivers-continue.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M12-drivers-continue.txt), [M12-inbox.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M12-inbox.json), [M12-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M12-status.json), [M12-before-forward.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M12-before-forward.json), [M12-forward.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M12-forward.json) |
| M13 | hub-api | PASS | [M13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M13.txt) |
| M14 | headless-grid | PASS | [M14-full.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M14-full.screen.txt), [M14-ask-selected.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M14-ask-selected.screen.txt), [M14-approval-selected.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M14-approval-selected.screen.txt), [M14-plan-selected.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M14-plan-selected.screen.txt), [M14-panel.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M14-panel.screen.txt), [M14-aged.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M14-aged.screen.txt), [M14-more.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M14-more.txt) |
| M15 | hub-api | PASS | [M15.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M15.jsonl) |
| M16 | headless-grid | PASS | [M16-send.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M16-send.txt), [M16-actions.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M16-actions.txt), [M16-fold.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M16-fold.screen.txt), [M16-open.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M16-open.screen.txt), [M16-closed.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M16-closed.screen.txt) |
| M17 | headless-grid | PASS | [M17-ask.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M17-ask.txt), [M17-actions.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M17-actions.txt), [M17-final.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M17-final.txt), [M17-ask-composer.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M17-ask-composer.screen.txt), [M17-plan.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M17-plan.screen.txt), [M17-request-composer.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M17-request-composer.screen.txt), [M17-six-notes.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M17-six-notes.screen.txt) |
| M18 | headless-grid | PASS | [M18-before.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M18-before.json), [M18-after.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M18-after.txt), [M18-refusals.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M18-refusals.txt) |
| M19 | headless-grid | PASS | [M19.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M19.txt), [M19-empty.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M19-empty.screen.txt) |
| M20 | headless-grid | PASS | [M20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M20.txt), [M20-archive.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M20-archive.screen.txt), [M20-hidden.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M20-hidden.screen.txt), [M20-archive.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M20-archive.json), [M20-cli.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M20-cli.json), [M20-journal.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M20-journal.json) |
| M21 | hub-api | PASS | [M21.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M21.txt) |
| M22 | hub-api | PASS | [M22-setup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M22-setup.txt), [M22-after.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M22-after.txt), [M22-settled.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M22-settled.jsonl), [M22-after.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M22-after.screen.txt), [M22-verdicts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M22-verdicts.json) |
| M23 | hub-api | PASS | [M23.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M23.txt) |
| M24 | headless-grid | PASS | [M24-open-normal.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-open-normal.screen.txt), [M24-navigation.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-navigation.txt), [M24-details.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-details.txt), [M24-palette.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-palette.screen.txt), [M24-enter.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-enter.screen.txt), [M24-e.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-e.screen.txt), [M24-footer.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-footer.screen.txt), [M24-older.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-older.screen.txt), [M24-day-fold.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-day-fold.screen.txt), [M24-day-open.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-day-open.screen.txt), [M24-burst.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-burst.screen.txt), [M24-item.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-item.screen.txt), [M24-session.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-session.screen.txt) |
| M25 | headless-grid | FAIL | [M25.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M25.txt), [M25-warnings.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M25-warnings.screen.txt), [M25-clear.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M25-clear.screen.txt), [M22-settled.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M22-settled.jsonl) |
| M26 | headless-grid | FAIL | [M26-before.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M26-before.txt), [M26-after.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M26-after.txt), [M26-before-restart.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M26-before-restart.screen.txt), [M26-restored.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M26-restored.screen.txt) |
| M27 | headless-grid | PASS | [M22-after.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M22-after.screen.txt), [M27-normal.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M27-normal.txt), [M24-open-normal.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M24-open-normal.screen.txt), [M27-zero-normal.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M27-zero-normal.screen.txt), [M27-one-normal.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M27-one-normal.screen.txt), [M27-rule-normal.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M27-rule-normal.screen.txt), [M27-zero-again-normal.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M27-zero-again-normal.screen.txt) |
| M28 | headless-grid | PASS | [M28.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M28.txt), [M28-muted.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M28-muted.screen.txt), [M28-restored.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M28-restored.screen.txt) |
| M29 | headless-grid | PASS | [M29.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M29.txt), [M29-before.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M29-before.json), [M29-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M29-after.json), [M29-D.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M29-D.screen.txt), [M29-help.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M29-help.screen.txt), [M29-palette.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M29-palette.screen.txt) |
| M30 | hub-api | PASS | [M30-docs.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M30-docs.txt) |
| M31 | hub-api | PASS | [M31-flush.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M31-flush.json), [M31-teardown.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M31-teardown.txt), [M31-final.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/M31-final.txt) |
| PANELS-008 | headless-grid | PASS | [palette-answer.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/palette-answer.screen.txt), [palette-answer.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/palette-answer.state.json), [PANELS-008.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/PANELS-008.screen.txt), [PANELS-008.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/PANELS-008.state.json) |
| THREAD-009 | headless-grid | PASS | [now-count-120.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/now-count-120.screen.txt), [now-count-120.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/now-count-120.state.json), [THREAD-009.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/THREAD-009.screen.txt), [THREAD-009.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/THREAD-009.state.json) |
| THREAD-010 | headless-grid | PASS | [now-count-80.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/now-count-80.screen.txt), [now-count-80.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/now-count-80.state.json), [THREAD-010.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/THREAD-010.screen.txt), [THREAD-010.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/THREAD-010.state.json) |

Medium — M25, M26 / C5: one not-clear verdict appears twice in the events view. In the scratch project, `cland task comment T-5 "Fix the fold." --verdict review --result "not clear" --run qa274-nc --as rev --role reviewer`, followed by `events.list {"filter":{"warnings":true}}` and the workbench `w`, returns both `T-5 review not clear · rev [reviewer] · run qa274-nc` and `T-5 verdict posted review not clear · qa274-nc`. Both are warn-level rows with distinct IDs. With one session death the view has three warning rows rather than two. Restarting the workbench with kind=verdict and warnings=true restores two rows for the same verdict. Saved filters, other kind/subject filters, and F otherwise work. The duplicate clear verdict is also visible in M22-verdicts.json. No product fix was made.

Result: **not clear**. Commit: `fdf5d2631bc02220330f6d1792ea371b574c9f16`. Run: `qa-2026-10-12-27`. Criteria C1,C2,C3,C4,C6,C7,C8 verified individually in this run; C5 failed in the verdict. Stable IDs match the brief’s checkbox order.

Validation: 26 serial single-file invocations, 221 tests passed, zero failures/skips; three catalogue cases passed. M0–M24 and M27–M31 pass with the recorded Coordinator clarifications. No QA full suite was submitted. Queue evidence records waits and current holders. Scratch processes stopped and scratch directories removed; no machine-lock references in scratch logs. Dev remained at the requested SHA.

Coordinator clarifications and execution notes:

Coordinator clarifications in topic-182, preserving build fdf5d2631bc02220330f6d1792ea371b574c9f16:

1. 456841e2-d5ca-4df8-9bab-a7cb20ce2431 (21:54:10Z): "BLOCKED only if any remote points outside /private/tmp/qa-T-274, such as GitHub or the root's territory, or if a github remote exists." The expected origin is the scratch project's own .cland/territory.git.
2. 6aa8ddb4-56ea-438d-a70e-a05dffcdf78f (21:55:01Z): "Rename every driver whose name equals a role name ... by adding -q: aide-q, qa-q, and so on." Other names and roles unchanged.
3. 65d8026a-b7fa-4b3f-9baf-981ce5eb2e1d (22:00:28Z): "Across local midnight, M20 expects archiveToday to equal the departures after local midnight (Oct 13), while the seven-day archive still lists all twelve with their reasons." Actual: 12 archive rows, 8 today; exact local timestamps in M20-journal.json after conversion to Europe/Belgrade.
4. d86a6267-edde-472e-9811-829f9adea036 (22:02:39Z): "×5 for backlog→planned and ×4 for planned→backlog is the correct merging." New IB starts backlog; the first prescribed edit is a no-op.

Same message confirms duplicate verdict warnings are a product finding: "A single verdict should give one warning row in the events view. Do not adjust for it: judge M25 as the brief states and record the duplication as a finding with both row texts."

Driver adaptations: connectUi receives scratch root alongside socket/secret. Driver processes are kept in one persistent shell so the command runner cannot reap them when a setup invocation exits. Driver responses are awaited by command rather than reading the previous line after a fixed delay. Row selection reads the buffer and feeds j/k one at a time; Lua string literals preserve Unicode. Opening General through the palette focuses its Insert-mode composer, so Esc is required before Normal-mode mappings. No accidentally typed draft was sent. M27's completed one-new-event check used planned after the preliminary backlog change made before the actual first events opening.

Recordkeeping: initial M2–M7 INCONCLUSIVE entries were a TAP-only parser error; explicit PASS corrections were appended after inspecting original Node text-reporter captures (no tests rerun). Initial M12 BLOCKED entry was superseded after the Coordinator's remote clarification. Original lines and captures remain preserved.


Local departure times (Europe/Belgrade): ask answered Oct 12 23:59:23.587; command approved 23:59:38.471; plan approved 23:59:43.327; request replied 23:59:48.668; message read Oct 13 00:00:01.135; request declined 00:00:25.713; six notes answered 00:00:45.111–112. Seven-day total 12; archiveToday 8.

Evidence artifact A-1664: [report and complete evidence](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1664-t-274-qa-evidence-duplicate-verdict-warnings/README.md).

Criteria: C5 failed (M25/M26: one not-clear verdict produces two warning rows, including after a saved-filter workbench restart.).

### qa-27 · 2026-10-12T22:58:54.296Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-13-27-2
commit: 0fcb242df2bc44716d6a85c45aceb57efb26816e

| Case | Surface | Result | Evidence (A-1673) |
| --- | --- | --- | --- |
| M0 | hub-api | PASS | [M0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M0.txt) |
| M1 | hub-api | PASS | [M1.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M1.txt) |
| M2 | hub-api | PASS | [M2-hub_test_inbox-requests.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M2-hub_test_inbox-requests.test.ts.txt) |
| M3 | hub-api | PASS | [M3-hub_test_inbox-actions.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M3-hub_test_inbox-actions.test.ts.txt) |
| M4 | hub-api | PASS | [M4-hub_test_inbox-workload.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M4-hub_test_inbox-workload.test.ts.txt) |
| M5 | hub-api | PASS | [M5-hub_test_events.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M5-hub_test_events.test.ts.txt) |
| M6 | hub-api | PASS | [M6-hub_test_events-quiet.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M6-hub_test_events-quiet.test.ts.txt) |
| M7 | hub-api | PASS | [M7-hub_test_visibility.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M7-hub_test_visibility.test.ts.txt) |
| M8 | hub-api | PASS | [M8-nvim_test_inbox-sections.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M8-nvim_test_inbox-sections.test.ts.txt) |
| M9 | hub-api | PASS | [M9-nvim_test_events.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M9-nvim_test_events.test.ts.txt) |
| M10 | hub-api | PASS | [M10-nvim_test_layers.test.ts.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M10-nvim_test_layers.test.ts.txt) |
| M11 | headless-grid | PASS | [PANELS-008-runner.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/PANELS-008-runner.txt) |
| M12 | hub-api | PASS | [M12-setup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M12-setup.txt) |
| M13 | hub-api | PASS | [M13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M13.txt) |
| M14 | headless-grid | PASS | [M14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M14.txt) |
| M15 | hub-api | PASS | [M15.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M15.jsonl) |
| M16 | headless-grid | PASS | [M16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M16.txt) |
| M17 | headless-grid | PASS | [M17-ask.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M17-ask.txt) |
| M18 | hub-api | PASS | [M18-send.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M18-send.json) |
| M19 | headless-grid | PASS | [M19.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M19.txt) |
| M20 | headless-grid | PASS | [M20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M20.txt) |
| M21 | hub-api | PASS | [M21.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M21.txt) |
| M22 | hub-api | PASS | [M22-after.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M22-after.txt) |
| M23 | hub-api | PASS | [M23.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M23.txt) |
| M24 | headless-grid | PASS | [M24-open.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M24-open.txt) |
| M25 | headless-grid | PASS | [M25.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M25.txt) |
| M26 | headless-grid | PASS | [M26-before.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M26-before.txt) |
| M27 | headless-grid | PASS | [M27.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M27.txt) |
| M28 | headless-grid | PASS | [M28.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M28.txt) |
| M29 | headless-grid | PASS | [M29.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M29.txt) |
| M30 | hub-api | PASS | [M30.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M30.txt) |
| M31 | hub-api | PASS | [M31-start.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/M31-start.txt) |
| PANELS-008 | headless-grid | PASS | [palette-answer.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/palette-answer.screen.txt) |
| THREAD-009 | headless-grid | PASS | [now-count-120.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/now-count-120.screen.txt) |
| THREAD-010 | headless-grid | PASS | [now-count-80.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/now-count-80.screen.txt) |

Findings by severity: high — none; medium — none; low — none.

All 32 manual checks and three catalogue cases passed. The 26 serial single-file test runs passed 224 tests, with no failures or skips. No full suite was run (excluded by the brief).

T-310 regression resolved: M22/M25 have exactly two warning rows, `doomed died` and `T-5 review not clear · rev [reviewer] · run qa274-nc`. M26 restores exactly one not-clear verdict row after a cold workbench restart. No duplicate `verdict posted` warning remains.

The four earlier Coordinator clarifications are incorporated in the committed amended brief: scratch-local origin is permitted; role-named drivers use -q; archiveToday is local-day-aware; the initial no-op means status groups ×5 and ×4. This run’s twelve departures all occurred Oct 13, 00:54:55.551–00:55:07.846 Europe/Belgrade; archiveToday=12 and seven-day archive=12, with expected reasons.

Criteria marks: verified C1,C2,C3,C4,C5,C6,C7,C8 in run qa-2026-10-13-27-2 at 0fcb242df2bc44716d6a85c45aceb57efb26816e. Criterion IDs match the brief by text. Scratch teardown complete; machine lock listing and empty queue unchanged; no product edits. HEAD/dev rechecked unchanged before verdict.

Full commands, case notes, captures and test outputs: [A-1673 evidence](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1673-t-274-qa-clear-full-rerun-and-duplicate-verdict-regression/README.md).

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-12T22:59:14.808Z

Closed on QA's clear epic demo, run qa-2026-10-13-27-2 at dev 0fcb242 (A-1673): M0–M31, three catalogue cases and 224 tests in 26 serial files passed, C1–C8 verified. Children T-283 to T-288 and the QA finding T-310 (one verdict, one warning row) merged. The first run (qa-2026-10-12-27) failed C5 on the duplicate warning; the brief gained four clarifications (849c28a).
