---
id: T-1596
kind: task
title: Per-host secret admission and revocation
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1590
  - T-1592
topic: null
branch: null
created: 2026-11-02T03:33:54.494Z
updated: 2026-11-02T03:33:54.494Z
---

## Summary

A per-host secret is never the human. On the Unix spoke edge it admits a spoke hello only with the launch credential of a session whose row is on that host, and that session must hold a role. On the hub socket it admits a host client whose frames must carry that host's session credentials (CLI, hooks, mod bridge); identity-free and human-only frames are refused. `cland host revoke <id>` (human-only) revokes the secret and closes that host's live connections.

Hot files: `hub/src/hub/dispatch.ts` (hello), `hub/src/hub/server.ts` (bearer check), `hub/src/host/host-authority.ts` (new), `hub/src/protocol.ts` (`host.revoke`), `hub/src/cli/host.ts`, `hub/test/host-secret-admission.test.ts` (new)

## Acceptance criteria

- [ ] C1. On the Unix spoke edge, a hello with a host's secret and the launch token of a session whose row is on that host is welcomed with the session's role (test).
- [ ] C2. With the same secret, a hello carrying another host's session, a local session, no launch credential, or a session with no role is refused (test).
- [ ] C3. On the hub socket a client hello with a host secret never acts as the human: a frame with no session credential, or a human-only frame such as `role.set` or `session.launch`, is refused as forbidden (test).
- [ ] C4. On the hub socket, a hook, mod-bridge or CLI frame carrying the credential of a session on that host is dispatched as that session (test).
- [ ] C5. `cland host revoke <id>` closes every live connection admitted by that host's secret, later hellos with it are refused with a reason naming revocation, and the request is refused from a session or a host client (test).
- [ ] C6. The project secret's admission on every edge is unchanged, and the hub-socket, spoke-auth and web-authority test files pass with no test edited.

## Notes

Shared files: `hub/src/hub/dispatch.ts` hello admission (E-1536's T-1571 also edits `dispatch.ts`); `hub/src/cli/host.ts`
