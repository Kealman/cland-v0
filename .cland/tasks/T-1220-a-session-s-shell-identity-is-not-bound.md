---
id: T-1220
kind: task
title: A session's shell identity is not bound to a per-session credential
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - bug
  - security
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-952
branch: t/T-1220-a-session-s-shell-identity-is-not-bound
created: 2026-10-24T09:32:51.634Z
updated: 2026-10-24T09:36:15.419Z
---

## Summary

Found by impl-1219 while answering T-1219's C3 (2026-10-24 09:32Z; evidence artifact in topic-951). CLI calls from a session's shell authenticate to the hub with the project-wide discovery secret. The session identity they then present (name, id, role) is taken from environment variables and is not checked against a per-session credential such as the launch token. So a process running in one session's shell can act as another session, and a shell that presents no identity acts as the human. The second part is already documented behaviour.

Trust model today: every session runs as the same OS user on one machine. This gap matters because cland's guardrails (role permissions, the rule that a peer message is never the human's approval, verdict authorship, merge rights) assume each session acts only as itself.

## Acceptance criteria

- [ ] C1. A shell CLI call is attributed to a session only when it presents that session's own per-session credential; a call presenting another session's identity is refused, shown in a sealed real-hub test.
- [ ] C2. A shell that presents no session identity keeps acting as the human, as today (human decision, General 2026-10-24 09:35Z, answer to ask a4e7c1e1); docs state this, and a test pins it.
- [ ] C3. Harness adapters (Claude Code, Codex, OpenCode) deliver the credential to their own shells only, and docs describe the trust model.
