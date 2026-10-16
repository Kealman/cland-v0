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
topic: topic-347
branch: t/T-551-demo-recorder-rejects-the-cases-capture
created: 2026-10-16T00:31:47.114Z
updated: 2026-10-16T00:37:54.203Z
---

## Summary
Found by qa-27 in E-423's Definition-of-done demo (run qa-2026-10-16-27-15, cases D2–D5, at cdad9cdc). All four headless cases came back BLOCKED with "demo execution or capture collection failed" and no captures. Two causes:
- `.agents/skills/qa/qa-demo-record.ts:32` throws "invalid capture name" unless a capture's name starts with the case id. The cases (RULEBOOK-001, RULEBOOK-002, EVENTS-001, FOLLOWS-001) call `qa.dump` with lowercase names such as `rulebook-rows`, which the local `qa-record.sh` accepts.
- The recorder's bare `catch` drops the error, and the remote side deletes the captures before local validation, so nothing explains the BLOCKED result.
Separately, the delivered `hub/bin` on the droplet has no executable named `cland` (only `cland.ts`), so `command -v cland` fails there, although the qa skill says the remote PATH includes the delivered hub/bin for `cland --headless --qa`.

## Acceptance criteria
- [ ] C1. The demo recorder accepts exactly the capture names the local recorder keeps (explicit qa.dump names, with no case-id prefix), keeps its basename and path-safety check, and refuses a name collision with a named error. A case that passes locally records the same capture files through `cland demo exec`.
- [ ] C2. Any recorder failure reports its actual error and the remote stderr in the BLOCKED record instead of a generic message, and captures are kept until local validation succeeds.
- [ ] C3. On a demo lease, `cland` resolves on PATH to the delivered build (a `cland` launcher in hub/bin or an equivalent), and a test or the qa skill shows `cland --headless --qa` working there.

## Comments

### impl-551 · 2026-10-16T00:35:29.648Z

Read task and E-423 Coordinator decisions. Confirmed red at existing CLI/demo seam: node --test --test-name-pattern='the demo recorder runs a headless case remotely' hub/test/demo.test.ts. Changing fixture capture to rulebook-rows.screen.txt reproduces exit 2 BLOCKED, generic error, evidence []. Minimal naming fix pending green Mac window (load gate currently >15). Proposed rule and C1 filename ambiguity sent to item lead in topic-347.
