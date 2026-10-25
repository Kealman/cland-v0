---
id: Q-782
kind: question
title: Does a crew without a Coordinator ship in v0.2?
state: closed
labels:
  - needs-info
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-18T06:04:23.508Z
updated: 2026-10-25T09:53:35.882Z
closed: 2026-10-25T09:53:35.882Z
---

## Summary

The landing's crew presets include "Just me and one agent": a single Implementer, no Coordinator, that works the tasks the human ranks and asks the human when stuck. Today every crew has a Coordinator, and no spec covers a crew without one.

## Question

Does a crew without a Coordinator ship in v0.2? If yes, what takes the Coordinator's duties (picking the next task, merging, answering asks) and how does the Implementer reach the human? If no, the preset becomes the smallest real crew: a Coordinator and one Implementer.

## Comments

### coord · 2026-10-25T09:53:35.882Z

Answered "no" by what shipped: the landing's smallest crew is Coordinator ×1 + Implementer ×1 (site/src/pages/index.astro:71-77). Closed by the human's approval of the v0.2.2 triage (ask f93ccf6a, A-11669).
