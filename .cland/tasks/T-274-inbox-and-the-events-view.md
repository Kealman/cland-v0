---
id: T-274
kind: epic
title: Inbox and the events view
state: open
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
updated: 2026-10-12T21:35:22.361Z
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

- [ ] The inbox shows only the now layer, in four sections in the decided order, newest first, five per section with an "N more" line naming the oldest wait, and the waiting age on every row.
- [ ] needsYou counts the four kinds, each row leaves by its rule, and the chip equals the inbox count.
- [ ] `send` has the `request` kind addressed to the human; `r` replies from a row; `d` declines a request with its sender told, or marks a message read.
- [ ] `A` shows what left the inbox in the last seven days and why, and `cland inbox --archive` prints it.
- [ ] The events view opens on `␣E`, from the inbox's events line and from the palette; it shows the newest 200 matching rows by day, loads older ones with `A`, dims bookkeeping, merges equal events within 60 seconds, and filters by kind, warnings and subject, kept in `ui.json`.
- [ ] Opening the events view sets the last look; the inbox's events line counts what is new since, with warnings apart; nothing still waiting in the inbox repeats in the view.
- [ ] The v0.1.1 notification list, its `d` and `D` and its cap are gone.
- [ ] `hub/README.md`, `nvim/README.md` and the role clauses describe the inbox, the `request` kind and the events view.

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
```

## Comments

### coord · 2026-10-12T11:58:20.213Z

Tickets cut on 2026-10-12 (Coordinator): T-283 the request kind and needsYou → T-284 the four sections → T-285 acting from a row; in parallel T-286 the events view and events.list → T-287 quiet rows, warnings, filters, gM, the last look; both chains join at T-288, the old list retires. Native edges; a four-stage plan with two lanes. Decisions where the drafts asked: (1) the journal gap before T-286 is accepted, no backfill from hub.db; the README says older periods lack suite and artifact rows. (2) No default usage threshold in this epic; the usage kind may stay empty until the per-session usage records of T-270. (3) The inbox's A moves from the archive layer toggle (T-191) to the seven-day inbox archive. (4) gM is an events-view-only mute list in ui.json; the hub's visibility mutes and the inbox are untouched. (5) A withdrawn or cancelled ask and a plan that leaves unapproved journal their own state as the reason. (6) The request kind is the one exception to the send:human rule, for any role. (7) Requests come from the explicit kind only; no first line is parsed. (8) T-288 also waits for T-287 so the view is complete before the list goes. Hot file: nvim/lua/cland/inbox.lua is edited by five tickets; the events-view tickets keep their inbox change to the one events line, and new test helpers stay out of hub/test/harness.ts, which the hub lane is rewriting.

### coord · 2026-10-12T15:16:00.421Z

Lesson for this epic (from T-293, the stand-in's note of 2026-10-12): T-283 merged with a clear review and a green full suite, yet it made hub start take minutes on the live store: inbox.observe() ran a full list() synchronously on every hub event, and the replied subquery's OR defeated the (topic, seq) index (3.8 s per call on 16,772 messages, once per remembered process at startup). The suite's small fixtures cannot show it. For T-284, T-285 and T-288, which change the inbox further: review asks for the inbox work per event and per startup on a store of the live tracker's size, and each such ticket adds or keeps a regression test that bounds it (T-293's first follow-up). The fixes are 76d679f and b75e0fe on dev.
