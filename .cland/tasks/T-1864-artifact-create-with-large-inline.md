---
id: T-1864
kind: task
title: artifact.create with large inline content times out at 300 s with an unknown outcome
state: open
status: backlog
size: S
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: null
branch: null
created: 2026-11-15T04:42:50.038Z
updated: 2026-11-16T07:29:17.405Z
---

## Summary

On 2026-11-15 around 04:37Z, impl-1835 (T-1835) called `artifact.create` with large inline `content`: a 979-test ledger plus repeated ~11,900-name `/private/tmp` inventories. The spoke returned `timed out awaiting tools/call after 300s`. There was no refusal, and it is unknown whether the hub created the artifact. Smaller inline content and a file-path publication succeeded immediately afterwards (A-19506, A-19507). T-576 fixed a similar lost result for large folders (closed 2026-10-20). Inline content is a separate path.

## What to build

Find where a large inline `content` stalls: size limits, the secret scan, the copy and index write, or the spoke's framing. Then do two things:
- an oversize inline body is refused promptly with a named limit, and the error suggests `path`;
- an accepted body completes well within the tool-call timeout.

When the outcome is unknown, a retry must not publish a duplicate. Use the same idempotency T-576 gave folders.

## Acceptance criteria

- [ ] C1. `artifact.create` with inline content above the limit is refused quickly with the limit and a pointer to `path`, and content at the limit completes within a bounded time (test).
- [ ] C2. A retry after a lost reply returns the same artifact rather than a duplicate (test).
