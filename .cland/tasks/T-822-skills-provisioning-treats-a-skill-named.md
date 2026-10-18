---
id: T-822
kind: task
title: Skills provisioning treats a skill named constructor as still shipped via Object.prototype
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-18T22:31:42.667Z
updated: 2026-10-18T22:31:42.667Z
---

## Summary

In `hub/src/init/skills.ts`, the dropped-skill loop tests `name in manifest.skills`. A skill named `constructor`, which is a valid name, matches `Object.prototype` even when the new manifest has no own entry for it. So a dropped `constructor` skill skips removal and handover while its ownership entry disappears. Reported by impl-625 while working T-625; the code predates T-625.

## Acceptance criteria

- [ ] C1. Manifest membership checks in skills provisioning use own-property tests (`Object.hasOwn` or a Map), and a regression test with a dropped skill named `constructor` (and `__proto__`, `toString`) removes or hands it over like any other name.
