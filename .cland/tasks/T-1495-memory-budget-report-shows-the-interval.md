---
id: T-1495
kind: task
title: Memory budget report shows the interval maximum and states whether the limit applies to endpoints or the whole interval
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-30T22:55:14.530Z
updated: 2026-10-30T22:55:14.530Z
---

## Summary

The report-only memory budget (T-1478, 256 MiB heap / 768 MiB RSS, agreed with the human) compares readiness and rest endpoints. In the E-1466 QA run (A-14729, qa-2026-10-30-677-1466 at 3cc3d62e8), the endpoints passed: heap 153.0 MiB at readiness and 129.2 MiB at rest. But a transient heap peak of 294.3 MiB during rest exceeded 256 MiB, and the report does not show it. The budget output should publish the observed interval maximum beside the endpoints and say explicitly whether the limit applies to endpoints or to the whole interval. Origin: qa-677's proposal from the E-1466 demo.

## Acceptance criteria

- [ ] C1. The memory budget report prints readiness, rest endpoint and interval maximum for heap and RSS, each marked within or over the agreed limit, plus one line naming which readings the limit governs. It stays report-only.
