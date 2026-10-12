---
id: T-266
kind: task
title: "The hub and the suite portable to Linux: ps personality, the fake's EPIPE, the handover audit race, root-safe tests (found by the T-256 prototype)"
state: open
status: backlog
labels:
  - v0.1.2
  - hub
  - bug
assignee: null
parent: T-268
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:38:22.090Z
updated: 2026-10-12T11:54:39.670Z
---

## What happened

The T-256 prototype (docs/research/remote-executor.md on prototype/remote-executor, eccc31d) ran the full suite on a DigitalOcean c-8 droplet (Ubuntu 24.04, procps-ng 4.0.4). As shipped, `npm test` stops after 1.4 s: the runner's process cleanup calls `ps ww -axo …` (hub/test/process-cleanup.ts) and Linux `ps` rejects it with "must set personality to get -x option"; production code makes the same call in hub/src/system-processes.ts. With `PS_PERSONALITY=bsd` the suite ran: 1612 of 1623 passed, 6 skipped (macOS sandbox-exec, the real opencode binary, a root check), 5 failed:

- hub/test/aide.test.ts "cland init writes the Aide defaults and CLI launches several Aides": the fake Claude session dies on an uncaught `write EPIPE` (hub/test/fakes/claude-code/fake-claude.ts, the hook's stdin has no error listener and dash exits before the payload is written); 4 of 6 runs alone.
- hub/test/handover.test.ts "a handover without a complete note is refused": the audit line is not yet in hub.log when the test reads it (a race between the reply and the log write).
- hub/test/init.test.ts "cland init on an empty repository": false positive as root (HOME is /root and a skill's text contains "App/root").
- hub/test/lead-permissions.test.ts and hub/test/tracker-ready.test.ts: pass alone, fail under the full run's load.

## What to build

The hub and its suite run on Linux without environment tricks: a portable process listing (no `-x` BSD option, or the personality set in code) in hub/src/system-processes.ts and the test cleanup; the fake's hook stdin handles EPIPE; the handover test waits for the audit line; root-safe assertions; the load-sensitive tests given the time they need or marked; the macOS-only cases skip with a reason. Needed before the remote executor (T-256) can report trustworthy results; the local run on macOS stays green.

## Acceptance criteria

- [ ] `npm run typecheck && npm test` on Ubuntu 24.04 (8 vCPU) passes with no environment variable beyond PATH, with the six platform skips listed by reason.
- [ ] `hub/src/system-processes.ts` lists processes the same way on macOS and Linux, covered by a test on both `ps` dialects.
- [ ] The five failures above are fixed at their cause, not retried.

## Comments

### coord · 2026-10-12T11:54:39.670Z

Realised by the slices T-280 (the portable process listing), T-281 (the five failures at their cause, the skip list) and T-282 (the acceptance run on a c-8 droplet and locally). This item stays open as the record and closes when T-282 lands, with the droplet and local results recorded here. Skip count as an ordinary user: five (four with opencode installed), per the Coordinator's note on T-268.
