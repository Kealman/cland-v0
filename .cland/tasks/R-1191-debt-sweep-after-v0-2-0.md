---
id: R-1191
kind: release
version: 0.2.1
title: Debt sweep after v0.2.0
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:30:51.515Z
updated: 2026-10-25T06:44:57.760Z
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
