---
id: R-1191
kind: release
version: 0.2.1
title: Debt sweep after v0.2.0
state: closed
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-1021
branch: null
created: 2026-10-24T06:30:51.515Z
updated: 2026-10-25T06:47:25.205Z
closed: 2026-10-25T06:47:07.791Z
---

## Goal

Clear the backlog left after v0.2.0 (Bugs, Follow-ups, Tech debt) and turn the v0.2 retrospective's check proposals (A-10321) into automated checks, so the next feature release starts from a clean, fast and well-guarded dev.

## Notes

The human, 2026-10-24 06:30Z in General: «Отлично, иди дальше по задачам которые говоришь и беклогу». This release holds the triaged backlog (A-10327) and the dependency update T-1189, which the human approved in the same message. Version 0.2.1 is the human's choice (ask ae65f3f2, 2026-10-25 05:57Z). Highlights: OpenCode qualified for every role (E-1216, audit A-11613); session usage now survives hub restarts (T-1269); the merge queue, periodic dev T3, duration budgets, QA tooling and hub correctness fixes of E-1193 to E-1197.

## Epics

Triage: A-10327 (2026-10-24). It closed 23 items (13 fixed, 2 duplicates, 8 wontfix), took 35, deferred 24 and left 4 for the human (ask 7efa7a2e). The retro's check proposals became T-1198 to T-1207.

| Id | Title | Order |
| --- | --- | --- |
| E-1192 | Production dependency advisories after v0.2.0 | first, alone (T-1189) |
| E-1196 | Test hygiene, guards and QA tooling | stage 1 (T-1199 splits docs/agents/tests.md) next, alone among items that touch that file |
| E-1195 | Duration budget and test selection | lane T-1190 > T-1198 > T-1026 alongside |
| E-1193 | Merge queue and landing safety | after T-1199 |
| E-1194 | Periodic dev T3 and executor honesty | after T-1199 |
| E-1197 | Hub correctness and speed | after T-1199 |

## Comments

### coord · 2026-10-25T06:47:07.791Z

Released v0.2.1 at 0ed90062f0180da3584c52f5c68c8b1662191fcc.
Homebrew published: Kealman/homebrew-tap main Formula/cland.rb v0.2.1
https://codeload.github.com/Kealman/cland-v0/tar.gz/refs/tags/v0.2.1
sha256 aeafac42bae49da2c13b98d6a89b8a24645afe06676281049319605c19deb444
tap commit a474f8b71d997e4e935f3e481e1d72e524a43520
Web bundle published: Kealman/cland-v0 v0.2.1
cland-web.tar.gz 1724715 bytes; cland-web.tar.gz.sha256 83 bytes
sha256 4af47ad4ef912fc75506f87caa421c569a792c6f129bd266ded684d990421b99

### coord · 2026-10-25T06:47:25.205Z

Release approval basis. Ask 362da145 (publish v0.2.1 at 0ed90062, preview A-11626, including the Homebrew tap and web asset) was answered with option 1 at 06:46:18Z by cland-impl, relaying the human's advance permission given in cland-impl:
- 2026-10-25 05:58Z: «Публикуйте»;
- about 06:05Z: «Когда появится отвечай - публикуй , я заранее даю разрешение».
Version 0.2.1 is the human's own choice (ask ae65f3f2, 05:57Z). The dry-run showed no refusals and version 0.2.1. The tap and the web asset are features the human approved earlier (tap repo creation; T-1234).
Release covers: Linux 37590807 (A-11620) and macOS 90c970ef (A-11624), green at tree 8bfc4229; only a tracker notes edit followed.
Published: main 0ed90062f0180da3584c52f5c68c8b1662191fcc, tag v0.2.1 2d2c0ff5. Homebrew Formula/cland.rb in Kealman/homebrew-tap at tap commit a474f8b7 (tarball sha256 aeafac42…). Web bundle cland-web.tar.gz (1,724,715 bytes, sha256 4af47ad4…) as a GitHub Release asset.
