---
id: R-1191
kind: release
title: Debt sweep after v0.2.0
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:30:51.515Z
updated: 2026-10-24T06:47:05.909Z
---

## Goal

Clear the backlog left after v0.2.0 (Bugs, Follow-ups, Tech debt) and turn the v0.2 retrospective's check proposals (A-10321) into automated checks, so the next feature release starts from a clean, fast and well-guarded dev.

## Notes

The human, 2026-10-24 06:30Z in General: «Отлично, иди дальше по задачам которые говоришь и беклогу». This release holds the triaged backlog (triage artifact to follow) and the dependency update T-1189, which the human approved in the same message. The version is the human's choice before release; none is recorded yet.

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
