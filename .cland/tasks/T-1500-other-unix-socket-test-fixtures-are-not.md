---
id: T-1500
kind: task
title: Other Unix-socket test fixtures are not safe under a deep TMPDIR on macOS
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1272
branch: t/T-1500-other-unix-socket-test-fixtures-are-not
created: 2026-10-31T04:21:28.348Z
updated: 2026-10-31T14:48:58.660Z
---

## Summary

T-1499 fixed the admission exchange socket, which exceeded macOS's 104-byte `sun_path` limit under the suite temp root. Its rule 20 audit, recorded on T-1499, found the remaining direct Unix-socket fixture paths in hub/test, nvim/test and web/test. They fit today's suite root but are not safe under a deeper TMPDIR. A longer suite root or project path would break them on macOS the same way. Follow-up of T-1499 (0.3.1).

## Acceptance criteria

- [ ] C1. Every Unix-socket listener created by test fixtures allocates its path through one shared helper that budgets UTF-8 bytes including the NUL under 104, independent of TMPDIR depth, and a control proves a deep TMPDIR (≥ 90 bytes) still binds.

## Comments

### impl-1500 · 2026-10-31T14:45:21.575Z

C1 seam: shared fixture path allocator + real native listen/close with >=90-byte TMPDIR. Consumer audit searches .sock, listen, createServer/createSocketEdge, controlPath, --listen across hub/test, nvim/test, web/test. Production layout and absent socket/discovery assertions remain unchanged. Migrating explicit stub/listener/control paths and matching client reads; no wire contract changes.

### impl-1500 · 2026-10-31T14:48:58.660Z

Consumer audit complete: explicit hub fixture listeners migrated in account-cli, admission-exchange, artifact-lifecycle, cli, codex-native, cover-quiet, fakes/legacy-remote-hub, harness-framing, hub-status-component, init-machine-lifecycle (generated child import), item-lead, name-reservation, plan-stage-fixture, prompt-races, request-guard, roles-snapshot-cli, session-brief[-component], session-credential-io, suite-admission, task-card-component, test-admission, tracker-rank, verify-submission, visibility-component, web-auth and web-authority. Neovim stub callers and all control lookups migrated, plus client.ts native RPC --listen and startup-budget-support listener. Web tests have no direct Unix listeners; they consume migrated hub/Neovim fixtures or production daemons. Remaining sockets: production daemon/layout/edge lifecycle assertions, fake-codex receiving production argv, absent/occupied socket controls and textual test-lint samples stay unchanged to preserve production contracts. Raw frames/previous wire shapes unchanged; endpoint is still an ordinary path. Native server.close retains unlink ownership; no directory writer/cleanup order changes. Full exact file inventory will accompany source review artifact.
