---
id: T-1220
kind: task
title: A session's shell identity is not bound to a per-session credential
state: open
status: review
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
updated: 2026-10-24T10:18:06.471Z
---

## Summary

Found by impl-1219 while answering T-1219's C3 (2026-10-24 09:32Z; evidence artifact in topic-951). CLI calls from a session's shell authenticate to the hub with the project-wide discovery secret. The session identity they then present (name, id, role) is taken from environment variables and is not checked against a per-session credential such as the launch token. So a process running in one session's shell can act as another session, and a shell that presents no identity acts as the human. The second part is already documented behaviour.

Trust model today: every session runs as the same OS user on one machine. This gap matters because cland's guardrails (role permissions, the rule that a peer message is never the human's approval, verdict authorship, merge rights) assume each session acts only as itself.

## Acceptance criteria

- [x] C1. A shell CLI call is attributed to a session only when it presents that session's own per-session credential; a call presenting another session's identity is refused, shown in a sealed real-hub test.
  - done: impl-1220 · 2026-10-24T10:13:17.395Z
- [x] C2. A shell that presents no session identity keeps acting as the human, as today (human decision, General 2026-10-24 09:35Z, answer to ask a4e7c1e1); docs state this, and a test pins it.
  - done: impl-1220 · 2026-10-24T10:13:17.528Z
- [x] C3. Harness adapters (Claude Code, Codex, OpenCode) deliver the credential to their own shells only, and docs describe the trust model.
  - done: impl-1220 · 2026-10-24T10:13:17.856Z

## Comments

### impl-1220 · 2026-10-24T10:13:17.993Z

Implemented and pushed fbedaf44f94eb0e79340ef1b7496603aec3d8ac9. Session claims require their own credential before client dispatch. Legacy tokenless shells migrate on own MCP reconnect after the shipping restart without relaunch; relaunch rotates, archive removes private files. C1–C3 done. Evidence and exact local-test limitations: A-10724. Includes T-998/T-1219 from dev 63e0e0b0. Requesting full source review before mode-free verification; no per-item QA policy/brief.

### impl-1220 · 2026-10-24T10:15:42.264Z

Source-review head updated to 9585983c200b14bbb15514e1a9d0ad9b30e12532 before a source verdict: legacy reconnect now retains the existing own-spoke launch token when the old database has no credential table, avoiding invalidation of already-tokened shells. The new raw upgrade regression went red then green; all 8 credential tests pass locally. Tokenless Coordinator migration remains green. No dev merge after review request.

### impl-1220 · 2026-10-24T10:18:06.471Z

Reviewer M1/C3 fixed at 54ce12850efe27c2aacd40d3e57978d9fc954ddd: all three new guides now use exact repository test-path headings. Existing test-docs guard reproduced the failure, then passed 3/3 locally. Docs-only delta from 9585983c; waiting for consolidated source verdict before verification.
