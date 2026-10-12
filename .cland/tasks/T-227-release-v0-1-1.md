---
id: T-227
kind: release
version: 0.1.1
title: "Release: v0.1.1"
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-168
branch: null
created: 2026-10-11T17:47:48.488Z
updated: 2026-10-12T02:59:18.478Z
---

## Goal

v0.1.1 makes the crew's machinery dependable: sessions stop, die and hand over work in ways the hub records correctly, and verification becomes a hub-owned service with a queue, a result cache and metrics instead of a machine-wide lock file.

## Notes

Scope by decision D21 (2026-10-11): everything from the v0.1 run that needs no human decision or design grilling. Three epics: Session lifecycle; Verification service; v0.1.1 hygiene. Items needing the human's decisions sit in v0.1.2 as backlog. Version 0.1.1 is the human's recorded version (D21).

Deferred checks. D23 (2026-10-12, stand-in cland-impl, for the human's morning review): T-229 C5 reads as "a hung tracker write is detected and named (tracker-storage-stalled event, hub status flag), and hub stop stays bounded and reports the abandoned write; the serving-time fail-fast exit is T-253 in v0.1.2".
