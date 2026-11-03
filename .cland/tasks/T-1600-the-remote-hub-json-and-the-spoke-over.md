---
id: T-1600
kind: task
title: "The remote hub.json and the spoke over ws+unix:"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1596
  - T-1599
topic: null
branch: null
created: 2026-11-02T03:33:55.459Z
updated: 2026-11-03T07:19:33.205Z
---

## Summary

The discovery file gains a remote kind: the forwarded `hub.sock`, a `ws+unix:` spoke endpoint on `spoke.sock`, the per-host secret, the version and `remote: true`, with no pid and no port. When a host's tunnel is first up, the hub writes it at the host clone's `.cland/hub.json` through the agent. The spoke, the CLI, hooks and the mod bridge on a host read it, and the CLI and doctor never pid-check it.

Hot files: `shared/project-discovery.ts`, `hub/src/project.ts`, `hub/src/spoke/spoke.ts`, `hub/src/cli/hub.ts`, `hub/src/cli/hook.ts`, `hub/src/doctor/project.ts`, `hub/src/host/ssh-host.ts` (writing it), `hub/test/remote-discovery.test.ts` (new)

## Acceptance criteria

- [ ] C1. `readDiscovery` accepts a remote-kind file without `pid` and `port`, still refuses a malformed one, and reads every existing local `hub.json` as before (test).
- [ ] C2. A spoke whose discovery file is remote connects through the `ws+unix:` endpoint with the per-host secret and re-reads the file before each reconnect (test).
- [ ] C3. `cland hub status`, `cland doctor` and the hook CLI never pid-check a remote `hub.json`, and they reach the hub through its socket path (test).
- [ ] C4. On a fake host the written file is 0600, holds the host's secret and never the project secret, and its content is unchanged across a hub restart (test).
- [ ] C5. A spoke on a fake host, launched with a session's credential, connects through `spoke.sock`, and after `cland host revoke` the spoke's next hello is refused (test).

## Notes

Shared files: `shared/project-discovery.ts` (Discovery remote kind, sole owner); `hub/src/spoke/spoke.ts` (22 later)
