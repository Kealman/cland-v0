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
updated: 2026-10-14T16:52:46.528Z
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

## Comments

### human · 2026-10-14T16:52:46.528Z

Handover to the implementation session (cland-impl), 2026-10-14: v0.2 "the web workbench" is planned; you lead the build as for v0.1.2, starting after v0.1.3 ships; questions only the human can answer go to the inbox as asks and wait.

Spec: docs/spec/v0.2.md (complete: §3.1 two clients of one protocol, §3.2 the shell, §3.3 the live model, §3.4 threads and actions, §3.5 editing parity with Neovim, §3.6 notifications and the phone, §3.7 serving and security, §3.8 scope, §4 the release); GLOSSARY: Web workbench, Rail, Drawer, Snapshot, Delta. Epics under this item, labelled epic, v0.2, ready-for-agent: hub lane E-412 The web edge and the protocol extension → E-413 Hub-computed fields and read marks → E-414 The approvals relay; web lane E-415 The web workspace and the shell (no blockers; starts on the prototype's bridge until E-412 lands; the human approves its plan by hand: ask, and launch nothing under it until task plan show reads approved) → E-416 Items in the web (also after E-412) → E-417 Topics, threads and the inbox (also after E-413) → E-418 Sessions, artifacts and accounts in the web and E-419 The phone and notifications (after E-417) → E-420 Release v0.2.0 from the item (after E-414, E-418, E-419). About 50 sessions; crew as v0.1.2.

References, never merged: research branches research/web-client-surface, research/web-prior-art, research/web-stack (its probe holds a working web edge and a Playwright harness), research/web-terminal (eight protocol reservations, in spec §3.3); the prototype branch prototype/web-shell (a read-only React shell against the live hub with a bridge; a built worktree at ../web-shell); the mockups in docs/design/web/ (nine boards with renders and a README; the canvas https://claude.ai/artifact/Cqc3KRR8tXG1yd395B6vf6 on the human's current account). The web phase of the suite is its own shard on node:test with playwright-core; the web never sees the hub's secret; no hex colours outside the tokens; keys by physical code; no allow-scripts with allow-same-origin.

Rules that stay: as on R-294's handover (English artifacts; sub-agents never use the hub; the Fable co-author line; only cland release pushes to GitHub; the frame protocol first, fake harnesses second, Playwright third; no routing around refusals; cland verify for suites). Dogfooding: the web edge and the snapshot serve the shell first; the human steers from the browser once Topics and the inbox land; the phone layouts are tried on the human's phone through their tunnel. Definition of done: every epic's demo run by QA on dev with a clear verdict, the web phase included; v0.2.0 released from this item; a retrospective artifact; no human acceptance pass. The planning session (cland-design) stays available for design questions.
