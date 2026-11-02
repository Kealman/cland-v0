---
id: T-1588
kind: task
title: The host agent's protocol, its client and its process operations
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1325
branch: t/T-1588-the-host-agent-s-protocol-its-client-and
created: 2026-11-02T03:33:52.542Z
updated: 2026-11-02T05:57:40.952Z
---

## Summary

`cland host serve`, using Node built-ins only, listens on `agent.sock` in a 0700 run directory and speaks JSON lines: request `{id, op, args}`, reply `{id, ok, result}` or `{id, ok: false, error}`, and the events `process-exited` and `memory`. The hello carries the per-host secret and answers with the agent's version and boot id. It spawns processes detached in their own session and process group, keeps a persisted process table with Linux birth identities, signals and stops by identity, and reports RSS and CPU per process tree; a hub-side client speaks the same protocol.

Hot files: `hub/src/host/agent/` (new: `protocol.ts`, `server.ts`, `processes.ts`), `hub/src/host/agent-client.ts` (new), `hub/src/cli/host.ts` (new), `hub/bin/cland.ts`

## Acceptance criteria

- [ ] C1. A hello without the agent's per-host secret, or with another, gets an error reply and the connection is closed, and no other op is answered before a successful hello (test).
- [ ] C2. The hello reply carries the agent's cland version, pid and boot id, and an unknown op or a malformed line gets an error reply without closing the connection (test).
- [ ] C3. A spawn starts a child in its own session and process group with the given argv, environment, cwd and log file. The child survives the agent's exit, the agent's own `CLAND_HOST_*` variables never reach it, and the env never reaches its argv (test).
- [ ] C4. Identities are `linux:<boot id>:<start ticks>`, from `/proc` on Linux; on another platform, and only for a fake host, the start time comes from `ps` and the boot id from the file named by the agent's boot-id variable (test).
- [ ] C5. A signal or stop with a stale identity (reused pid, other boot id) signals nothing and says so, and a live identity's process group gets the signal (test).
- [ ] C6. The process table survives an agent restart, and a restarted agent reports each recorded process's liveness and its tree's RSS and CPU (test).
- [ ] C7. A `process-exited` event reaches a connected client with the process's identity and exit status, and a `memory` event reports total and available memory at a fixed interval (test).
- [ ] C8. A T1 lint fails when a module under `hub/src/host/agent/` imports anything but `node:` built-ins or another agent module (test).

## Notes

Shared files: the agent protocol module (framing, hello, events owned here; ops added by 07, 19 and 23 in that order); `hub/src/cli/host.ts` (created here)

## Comments

### impl-1588 · 2026-11-02T05:43:27.490Z

Rule 20 inventory before changes: searched host/agent, agent-client, process-exited, CLAND_HOST_, host serve across hub/src, hub/test, web, nvim, shared, docs, qa and shipped skills. No existing agent wire consumers; new consumers are server, client, CLI and tests. Existing process-identity.ts owns Linux birth parsing and must retain old exports/shape. Proposed v1 JSONL: request {id,op,args}; hello args {protocol:1,secret}; success {id,ok:true,result}, failure {id,ok:false,error}; hello result {protocol:1,version,pid,bootId}; events {event:'process-exited',pid,identity,code,signal} and {event:'memory',totalBytes,availableBytes}. Operations spawn, identity, alive, signal, stop, processes. Later op owners T-1593/T-1605/T-1609 extend dispatch. No existing wire shape is replaced.

### impl-1588 · 2026-11-02T05:48:05.684Z

Shared extraction exports: host/agent/identity.ts owns linuxIdentity(pid,stat,boot,report?,reportExited?), readLinuxBootId(): Promise<string>, readLinuxBootIdSync(): string and callback types. process-identity.ts imports/re-exports unchanged linuxIdentity/types and the two new readers. Existing Linux read sites use the readers. Coordinated with T-1615, which consumes the exports. Initial native CLI restart test exposed stale agent.sock after SIGKILL; adding stale-listener recovery while refusing an active listener.

### impl-1588 · 2026-11-02T05:57:40.952Z

Rule 20 extraction inventory (search process-identity/linuxIdentity/readLinuxBootId in production, colocated tests, all tiers, docs, QA, shipped skills): production consumers adapters/{sessions,processes,claude-code-local}, host/local, system-processes, stdio-writers, suite-command, hub/suite-isolation, executor/local and executor/droplet/watchdog retain existing process-identity imports/behavior unchanged. Test/fixture consumers host-boundary, measure-memory, process-cleanup, memory-producer, claude-code-sessions-lifecycle, session-resume-component, system-process-probe, system-processes, process-identity, executor-droplet and process-started are unaffected through re-exports. References in tests.md; per-test guides for host-boundary/lifecycle-serialization/process-identity/session-resume-component/telegram-polling-restart/fake-claude-cleanup/host-local-contract; QA briefs E-1531-stage-2/stage-3 and E-1284 remain valid. T-1615 imports the new boot readers. No old function signature or wire shape is removed.
