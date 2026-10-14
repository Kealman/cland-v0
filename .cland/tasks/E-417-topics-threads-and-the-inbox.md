---
id: E-417
kind: epic
title: Topics, threads and the inbox
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-413
  - E-416
topic: null
branch: null
created: 2026-10-14T15:59:24.765Z
updated: 2026-10-14T16:00:01.751Z
---

## Summary

Topics, threads and the inbox come to the browser: threads with Markdown, role colours and folded runs, ask and approval cards that share one record with the inbox, the composer, the events view and notifications while the page is open. From this epic on the human can steer the build from the browser.

## Goal

The human reads every thread, answers every ask and every approval the hub can relay, writes to any session or the Coordinator, and learns what happened, all in the browser and with Neovim's keys. Today the web has none of it: the Q-405 prototype showed topics and threads read-only, asks as cards without buttons and the inbox without actions, and its unread counts only grew because it never marked anything read.

## Contents

- **§3.2 The Topics area.** The topics in groups: what waits for the human first; then the standing topics General and Agents, set apart with their own look; then the topics opened under items; then the closed ones, folded.
- **§3.4 and v0.1 §3.14 The thread.** The message block (P12): a header with the sender, the role in its colour, the addressees, the kind, the time and the delivery stage, over a Markdown body; the role colour as a 3 px bar in its own gutter; the human's band; watch-layer messages dimmed; verdicts with their criteria marks; artifact chips; item ids as links that never wrap at the hyphen. History arrives in pages by message number.
- **§3.4 Folded runs** open in place and keep their anchor line, never in the drawer. The fold line is the hub's, built from facts: who, how many messages, the latest step and the age. Asks, verdicts, answers and anything to or from the human never fold.
- **§3.4 An ask lives in two places with one state.** The inbox row and the card in the thread show the same record from the hub and answer with the same keys: options 1 to 9 (a click or the key answers at once) and a free answer. Declining is an answer with a reason, on its own key and never on Escape. Once answered, the card folds to one line with the option, who answered and when, in the thread for good and in the inbox until the human leaves it; then it goes to the inbox archive. The first answer from any client wins, and every client sees the outcome.
- **§3.4 Approvals as cards** (P23): the command in full with Approve once, Always for this command and Deny with a note, answered through the gate of E-414; an approval that stays in the harness's TUI is marked "answer in Neovim" and has no buttons.
- **§3.4 Artifacts inline.** An HTML artifact at 240 px in a sandboxed iframe that never has `allow-scripts` with `allow-same-origin` and never navigates the top, under a header with Open full and Open in a pane (P15); a file or folder artifact is a chip.
- **§3.4 The composer.** The kind as Message, Decision or Question and the addressee as a chip (the Coordinator by default in an item's topic, `@` naming a session), with `~` attaching an artifact (P16). Enter sends a one-line message, Shift+Enter breaks the line, and ⌘Enter always sends. A message to a busy session is queued and shown in the thread as queued, with a Withdraw that puts the text back into the composer. ⌘K in the composer still opens the palette. The draft is kept per topic in the browser and survives a disconnection and a reload, with Send disabled while disconnected. The addressing rules are Neovim's (v0.1.2 §3.8).
- **v0.1.2 §3.7 The inbox, in the web.** The now layer in its four sections (asks and approvals, plan approvals, requests, messages), newest first, five a section with a fold that names the oldest wait, every row with its age, each header a name and a count. The selected row unfolds in place with real buttons; `r` replies, `d` declines a request or marks a message read, Enter opens; `A` shows the archive; the events line and the archive line close the list. The drawer follows the selected row with its topic's thread, scrolled to the row's message, and a one-line reply (P17 to P19). A waiting plan opens the Plan view.
- **v0.1.2 §3.7 The events view, in the web.** Rows newest first in day groups with day rules, at most the newest 200 that match the filter, older ones on demand, and a day that folds; the filter by kind, warnings and subject through the hub's filter; bookkeeping dimmed and equal events merged with ×N; Enter opening the subject. Opening the view sets the human's last look in the hub, and the inbox's events line counts what is new since.
- **§3.6 Notifications while the page is open.** Only for items of the now layer, and never while the human is looking at the page; separate switches for "needs you" and "finished"; a notification names the session, the item and what it waits on, and a click opens the inbox row.
- **§3.6 What counts as read** is held in the hub per human; the web sends its read marks by the rule below.

Not in this epic: the phone's layouts of all this (E-419); the session's drawer, which reuses this thread (E-418); the switches' places beside the profile and in More (E-418, E-419); push with the page closed (0.2.x).

Choices where the spec is silent:

- **Decline's key.** `d` on an ask, in the thread and in the inbox, turns the free answer into a reason field and its button into a red Decline that stays disabled until a reason is typed; Answer instead turns it back. This is P37 applied to the desktop.
- **Read.** The web marks a topic read up to the last message on screen once its thread has been in view, with the page visible, for one second, and whenever the human answers or writes in it.
- **Withdraw.** The protocol has no withdraw today. This epic adds one for a queued message not yet injected: the message leaves with the stage `withdrawn` and its text returns to the composer, and once the turn has started Withdraw is gone. Neovim shows a withdrawn message as it shows a dropped one.
- **The human's kinds.** `topic.send` gains the kind for the human's messages: a Decision and a Question carry their kind in the header, and a Question leaves the topic waiting for its addressee.
- **"Needs you" and "finished".** "Needs you" fires when a row enters the inbox; "finished" fires when a task of the now layer reaches done, and its click opens the item's card.
- **The switches and the permission.** The switches are per browser, since the permission belongs to a device and an origin. This epic offers them as palette actions until E-418 places them beside the profile. The permission is asked when the first switch is turned on, which is a user gesture. A row raises at most one notification (its `tag`), and "looking at the page" means visible and focused.
- **Long runs.** An open run keeps its anchor line pinned at the top of the thread while it is open.
- **The approval card** answers through the gate of E-414; where a harness has no relay, the card is shown marked and without buttons.

## Tracer-bullet order

1. **Topics and the thread.** The Topics area in its groups and a thread with the message block, Markdown, role colours, the human's band, verdicts, artifact chips, pages by message number and folded runs opening in place, with the read marks. Demo: a thread of 300 messages opens at its end and pages back without a gap, a folded run opens in place with its anchor kept, and the topic's unread count drops to zero in Neovim too.
2. **Ask cards in the thread and the inbox.** The ask card with options on 1 to 9, the free answer, decline with a reason on `d`, the folded outcome in both places, and one record across clients. Demo: an ask answered with `2` in one browser context folds in a second context's inbox and thread within a second, and Escape on another ask leaves it open.
3. **The inbox.** The four sections with their rows, ages and folds, the selected row unfolded, `r`, `d`, Enter, the archive, the drawer with the row's thread, and the answered row kept folded until the human leaves the inbox. Demo: an ask, a plan approval, a request and a message show in their sections with their ages, and the answered ask stays folded until the inbox is left, then shows in the archive.
4. **The composer.** The kinds, the addressee chip, `~`, the keys, queued messages with Withdraw, drafts per topic, Send disabled while disconnected, and the hub's withdraw and kinds. Demo: a message to a busy fake session shows as queued, Withdraw returns its text to the composer, and a draft survives a reload.
5. **Approvals and artifacts inline.** The approval card on the records of E-414, the mark "answer in Neovim", and HTML artifacts at 240 px in a sandboxed iframe with Open full and Open in a pane. Demo: a fake Codex approval approved once from the inbox folds with its outcome in Neovim's inbox, and an HTML artifact's iframe has `sandbox="allow-scripts"` and nothing more.
6. **Events and notifications.** The events view with its filters, day groups, the 200-row cap and the last-look line; notifications with the page hidden, the two switches, and the click to the row. Demo: with the page hidden, a new ask raises one notification naming the session, the item and the question, and its click opens the inbox row; with "needs you" off, none is raised.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, headless Chromium (two browser contexts with their own cookies; keys sent with their physical codes) and a headless Neovim workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project with the fake harnesses, QA opens the web at 1440x900 in two browser contexts. The Topics area lists the waiting topics first, General and Agents apart, then the item topics and the closed ones folded. A thread shows Markdown, role colours, the human's band, a verdict with its criteria marks, and a folded run that opens in place with its anchor kept; scrolling to the end marks the topic read, and Neovim shows it read. A fake Implementer's ask appears as a card in the thread and as a row in the inbox; QA answers it with `2` in the first context, and the second context's card and row fold to the outcome. QA presses Escape on a second ask and reads it still open, then declines it with a reason on `d`; the fake receives `declined` with the reason, and the topic stays open. The inbox shows a plan approval, a request and a message in their sections with their ages; the answered ask stays folded until QA leaves the inbox, then shows in the archive. QA writes with each kind, sends with Enter and with ⌘Enter, breaks a line with Shift+Enter, queues a message to a busy fake session and withdraws it, and reloads with a draft that survives. A fake Codex approval is approved once from the inbox card, and a fake Claude Code approval shows marked "answer in Neovim" with no buttons. An HTML artifact renders inline at 240 px in an iframe whose `sandbox` is `allow-scripts` alone. The events view filters to warnings, groups by day, stops at 200 rows and sets the last look, which the headless Neovim workbench then reads. With the page hidden and `Notification` stubbed, a new ask raises one notification naming the session, the item and the question; with the page visible, none is raised.

- [ ] C1. The Topics area lists the topics in their four groups with the standing ones apart, and a thread shows the message block of P12 with Markdown, role colours, the human's band, verdicts, artifact chips and history in pages.
- [ ] C2. Folded runs show the hub's fold line and open in place with their anchor kept, never in the drawer; asks, verdicts, answers and messages to or from the human never fold.
- [ ] C3. An ask is one record shown as an inbox row and a thread card with the same keys (1 to 9, a free answer, decline with a reason on its own key, never on Escape); an answered ask folds to one line with its outcome in both places, in the inbox until the human leaves it, and the first answer from any client wins.
- [ ] C4. Approval cards answer relayed approvals with Approve once, Always for this command and Deny with a note, and approvals that stay in a harness's TUI are marked "answer in Neovim".
- [ ] C5. The composer offers Message, Decision and Question with the addressee chip; Enter, Shift+Enter and ⌘Enter behave as §3.4 says; queued messages show Withdraw; drafts survive a disconnection and a reload, and Send is disabled while disconnected.
- [ ] C6. The inbox shows the four sections of v0.1.2 §3.7 with ages, the selected row unfolded, `r`, `d`, the archive and the drawer with the row's thread; the events view filters, groups by day, caps at 200 rows and sets the human's last look in the hub.
- [ ] C7. HTML artifacts show inline at 240 px in a sandboxed iframe never given `allow-same-origin`, and files and folders are chips.
- [ ] C8. Notifications fire with the page open only for now-layer items and never while the human looks at the page, with separate "needs you" and "finished" switches, naming the session, the item and what it waits on, and a click opens the inbox row.

## Dogfooding

The human steers the rest of the build from the browser once this epic's thread and inbox slices land (spec §4): the Coordinator's asks are answered from the web's inbox, the human writes to the Coordinator from the composer, and Neovim stays open for the harnesses' TUIs.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the prototype's thread, topics and inbox (`web/src/thread/`, `topics/` and `inbox/` on `prototype/web-shell`); then the boards Thread, Inbox and PhoneAsk. Where the desktop boards lag the spec (no Decline on the Thread and Inbox boards, the fold line of P13), the spec wins, as the design README lists.
- **Prior art.** Never strand an approval in one thread, never decide on a timer, never let a denial read as consent, never lock navigation with a modal, and show every action as pending, then applied or failed (`docs/research/web-prior-art.md` §7.2 and §7.3).
- **Risks.** Agents' Markdown is rendered into the page: no raw HTML from a message ever reaches the DOM, and links open outside the page. A flood of notifications is what the switches and the now-layer rule prevent.
- **Size.** About eight sessions on the v0 scale, the largest web epic.
- **Order.** Third in the web lane: it waits for E-413 and E-416, and E-419 waits for it. Its approval cards answer through E-414 without an edge; the hub lane is expected to land E-414 first, and otherwise the Coordinator orders that slice after it.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.2, §3.4 and §3.6; `docs/spec/v0.1.2.md` §3.7 and §3.8; `docs/spec/v0.1.md` §3.5, §3.6 and §3.14.
- Map M-399 and the tickets this epic absorbs: Q-401 (threads, approvals and notifications in prior art), Q-404 (the Thread and Inbox boards, P10 to P19), Q-406 (declining and the answered row), Q-408 (the final shape of threads, approvals and the composer).
- Research: `research/web-prior-art` (`docs/research/web-prior-art.md` §7.2, §7.3 and §8); `research/web-stack` (`docs/research/web-stack.md` §4.2, notifications).
- Prototype: `prototype/web-shell` (`web/src/thread/Thread.tsx`, `thread/markdown.tsx`, `topics/TopicsArea.tsx`, `inbox/InboxArea.tsx`, `events/EventsArea.tsx`).
- Mockups: `docs/design/web/Thread.dc.html` (P10 to P16), `Inbox.dc.html` (P17 to P19), `PhoneAsk.dc.html` (P37, P38); `screens/v02-thread.png`, `v02-inbox.png`.
- GLOSSARY: Topic, General, Agents topic, Ask, Request, Events view, Layer.
