---
id: T-296
kind: task
title: "OpenCode servers get their own database: the shared database lets OpenCode's background service resume cland's sessions (#51213)"
state: open
status: in progress
size: M
labels:
  - hub
  - bug
  - ready-for-agent
assignee: null
parent: E-424
blocked_by: []
topic: topic-336
branch: t/T-296-opencode-servers-get-their-own-database
created: 2026-10-12T16:20:56.477Z
updated: 2026-10-15T22:44:43.872Z
---

## Summary

E-424 slice 1 (tracer step 1). cland's per-session OpenCode servers share the user's default OpenCode database with OpenCode's background service, which resumes any session it finds mid-turn (upstream #51213). They move to a database of their own: one per user, or per account through the accounts registry.

## What happened

Found by the T-295 research (docs/research/opencode-v2.md on research/opencode-v2): cland's per-session OpenCode servers share the user's default OpenCode database with OpenCode's own background service (v2's one-service-per-user model). When that service starts, for example because an agent runs an `opencode` CLI command inside a cland session, it resumes every session that is mid-turn, cland's included, and two processes then drive one session; the resumed copy runs with the user's global config and without cland's spoke. Reproduced twice in isolation; upstream issue #51213 is open and the code is unchanged through 2.0.27.

## What to build

E-424's "Choices where the spec is silent" settle the details: where the database lives, the login, the proof and the interim rule. Read them first.

- **Per-user database.** With no account, every cland OpenCode server runs with `OPENCODE_DB` at `cland/opencode/opencode.db` under `$XDG_DATA_HOME`, else `~/.local/share`.
- **Per-account database.** An account from `~/.config/cland/accounts.toml` keeps the data home or the database the registry (T-361) gives it.
- **Environment.** The adapter drops any inherited `OPENCODE_DB` and `XDG_DATA_HOME` before setting its own.
- **Launch record.** The session's launch record names its database, and resume and relaunch reuse it.
- **Doctor.** It names the database and prints the standalone login line for it, which never starts the background service. It warns when an account points at the user's default database. It also says whether the free default model needs a login in a fresh database; settle that question first.
- **P3 proof.** The research's `probe-restart-sweep.mjs` becomes a hub test with a fake OpenAI-compatible provider. It is a platform skip where the real `opencode` binary is absent.
- **Interim rule.** It is retired on merge. The Coordinator records the rule's retirement; the Implementer names it in the merge report.

Code: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`, `hub/src/accounts/registry.ts`, `hub/src/doctor/toolchain.ts`.

## Acceptance criteria

- [ ] C1. A cland-launched OpenCode session is never resumed by OpenCode's background service, shown by the P3 reproduction turned into a hub test (platform skip without the real binary).
- [ ] C2. With no account the server runs on the per-user database under the data directory, an account keeps its registry database, and inherited OPENCODE_DB and XDG_DATA_HOME never reach the server.
- [ ] C3. The launch record names the database, and resume and relaunch reuse it.
- [ ] C4. `cland doctor` names the database and its standalone login line, warns when an account points at the default database, and says whether the free default model needs a login.
- [ ] C5. hub/README.md (OpenCode) describes the database and the login.
