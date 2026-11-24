---
id: T-2083
kind: task
title: ClaudeCodeAdapter and CodexAdapter close() return the cached closing promise even after it rejected, so a parent retry can't repair a failed native cleanup
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
created: 2026-11-24T11:43:42.854Z
updated: 2026-11-24T11:43:42.854Z
---

## Summary

Found by the reviewer during T-1961's review and reported by impl-1961 (a static source observation with no native reproduction; it predates T-1961). `ClaudeCodeAdapter.close` (hub/src/adapters/claude-code.ts:1393, `if (this.#closed) return this.#closing;`) and `CodexAdapter.close` (hub/src/adapters/codex.ts:1580, `if (this.#closing) return this.#closing;`) return the cached closing promise on every later call, including after it rejected. T-1961 makes createHub's close retryable, but when one of these adapters' native cleanup fails, a retry gets the same rejected promise back and nothing is cleaned up again.

## What to build

On a rejected close, let a later `close()` retry only the incomplete cleanup steps, with a new attempt bound to the same adapter identity. Or report an explicit incomplete close receipt that names what remains, so the parent can stop retrying knowingly. A successful close stays idempotent.

## Acceptance criteria

- [ ] C1. When an adapter's native cleanup rejects once, a second `close()` retries the remaining cleanup and resolves once it succeeds, for both adapters (test with fake native boundaries).
- [ ] C2. After a successful close, repeated `close()` calls return the same resolved result and redo nothing (test).
