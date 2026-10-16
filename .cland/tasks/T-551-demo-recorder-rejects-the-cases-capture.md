---
id: T-551
kind: task
title: Demo recorder rejects the cases' capture names and hides the error behind a bare catch
state: open
status: in progress
size: S
labels:
  - v0.1.3
  - qa-found
assignee: null
parent: E-423
blocked_by: []
regression_of: T-459
topic: null
branch: t/T-551-demo-recorder-rejects-the-cases-capture
created: 2026-10-16T00:31:47.114Z
updated: 2026-10-16T00:33:02.188Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, cases D2–D5, at cdad9cdc). All four headless cases came back BLOCKED with "demo execution or capture collection failed" and no captures. Two causes:
- `.agents/skills/qa/qa-demo-record.ts:32` throws "invalid capture name" unless a capture's name starts with the case id. The cases (RULEBOOK-001, RULEBOOK-002, EVENTS-001, FOLLOWS-001) call `qa.dump` with lowercase names such as `rulebook-rows`, which the local `qa-record.sh` accepts.
- The recorder's bare `catch` drops the error, and the remote side deletes the captures before local validation, so nothing explains the BLOCKED result.
Separately, the delivered `hub/bin` on the droplet has no executable named `cland` (only `cland.ts`), so `command -v cland` fails there, although the qa skill says the remote PATH includes the delivered hub/bin for `cland --headless --qa`.

## Acceptance criteria
- [ ] C1. The demo recorder accepts the same capture names the local recorder accepts (it prefixes the case id itself, as the local path does), so a case that passes locally records the same captures through `cland demo exec`.
- [ ] C2. Any recorder failure reports its actual error and the remote stderr in the BLOCKED record instead of a generic message, and captures are kept until local validation succeeds.
- [ ] C3. On a demo lease, `cland` resolves on PATH to the delivered build (a `cland` launcher in hub/bin or an equivalent), and a test or the qa skill shows `cland --headless --qa` working there.
