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
updated: 2026-11-24T06:43:35.433Z
---

## Goal

0.4.1 is a patch release that clears what accumulated during and after v0.4.0. It takes every open item in Bugs (C-325), Tech debt (C-216) and Follow-ups (C-326) that is still valid, triaged into area epics. The human decided this on 2026-11-16 at 07:08Z (answer to ask b17eb4ec, Discord): «Давай 0.4.1 и так же собери туда все баги тех долг и т.п. что накопилось».

## Notes

0.4.1 is a patch release. It fixes bugs and pays down tech debt after v0.4.0, and adds the verification and flow improvements from the v0.4.0 retrospective. It holds 173 tasks across eight epics.

- **Steadier covers and batches.** Test setup waits and per-test timeouts now scale with machine load. More than thirty timing-sensitive tests no longer redden suites on slow or loaded machines (E-1881, E-1888).
- **Faster, lighter verification.** The periodic dev T3 runs in two shards, and a timeout counts as inconclusive rather than failed. A failed merge batch no longer makes the next batch repeat every slow identity. Merge batches run T1 and the full T3 once, on the integrated tree (E-1888, E-1883).
- **Merge queue and delivery.** Enqueue preflight, ready and freshness checks before landing, a delivery fail-fast, and fixes to verdict and criteria accounting (E-1883, E-1888).
- **Hosts, logins and providers.** Fixes to host acquisition, the login lifecycle and provider cleanup (E-1884).
- **Sessions, the hub and recovery.** Fixes to launch, stop, handover and restart recovery (E-1885).
- **Remotes, workbenches and CLI.** Fixes across the remote control, the web and Neovim workbenches, and the CLI (E-1886).
- **Test fixtures and QA kit.** Fixture ownership, T2 hygiene, TMPDIR residue, QA kit checks and docs (E-1882, E-1887).
- **Release preflight.** `gh` is checked on the hub PATH, and the managed .gitignore header no longer moves the release tree (T-1876, T-1877).

Every epic closed with a clear QA verdict. Release covers at 4cbdba6a7 (tree bbc13c73) are green on Linux (c4e171e7, A-22746) and macOS (68c47db0, A-22750).
