---
id: T-1767
kind: task
title: digitalocean-pacing T2 cases run native process cleanup through the fake API close
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-09T06:51:21.971Z
updated: 2026-11-09T06:51:21.971Z
---

## Summary

Two HTTP cases in `hub/test/digitalocean-pacing.test.ts` run native process cleanup (`ps`) through `fake-api.close` → `process-cleanup`: the 429 cleanup case and the missing-header case. The T2 resource lint reports it (report-only). The file therefore isn't process-free T2 evidence. Found aside by impl-1756 during T-1756 (2026-11-09).

## Acceptance criteria

- [ ] C1. The fake DigitalOcean API's close in those cases uses a scripted, no-native HTTP teardown, or the file moves to the lifecycle tier that matches its native work (test).
- [ ] C2. The T2 resource lint reports zero tier-resource findings for `digitalocean-pacing.test.ts` (test).
