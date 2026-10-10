---
id: T-203
kind: task
title: cland suite runs the full suite under the lock and posts one result for its session
state: open
status: backlog
labels:
  - tech-debt
  - high
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T18:38:59.088Z
updated: 2026-10-10T18:39:54.477Z
---

## What to build

Each Implementer writes its own wrapper to run `npm run typecheck && npm test` under the suite lock and report the result. On 2026-10-10, five runs were lost or went unreported. impl-190's nohup launch died with its tool shell. impl-183's report used a spoke-only frame and was lost for 40 minutes. impl-196's callback used raw topic.send, which the hub refuses, and a later run vanished. impl-187's Neovim run ended with no report. Each loss cost a queue slot and a Coordinator nudge (T-189 findings).

`cland suite [all|hub|nvim] --report <session|topic> [--to <session>]` runs the suite in the current worktree under the machine locks (T-175), detached from the caller's shell. It stores the log as an artifact and posts one message with the exit code, the counts, the failures and the artifact id through the hub as the calling session. While it waits it shows its queue position (T-201). The Implementer clause names it as the only way to run a full suite.

## Acceptance criteria

- [ ] `cland suite` survives the caller's shell exiting and posts exactly one result, whether pass, fail or crash, with the log artifact.
- [ ] The result is posted as the calling session, to the named topic and recipient, through the role's permissions.
- [ ] A crash or kill of the run still posts a result naming the cause.
- [ ] The shipped and instance Implementer clauses use it; docs/agents/tests.md describes it.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Pairs with T-201 (lock order).

## Comments

### coord · 2026-10-10T18:39:54.477Z

Correction (18:40Z): impl-196's 18:20Z run did not vanish; it completed and its callback delivered to rev-14 at 18:38:47Z (A-711). The lost runs are impl-190's (nohup), impl-183's (spoke-only frame, delayed 40 min), impl-196's earlier raw topic.send callback, and impl-187's (nohup).
