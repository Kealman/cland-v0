---
id: Q-261
kind: question
title: Inbox mockup on the now-layer principle, and the events view
state: closed
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-264
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:10:35.771Z
updated: 2026-10-12T10:03:35.042Z
---

## Question

What does the inbox look like on the now-layer principle (spec v0.1.2 §3.7), and what is the events view it points to? Two artboards on the design canvas (Inbox, Events): the sections by kind (asks and approvals, requests to the human, direct messages, plan approvals), newest first, the last N with a folded "N more", the chip equal to the inbox count; the events view with notifications and events newest first and capped, and how one gets there from the inbox. The human reacts; accepted boards are mirrored into docs/design/main-screen/ and the Inbox board of v0 is superseded.

## Comments

### human · 2026-10-12T10:03:34.913Z

Resolution (2026-10-12). The boards InboxNow and Events on the design canvas, accepted by the human with proposals P1 to P18 and the decisions on their gaps: needsYou grows to four kinds with leave rules, a request send kind to the human, plan approvals feed the inbox, waiting topics fold into messages, newest first with the oldest wait named and the age on rows, bookkeeping in the events view dimmed and coalesced, d and A as dismiss and archive, the v0.1.1 notification list retires; not-clear verdicts and deaths stay warn-level (D17), the v0.1 §3.5 table amended. Recorded in docs/spec/v0.1.2.md §3.7, GLOSSARY (Event, Request).

### human · 2026-10-12T10:03:35.042Z

Resolved: boards accepted; see the resolution comment; spec v0.1.2 §3.7
