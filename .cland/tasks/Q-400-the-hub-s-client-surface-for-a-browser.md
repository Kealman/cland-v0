---
id: Q-400
kind: question
title: "The hub's client surface for a browser: what the Neovim plugin consumes, what a browser needs on top"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-399
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:48.943Z
updated: 2026-10-14T13:03:55.518Z
---

## Question

What does the hub expose to a client today and what does a browser need on top? Read what the Neovim plugin consumes (every frame type and request it sends and reads, the connection and reconnection path, how it re-reads after a drop, what it renders from which fields), the hub's spoke and human-client handling (how many human clients it allows, what the TCP port in hub.json serves, the REPLACED close code), and list, with the protocol names: what a browser can use as is over a WebSocket carrying the same frames; what is missing (a snapshot on connect, deltas with sequence numbers for catch-up, pages of thread and event history, static serving, a token exchange for the hub's secret, several human clients); and the cost of each. Deliver docs/research/web-client-surface.md on research/web-client-surface with a table of frames against the web areas of spec v0.2 §3.2, and the resolution comment here.
