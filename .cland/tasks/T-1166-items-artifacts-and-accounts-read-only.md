---
id: T-1166
kind: task
title: Items, Artifacts and Accounts read-only from More
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
topic: topic-907
branch: t/T-1166-items-artifacts-and-accounts-read-only
created: 2026-10-23T07:00:02.171Z
updated: 2026-10-23T14:09:56.369Z
---

## Summary

At phone width the three areas More opens are read-only: the Items tree and a full-screen card without actions or planning views, artifacts to read without Keep, Archive or compose, and the accounts without edits.

## Parent

E-419 (§3.6 More, P26; "the planning views stay desktop first"; the second half of tracer step 1).

## What to build

- **Items.** At phone width the Items area shows the explorer tree only: the view switcher with Board, Graph and Plan is absent. A tap on a row opens the item's card full screen with a back control (the browser's back does the same). The card shows its blocks and none of its actions: no quick message, done, archive, criteria edit or plan approval, and the Items keys that change an item do nothing at this width. Other screens reuse this read-only card (the thread's card button, a later ticket).
- **Artifacts.** The list and the viewer, the viewer full screen with a back control; Keep, Archive and compose are absent.
- **Accounts.** The registry, windows and limits as facts; no control that changes an account. At phone width the notification switches belong to More (a later ticket), not to the profile block.
- While one of the three is open the bar marks More as current. The desktop at 640 px and wider keeps every action.

## Acceptance criteria

- [ ] C1. At 390x844 More then Items shows the tree with no view switcher, and a tapped row opens its card full screen with a back control and no action control (Web test).
- [ ] C2. At 390x844 the Items keys for done, archive, message and criteria edit change nothing, as `cland task view` reads, while at 1440 px the same keys still act (Web test).
- [ ] C3. At 390x844 More then Artifacts opens an artifact full screen with a back control and offers no Keep, Archive or compose (Web test).
- [ ] C4. At 390x844 More then Accounts shows each account's facts with no control that changes an account, and the bar marks More current in all three areas (Web test).
- [ ] C5. `web/README.md` lists what More opens on the phone and what stays desktop only (docs).
