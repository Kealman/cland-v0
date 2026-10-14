---
id: R-377
kind: release
version: 0.2.0
title: "Release: v0.2"
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-14T08:32:48.485Z
updated: 2026-10-14T16:00:56.576Z
---

## Goal

v0.2 brings the web workbench: everything the Neovim workbench shows and does, in the browser, more convenient and without the limits of a console interface, with the hub as the single source of truth. Neovim stays as the alternative: it is good for a fast start, for setting up the process and for driving the harnesses; once a project's work has settled and scaled, the human moves to the browser to watch, plan and steer.

## Notes

The human's direction of 2026-10-14, given while the v0.1.2 build runs: prepare v0.2 in parallel. Nothing here is planned yet; a wayfinder map charts the way (destination, research, prototypes, grilling) and the spec and epics follow, as for v0.1 and v0.1.2.

## Epics

| Key | Id | Title | Blocked by |
| --- | --- | --- | --- |
| E01 | E-412 | The web edge and the protocol extension | none |
| E02 | E-413 | Hub-computed fields and read marks | E-412 |
| E03 | E-414 | The approvals relay | E-413 |
| E04 | E-415 | The web workspace and the shell | none |
| E05 | E-416 | Items in the web | E-412, E-415 |
| E06 | E-417 | Topics, threads and the inbox | E-413, E-416 |
| E07 | E-418 | Sessions, artifacts and accounts in the web | E-416 |
| E08 | E-419 | The phone and notifications | E-417 |
| E09 | E-420 | Release v0.2.0 from the item | E-414, E-418, E-419 |

The build starts after v0.1.3 ships, led by the cland-impl session as v0.1.2 was: the hub lane (E-412, E-413, E-414) and the web lane (E-415 to E-419) run in parallel, E-420 releases from this item, and the blocking edges are on the epics (spec v0.2 §4).
