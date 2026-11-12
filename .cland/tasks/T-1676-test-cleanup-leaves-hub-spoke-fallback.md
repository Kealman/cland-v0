---
id: T-1676
kind: task
title: Test cleanup leaves hub/spoke fallback endpoints, Codex placeholder cx-*.sock files and fixture-owner receipts in TMPDIR
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-04T14:47:20.399Z
updated: 2026-11-12T18:00:32.067Z
---

## Summary

E-1532 stage-4 QA (qa-678, A-16582) found 15 entries left in TMPDIR after the named test files, while none are live (zero open lsof, owner PIDs gone, roots removed):
- 13 root hub/spoke fallback sockets;
- `cland-run` with 19 Codex sockets;
- `cland-fixture-owners-501` with 13 owner receipts.

Per-file attribution: `opencode-adapter`, `claude-code-adapter`, `codex-adapter` (15 Codex endpoints), `worktree-cli` and `hub-lifecycle` leave fallback endpoints and receipts. `adapter-native-boundary` leaves 4 regular `cx-*.sock` placeholder files. Every class reproduces at stage-3 head 8c9f569c. Receipt removal is registered only on hub exit (`cli/hub.ts` ~324), so it is not a by-design retention.

## What to build

Each fixture removes the fallback endpoints, placeholder files and owner receipts it created when its test ends, including on failure. A post-file TMPDIR census in the affected files asserts nothing remains.

## Acceptance criteria

- [ ] C1. After each named file, TMPDIR holds no fallback endpoint, placeholder socket file or owner receipt that the file created (test).
- [ ] C2. The same holds when a test in those files fails (test).

## Comments

### coord · 2026-11-12T18:00:32.067Z

More evidence (E-1537 stage-1 QA, qa-678, at 88e9f9596, 2026-11-12 18:00Z, A-19083): 35 new dead fixture-owner receipts naming the source worktree, from unchanged producers: 24 nvim/test/shell.test.ts, 1 sessions-lifecycle, 10 hub/test/daemon.test.ts. Every owner PID absent, no open handles, fixture roots gone. The producers (nvim client/stub-hub/harness, shell and lifecycle files, CLI hub.ts, shared/fixture-ownership.ts, harness.ts startDaemon/killDaemon) are byte-identical to pre-stage BASE 94b73e73c. Accepted in that run as found aside (run correction R-1); receipts left in place.
