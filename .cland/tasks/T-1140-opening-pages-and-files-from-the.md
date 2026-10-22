---
id: T-1140
kind: task
title: Opening pages and files from the Artifacts area
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1139
topic: null
branch: null
created: 2026-10-22T15:16:16.302Z
updated: 2026-10-22T23:07:37.996Z
---

## Summary

Enter opens an HTML page in a sandboxed iframe at full height and a file as text when it is text or as a download otherwise, all through E-412's capability URLs.

## Parent

E-418 (§3.2; v0.2 §3.4 and §3.7; tracer step 6).

## What to build

Enter on a page artifact (and on a diagram) opens it in the drawer, or with ⌘Enter in the other pane, in an iframe at the drawer's full height whose `sandbox` is `allow-scripts` alone, never with `allow-same-origin`, loaded from a capability URL minted with `artifact.url`; the hub's response carries its own sandbox policy as well. A file artifact opens as text when its type is text (Markdown included until the notes slice renders it), otherwise as a download link with its name. Files inside a folder open the same way by their type. An artifact whose file is gone says so. E-417's inline HTML artifacts (Open full) may reuse this viewer; whichever epic lands first owns the shared component.

## Acceptance criteria

- [ ] C1. Enter on an HTML page artifact opens it in an iframe whose `sandbox` attribute is exactly `allow-scripts`, loaded from a capability URL (Web test).
- [ ] C2. A script inside the page cannot read the workbench's document or cookie (Web test).
- [ ] C3. A text file opens as text and a binary file offers a download with its name, both from capability URLs (Web test).
- [ ] C4. `web/README.md` describes opening pages and files and the sandbox rule (docs).
