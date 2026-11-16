---
id: E-1884
kind: epic
title: Hosts, logins and providers (0.4.1)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:28:33.288Z
updated: 2026-11-16T07:28:33.288Z
---

## Goal

Host, login and provider defects found during v0.4.0 are fixed on the fakes, including the provider token reaching role shells (T-1705, product-side fix per the human 2026-11-16).

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1626, T-1645, T-1688, T-1802, T-1869, T-1660, T-1662, T-1586, T-1656, T-1672, T-1807, T-1858. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
