---
id: T-998
kind: task
title: A malformed tool argument is answered as a permission refusal (forbidden)
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: null
branch: null
created: 2026-10-20T16:52:35.140Z
updated: 2026-10-24T06:46:54.990Z
---

## Summary

A hub tool call with a malformed argument is answered with code `forbidden`, the code of a permission refusal. Under rule 5 a session must not retry a refusal, so a typo in a field name stalls it until the Coordinator says the call may be corrected.

## What to build

A call whose arguments fail validation (an unknown field, a missing required field, a value outside the enum) answers with its own code, for example `invalid_argument`, and names the field and the accepted values. Only a role or permission check answers `forbidden`. The Agents topic shows refusals only for `forbidden`.

Seen 2026-10-20 16:47Z: impl-975 called `task.criterion` with `action: "done"`, then `operation: "done"`; the field is `op`. Both answers were `code: forbidden`, reason "criterion operation must be done, verify, fail, add, edit or remove".

## Acceptance criteria

- [ ] C1. `task.criterion` with an unknown field or a missing `op` answers a non-`forbidden` validation code that names the field and the accepted values (test).
- [ ] C2. Every spoke tool's argument validation failure uses the validation code, and a role refusal still answers `forbidden` (test over the tool table).
- [ ] C3. A validation failure is not posted to the Agents topic as a refusal (test).
- [ ] C4. The MCP server instructions and `hub/README.md` say a validation error may be corrected and retried, unlike `forbidden`.
