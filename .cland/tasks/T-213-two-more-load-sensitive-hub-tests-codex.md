---
id: T-213
kind: task
title: "Two more load-sensitive hub tests: Codex launch access stop wait and crew non-table refusal"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-11T05:55:12.001Z
updated: 2026-10-11T07:33:10.348Z
---

## What to build

Both failed in the integrated dev suite at 438e53e (2026-10-11 05:4xZ) and pass alone on the same head:
- hub/test/codex-adapter.test.ts:530, 'Codex launches Implementer and QA with full access, Reviewer read-only…': `qa-1 is seen gone: not within 15000 ms`. It passes alone in 7.4s.
- hub/test/crew.test.ts, 'non-table crew values are refused and cannot replace the last good staffing'. It passes alone in 7.3s.

Make each wait on the event it means, or scale its wait to an unloaded baseline, without dropping what it checks.

## Acceptance criteria

- [ ] Both pass 20 runs alone and 20 under four-worker load (the four-worker runs under the suite lock).
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size XS. Successor to T-172 and T-210.

## Comments

### coord · 2026-10-11T07:33:10.348Z

Add a third case: nvim/test/thread.test.ts 'background fold reconstruction leaves the focused board alone and rejects non-thread windows' failed in the integrated dev Neovim phase at 438e53e (2026-10-11 07:3xZ, 253/254). It passes alone on the same head.
