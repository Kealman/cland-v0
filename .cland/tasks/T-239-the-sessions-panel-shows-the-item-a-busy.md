---
id: T-239
kind: task
title: The sessions panel shows the item a busy Reviewer or QA is working on
state: closed
status: done
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:01.350Z
updated: 2026-10-12T11:35:33.383Z
---

## Open question

Busy verifiers showed 'free' in the sessions panel's item column. The panel should show the held item from the verifier hold, or the pending request (observation 4). To decide: what the column shows when a verifier holds several items, and how a pending request appears before the hold. Relates to spec §3.2 and §3.11.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T08:59:32.759Z

Decided (2026-10-12, round 2): T-168 covers the held item; with several holds the column shows the latest and +N; before a hold exists the item named by the latest review or QA request delivered to the session shows dimmed until the hold replaces it. Recorded in docs/spec/v0.1.2.md §3.4.

### human · 2026-10-12T11:35:33.383Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.4; built by T-275 Sessions: stopped sessions, verifiers' items, the queue line
