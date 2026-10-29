---
id: T-1437
kind: task
title: "Test lint: an existing T3 file that loses its T3 header is refused with a misleading 'exceeds frozen allowance 0' message"
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-29T04:26:29.075Z
updated: 2026-10-29T15:59:42.907Z
---

## Summary

Found on T-1413 (topic-1171, 2026-10-29). An import placed above the `// T3: …` header of `hub/test/telegram-polling-restart.test.ts` made `analyzeTestSource` treat the file as not lifecycle. The admission lint then refused it with `startDaemon count 3 exceeds frozen allowance 0`. That message points at the frozen baseline, which can only shrink, instead of at the lost header. The `t3-lifecycle` finding that names the real cause is emitted only for new files.

## What to build

When a file mapped T3 (or T4) has no `T3:` header in its leading comment block, the refusal names that cause: "first comment block must name the process behaviour", with the file and line, for existing files too. Process-call counts against the baseline only apply after that.

## Acceptance criteria

- [ ] C1. An existing T3 file whose header is preceded by an import is refused with the t3-lifecycle message naming the header, not a frozen-allowance count.
- [ ] C2. An existing T3 file with its header keeps its current lint result unchanged.
