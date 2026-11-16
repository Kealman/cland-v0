---
id: T-1840
kind: task
title: The web connection clones the whole retained askCards map on every card delta and inbox publication
state: open
status: planned
size: M
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: null
branch: null
created: 2026-11-12T22:58:19.834Z
updated: 2026-11-16T07:31:19.872Z
---

## Summary

The web connection clones the entire retained `askCards` Map on every card delta and every inbox publication, so each card change costs work proportional to all retained cards (about 1,950 on this project today). Found aside by T-1827, whose new active sign-in index removed the per-render history scan it added but left this older publication copy as it was.

## What to build

Card deltas and inbox publications in the web connection update only the cards they touch, without copying the whole retained card map, while every consumer (the inbox, the hosts view's sign-in rows, the remotes cards) still sees the same cards and the same order. A work-count test bounds the per-delta work independently of the retained card count.

## Acceptance criteria

- [ ] C1. One card delta and one inbox publication do work bounded independently of the number of retained cards, shown by a work-count test with 2,000 retained cards (test).
- [ ] C2. The inbox, the hosts view's sign-in rows and the remotes cards render the same cards in the same order before and after the change (test).
