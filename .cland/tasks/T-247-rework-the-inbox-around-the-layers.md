---
id: T-247
kind: task
title: Rework the inbox around the layers
state: open
status: backlog
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:03.291Z
updated: 2026-10-12T08:59:33.170Z
---

## Open question

Beyond T-166 (newest first, capped) and the chip bug (T-235 in v0.1.1), the human wants the inbox rethought with §3.5's layers and the sessions-panel style of folding (observation 2). Needs a design grilling. Relates to spec §3.5 and the v0 inbox mockup Inbox.dc.html.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T08:59:33.170Z

Decided (2026-10-12, round 2): the inbox holds the now layer only, in sections by kind (asks and approvals, requests to the human, direct messages, plan approvals), newest first, the last N with a folded more; notifications and events move to a separate events view, newest first, capped; the chip equals the inbox count. The form is decided by a mockup in the explorer map. Recorded in docs/spec/v0.1.2.md §3.7.
