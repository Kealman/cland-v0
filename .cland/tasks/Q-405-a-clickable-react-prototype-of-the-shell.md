---
id: Q-405
kind: question
title: A clickable React prototype of the shell against the live hub, read-only
state: open
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-399
blocked_by:
  - Q-400
  - Q-404
topic: null
branch: null
created: 2026-10-14T13:03:50.469Z
updated: 2026-10-14T14:18:49.199Z
---

## Question

Does the shell feel right in a browser against the live hub? A throwaway React prototype on prototype/web-shell (a web/ workspace started from the stack research): the rail, a main area with the explorer tree and the card from the hub's real items, a thread read-only, the inbox, live updates over a WebSocket bridge to the hub's frames (the bridge throwaway if the hub lacks it), keyboard navigation and the palette; measured: first paint, update latency, bundle size. The human tries it and reacts.
