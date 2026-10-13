---
id: T-33
kind: task
title: Asks and the inbox
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: E-19
blocked_by:
  - T-32
topic: null
branch: null
created: 2026-10-08T11:54:50Z
updated: 2026-10-10T00:58:17.389Z
github:
  repo: Kealman/cland-v0
  number: 33
  url: https://github.com/Kealman/cland-v0/issues/33
---

## Parent

Part of #19. Spec sections 4.5 and 5; decisions https://github.com/Kealman/cland-v0/issues/7 (Ask) and https://github.com/Kealman/cland-v0/issues/10 (only the Coordinator asks). Design: `docs/design/main-screen/Inbox.dc.html` (sections, what feeds them, row actions) and the ask card in `Main.dc.html`; prototype `prototype/workbench` (`ask` module, inbox panel).

## What to build

Ask is a message kind the Coordinator posts into a topic: a question with numbered options and room for a free answer. An open ask sets the topic `waiting for human`; the human answers with an option key or free text, which becomes a message carrying `answer_to` and clears the wait; the Coordinator may withdraw an ask with `resolve`; several asks may be open in one topic. The inbox panel (`<Space>n`, full width with `<Space>N`) lists, in this order: asks (answerable inline with 1-9 or `i`), approvals (sessions in `waiting for approval`; Enter attaches the session where the harness's own prompt is answered), topics waiting for the human without an open ask, and dismissable notifications fed by the journal (verdicts, role changes and handovers, session deaths and long idles). The top bar's "needs you" count is the sum of asks, approvals and waiting topics. The ask card renders in the thread with the same options.

## Acceptance criteria

- [ ] Only a session holding Coordinator can post an ask; others are refused with a typed error
- [ ] Answering with `2` from the inbox posts the answer with `answer_to`, clears the topic's wait and removes the row; the thread shows the answer under the card
- [ ] A session entering `waiting for approval` appears under approvals within one event and disappears when the state changes; Enter attaches it
- [ ] Notifications dismiss with `d` and `D` and never block anything; asks and approvals cannot be dismissed
- [ ] The "needs you" count equals asks plus approvals plus waiting topics; headless tests assert the inbox sections and the count

## Comments

### Kealman · 2026-10-08T16:19:36Z

<!-- github-comment: 6064240565 -->

Done on main (b6756f9..7276787, merged at b6fe6e8): ask as a message kind (Coordinator only, via the permission table), topic.answer with answer_to, waiting for human while an ask is open, resolve/close cancel asks, inbox.list with asks/approvals/waiting topics/notifications and dismiss, needsYou in hub.status, the inbox panel and full-width view, the ask card in the thread; 7 hub + 7 nvim tests. Open: no cland topic answer CLI; session death notifications untested.
