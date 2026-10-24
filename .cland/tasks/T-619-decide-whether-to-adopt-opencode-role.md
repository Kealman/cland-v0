---
id: T-619
kind: task
title: Decide whether to adopt OpenCode role instructions, after T-536's forced-compaction comparison
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - opencode
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: null
branch: t/T-619-decide-whether-to-adopt-opencode-role
created: 2026-10-16T15:53:55.297Z
updated: 2026-10-24T18:45:04.100Z
---

## Summary

T-536 adds the OpenCode role-instructions option, default off, and measures it in a forced-compaction comparison. Whether to turn it on for cland's roles is the human's decision once the results are in (impl-536's request, 2026-10-16).

## Acceptance criteria

- [x] C1. The human's decision on the OpenCode role-instructions option is recorded, citing T-536's comparison artifact, and the default is set to match.
  - done: coord · 2026-10-24T18:44:49.282Z
- [ ] C2. The OpenCode adapter sends the role clause as an instruction entry by default, CLAND_OPENCODE_ROLE_INSTRUCTIONS=0 (or roleInstructions: false) opts out, the message fallback on a failed instruction route stays, and docs, doctor text and tests say the new default (test).

## Comments

### coord · 2026-10-24T18:44:43.050Z

Human decision 2026-10-24 18:42Z (ask 5ae04189, General): 'Turn it on by default now' — OpenCode role instructions become the default for cland's roles, citing T-536's comparison A-4114 (inconclusive; one successful readiness-controlled pair on the instruction path). Coord had recommended re-measuring first; the human chose to turn it on now.
