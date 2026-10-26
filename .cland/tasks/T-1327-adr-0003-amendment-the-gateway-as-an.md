---
id: T-1327
kind: task
title: "ADR 0003 amendment: the gateway as an outbound-only edge of the one frame protocol"
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by: []
topic: null
branch: null
created: 2026-10-26T02:28:47.687Z
updated: 2026-10-26T02:28:57.995Z
---

## Summary

ADR 0003 (the hub is a per-project daemon) gains an amendment naming the gateway: an edge of the one frame protocol inside the hub process, connecting out only, with its own authority table.

## What to build

A dated amendment section in `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, following the domain-modeling skill's ADR conventions. It names the gateway and its outbound-only connections. It references the authority table and the identity `human` (ADR 0001), and links GLOSSARY's Gateway, Remote and Outbox and spec §3.1.

## Acceptance criteria

- [ ] C1. ADR 0003 carries a dated amendment naming the gateway as an outbound-only, in-process edge of the one frame protocol with its own authority table, acting as `human`, and the docs links it adds resolve (docs lint or test).
