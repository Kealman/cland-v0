---
id: T-1594
kind: task
title: The supervisor
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1593
topic: topic-1357
branch: t/T-1594-the-supervisor
created: 2026-11-02T03:33:54.007Z
updated: 2026-11-03T01:32:29.098Z
---

## Summary

A `setsid nohup` supervisor loop keeps `cland host serve` alive with no systemd: it starts once, refuses to run twice, ignores SIGHUP and restarts the agent within about 2 s after any exit. Harnesses the agent spawned are untouched by the agent's restart.

Hot files: `hub/src/host/agent/supervisor.sh` (new), `hub/src/host/agent/server.ts` (pid file, SIGHUP), `hub/test/fakes/fake-host.ts`, `hub/test/host-supervisor.test.ts` (new)

## Acceptance criteria

- [x] C1. Started on a fake host, the supervisor runs the agent, and a second start while it lives exits without starting another (test).
  - done: impl-1594 · 2026-11-03T01:31:21.611Z
- [x] C2. After the agent is killed with SIGKILL, a new agent answers its hello within 3 s, and a process the old agent spawned is still alive with the same identity in the new agent's table (test).
  - done: impl-1594 · 2026-11-03T01:25:15.961Z
- [x] C3. The supervisor and the agent survive the end of the session that started them and a SIGHUP, and nothing in either calls `systemctl` or `systemd-run` (test).
  - done: impl-1594 · 2026-11-03T01:25:16.298Z
- [x] C4. `fake-host.ts kill-agent <host>` kills that host's agent and leaves the supervisor and harnesses running (test).
  - done: impl-1594 · 2026-11-03T01:31:22.930Z

## Notes

Shared files: the fake-host control script (adds kill-agent)

## Comments

### impl-1594 · 2026-11-03T01:21:46.756Z

Implementation inventory: supervisor.sh new internal entrypoint; agent.pid new private receipt {pid,identity}, consumed only by fake-host kill-agent and supervisor tests. Searched agent.sock/CLAND_HOST_RUN_DIR/host serve/observeProcesses in production, all tests, docs, QA and skills. No wire shape changes; AgentClient and existing protocol consumers stay compatible. Existing persisted captures remain the sole harness ownership store. Coordinator decision: kill-agent lives entirely in test support and checks receipt identity against native observation. Supervisor singleton uses atomic directory acquisition and pid/native-start liveness; ambiguous/stale lock fails closed for explicit recovery, never signals a recorded PID.

### impl-1594 · 2026-11-03T01:23:32.103Z

Rule20 concrete consumer search: production cli/host, cli/usage, host/{records,agent/{server,native,processes,bootstrap}}; tests host-agent, host-supervisor, fakes/fake-host, harness, session-resume-component, cli-help and frozen commands.json; docs spec/v0.4, agents/host-agent and cli-help guide, hub/adapters-and-sessions and retained declining-an-accepted-verifier-request reference. Existing agent wire framing and persisted process records are unchanged, so native/bootstrap/client and their tests need no migration. HOST_USAGE frozen fixture updated. No QA/skill consumers of supervisor entrypoint found; file-specific guide added.

### rev-36 · 2026-11-03T01:28:44.193Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1594-source-1
commit: 63a9afd7319cb41920bf14585c87139770cb409e
scope: full
findings: [{"severity":"medium","text":"Detached supervisor ownership is installed only after the PID-file wait. If setup is interrupted or the receipt is late/missing, finally has a no-op supervisor cleanup and recursively removes the root while its detached supervisor/agent can still write there. Acquire an early cleanup owner and prove the failed-setup path drains before removal.","file":"hub/test/host-supervisor.test.ts","line":27},{"severity":"medium","text":"kill-agent validates PID birth but never proves the process is the named fake host's agent. On Linux all fake hosts share the real boot id, so a valid agent.pid copied from another fake host passes observeProcesses and SIGKILL targets that other host. Bind the native target to the requested live agent owner as well as birth, retaining the Coordinator's test-only/no-RPC boundary.","file":"hub/test/fakes/fake-host.ts","line":50}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-1594 source review

Head63a9afd7319cb41920bf14585c87139770cb409e (supersedes6e923a4c; only timing-rationale correction after request). Run rev-36-1594-source-1; scope full; not clear.

## Standards

Medium — hub/test/host-supervisor.test.ts:27. The initiating shell exits after launching an unowned background supervisor; cleanSupervisor is installed only after eventually reads supervisor.lock/pid. A timeout/cancellation before that receipt leaves the cleanup function a no-op, yet finally recursively removes the root. The writer can remain alive/recreate or continue writing into deleted storage. The same setup boundary's child close waits have no dedicated cleanup owner. Register fixture/process ownership before the fallible launch/receipt phase, retain the root until every launched writer is observed stopped, and add a bounded missing/delayed-receipt setup control with independent red-control ownership (rule12). A normal success-path ownProcess call does not cover this failure path.

Medium — hub/test/fakes/fake-host.ts:50. Native birth equality alone does not bind a process to the requested fake host. On Linux observeProcesses uses the kernel boot id for all fake hosts and ignores CLAND_HOST_BOOT_ID_FILE. Copy host B's valid agent.pid into host A's private run directory: kill-agent A reads B's PID/identity, fresh native equality succeeds and signals B. Nothing checks A's live agent or its authenticated endpoint. This violates C4's named-host target and rule26's owner-bound signal fence. Keep the Coordinator's chosen test-only identity-check approach and no production kill RPC, but bind the target to the named host's actual live agent as well as birth. Add two independent fake hosts, plant the other valid receipt, assert refusal/no signal and both agents/harnesses remain usable, alongside the existing mismatched-birth case. No destructive reproduction was run; this is a direct source trace of native.ts's Linux identity contract.

The Coordinator decision cd9925f7 explicitly declined a kill RPC and directed pid-file+fresh shared identity checks. Those checks are present and should remain; the finding is their missing named-owner binding, not a request to bypass that decision.

## Spec

C1 test-lifecycle verification failed for unowned setup failure. C4 failed for a copied valid foreign-agent receipt targeting another fake host. C2/C3 remain runtime-unverified. Other inspected source paths: atomic mkdir serializes supervisors, stale/incomplete records refuse without signals, shell ignores HUP and reaps/restarts its direct child after1s. CLI installs HUP handling before asynchronous agent startup. agent.pid is checkpointed before authenticated admission and uses the existing identity parser/store. Harness ownership state remains unchanged. Existing restart/hello/retained harness assertions cover the normal path in source, but no Reviewer execution is claimed.

Help and independent frozen HOST_USAGE expectations migrate together; subsystem/agent/per-test docs and tier/index updated. Consumer inventory names new PID-file readers and no wire operation is added. All local reported supervisor/preservation/typecheck/lint observations are pre-verification evidence only. Fresh corrected-head source review is required before queued verification. Reviewer ran no tests/probes/browser and made no source edits.

Criteria: C1 failed (Missing or late detached supervisor PID receipt leaves fixture cleanup without a writer owner before root removal.), C4 failed (Linux kill-agent can accept another fake host's valid PID/birth receipt and signal that other host's agent.).

### impl-1594 · 2026-11-03T01:30:46.663Z

Addressing source review A-16091: supervisor fixture now captures a gated detached starter immediately, releases launch only after cleanup exists, and holds starter ancestry until supervisor receipt captured. Missing-receipt failure test independently captures the actual PID, exercises cleanup and observes native absence before root removal. kill-agent now requires CLAND_HOST_SECRET and authenticates the named run directory's agent.sock, compares hello PID with receipt before shared birth observation/SIGKILL. No new RPC. Two real fake-host agents plus harnesses reject copied foreign receipt and retain original identities. Local macOS new generated cases passed3/3 before final close-wait tightening; red control expected owner refusal failed with old helper's identity-only refusal (Linux would have signalled foreign process). Updated source review pending checks.

### rev-36 · 2026-11-03T01:32:29.098Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1594-source-2
commit: b621b134bd07615cfc5f7a1d88a625e016b0d6aa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1594 corrected source review

Headb621b134bd07615cfc5f7a1d88a625e016b0d6aa. Run rev-36-1594-source-2, scope full, source clear; findings none. Complete correction from63a9afd7 inspected; no dev merge or production supervisor change.

## Standards

A-16091 setup ownership finding resolved. startSupervisor captures the directly spawned detached starter before releasing its launch gate. That starter remains alive behind a departure gate until the supervisor receipt is captured and native ownership registered. Missing/late supervisor receipt therefore retains observable ancestry for the early cleanup owner. Starter and duplicate invocation waits now require bounded native close receipts. Failed-setup regression withholds its expected receipt while independently observing the real supervisor, drains the early owner, requires native supervisor absence, and removes the root only afterward; independent fallback owns the red control. Existing supervisor/harness cleanup remains before removal.

A-16091 named-host signal finding resolved. fake-host kill-agent stays entirely in test support and uses the existing authenticated AgentClient handshake. It requires CLAND_HOST_SECRET, connects to the requested host's live agent.sock, compares hello PID with the file, then performs fresh shared native birth validation before SIGKILL; its client closes in finally. No production kill RPC is introduced. Two-host regression copies the other live agent's valid receipt and requires owner refusal; afterward both original agent identities and harnesses are observed live. This pairs the fresh cleanup/signal path with no inherited foreign authority, including the Linux shared-kernel-boot case.

## Spec

No findings. Original singleton/HUP/initiating-shell-departure/replacement hello/retained harness identity assertions remain. The three-second C2 measurement starts at the injected kill and retains its final bound; setup waits are separate. Shell singleton/stale-lock behavior, direct-child restart loop, pre-admission agent.pid checkpoint and CLI HUP handling are unchanged from the initial review. Docs explain the new secret/owner checks and gated fixture lifecycle. C1/C4 source defects resolved; C1–C4 remain runtime-unverified pending same-head post-source mode-free verification and named native facts for all three lifecycle cases.

Local reported three-case macOS Node24.21 observations and typecheck are supplemental; earlier host-agent18/fake-ssh9/cli-help7 receipts belong to prior heads. Final lint was still running at request time, not counted as completed. Required source/consumer inventory and independent help expectations remain present. QA after-stage. Reviewer ran no tests/probes/browser and made no edits.
