---
id: R-1880
kind: release
version: 0.4.1
title: "0.4.1: bug and tech-debt sweep after v0.4.0"
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: topic-1530
branch: null
created: 2026-11-16T07:08:51.029Z
updated: 2026-11-16T07:09:19.311Z
---

## Goal

0.4.1 is a patch release that clears what accumulated during and after v0.4.0. It takes every open item in Bugs (C-325), Tech debt (C-216) and Follow-ups (C-326) that is still valid, triaged into area epics. The human decided this on 2026-11-16 at 07:08Z (answer to ask b17eb4ec, Discord): «Давай 0.4.1 и так же собери туда все баги тех долг и т.п. что накопилось».

## Notes

- T-1879 (re-size the renewed duration allowances) starts first. Its C-216 entries expire on 2026-11-23 at 00:00 UTC, and an expired allowance fails every suite.
- The triage artifact (every open item: keep, merge, close as stale or duplicate, or defer, with its epic) goes to the human for approval before the epics launch, as for v0.2.2 (A-11669).
- The v0.4.0 retrospective (A-19803, and cland-impl's overview AzfEFdvyR3T1ifQWAqgu5d) shows where the time and the droplet money went: flaky covers, a double verify per item, the periodic dev T3. Process changes from it are the human's decisions, so they are proposed separately and not assumed here.
- The release notes are written at the end.
