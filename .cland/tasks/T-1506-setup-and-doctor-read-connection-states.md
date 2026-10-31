---
id: T-1506
kind: task
title: Setup and doctor read connection states through a bounded readiness wait
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: topic-1270
branch: t/T-1506-setup-and-doctor-read-connection-states
created: 2026-10-31T08:18:54.524Z
updated: 2026-10-31T15:06:00.961Z
---

## Summary

T-1502 found that `cland setup` read a paired remote's connection state as a single sample and reported `open` while the gateway was reconnecting. Audit setup and doctor for any other status read as a single sample, and give each one a bounded readiness wait. Rule batch 5 (A-14855) C3, accepted by the human on 2026-10-31.

## Acceptance criteria

- [x] C1. The item lists every setup and doctor step that reports a connection, pairing, process or service state, and records for each one whether it reads a single sample.
  - done: impl-1506 · 2026-10-31T14:50:14.126Z
  - verified: rev-34 [reviewer] · run rev-34-20261031-1506-source2 · 2026-10-31T14:58:11.250Z · commit 6ae0214a595b3217461d71d7e90f148f983c0871
  - verified: rev-34 [reviewer] · run rev-34-20261031-1506-source3 · 2026-10-31T15:06:00.961Z · commit 7684bcaa9279e9038271d76ebc0879e75109df5b
- [x] C2. Each single-sample read that can see a transient state polls through the shared readiness helper from T-1502, within a bound. A test on fake clocks covers one transient-then-ready case and one past-the-bound case for each changed step.
  - done: impl-1506 · 2026-10-31T14:50:14.220Z

## Comments

### impl-1506 · 2026-10-31T14:46:03.708Z

C1 audit: setup project/harness install/favourite/trust/accounts/speech inspect persisted config/files/completed commands, not connecting services. Logins and doctor toolchain/keys inspect completed command/auth results. Setup hub running() samples discovery and authenticated hub.status; startProjectHub already polls startup for 10s. Aide samples running/exited/stopped (no starting status); launch/resume return action receipts. Telegram/Discord loaded disconnected rows are transient: paired reruns and Discord post-reload already wait; Telegram post-reload and unpaired initial reads do not. Pairing samples pending inbox after a human pause with one optional human wait; approval returns durable identity, no connecting state. Doctor project discovery/lock/PID identity and orphans are point-in-time OS diagnostics; hub.status is a bounded socket response and web unavailable is a final bind result. Doctor remotes samples transient disconnected rows (both messengers); pairing is stored identity in the reply. Web bundle/network/Git checks inspect installed/configuration facts. Changes planned: all loaded setup remote reads, Telegram post-reload and doctor remote connections use shared T-1502 waitForRemote. Disabled/missing-token/missing-row/old-hub diagnostics remain immediate. Consumer search: waitForRemote/remote.status/remotes/connection across hub/src, hub/test all tiers, web/nvim/shared, .agents/skills, docs/agents, qa. No wire change; projections/platforms unaffected; setup and doctor/readiness tests/docs/help/implement guidance affected. Existing public setup steps/local doctor frames are the approved seams.

### rev-34 · 2026-10-31T14:55:24.328Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261031-1506-source1
commit: c9eae2e0599a92cba4c86cc5feecf3b24f3db1e4
scope: full
findings: [{"severity":"medium","text":"M1: doctor work is joined/reset in a later separate t.after, after the shared cleanup hook has closed the legacy server and removed fixture directories. Pre-own this operation through onCleanup before invocation, retain native drainage deadlines, and add same-owner omitted/aborted observation controls proving work/socket settlement before removal.","file":"hub/test/doctor-remotes.test.ts","line":317}]
finding_counts: {"high":0,"medium":1,"low":0}

Full fixed-base source audit A-14894 at tree291e0a51f59bb8b8cc9b24f1bb6f6701ec3b01a3, baseeb1a6f93f0a588c36a532b83ce5cd4c99f5c01fe. Standards: M1 medium; Spec: no additional findings. Requested readiness paths/shared policy and C1 inventory inspected; C1/C2 remain unverified pending correction and exact-head runtime evidence. Reviewer performed read-only audit only. Local A-14883 remains attributed to claimed macOS checks; no configured run yet. Consolidated audit complete; replacement source review before verification.

### impl-1506 · 2026-10-31T14:56:24.713Z

Addressed source1 sole finding M1 (A-14894). Two lifecycle controls first failed 'doctor operation joined before resource/root cleanup: false !== true'. New doctorReadinessOwner registers onCleanup before invocation, joins report and closed native request sockets before clock reset, and guards root removal with that drain. Omitted/aborted result observations exercise real cleanup lanes and assert joined work/zero peers while root exists, then closed server/zero writers and absent root. A-14896 records correction; touched doctor file now 22/22 local macOS Node24.21.0, no browser or full suite. No production change from source1; replacement source review follows completed checks.

### rev-34 · 2026-10-31T14:58:11.251Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261031-1506-source2
commit: 6ae0214a595b3217461d71d7e90f148f983c0871
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Cumulative source clear A-14898, tree3ce7e05ac3e2625cadc0aaf17674bb23b0a04a92, original fixed baseeb1a6f93f0a588c36a532b83ce5cd4c99f5c01fe. Sole M1 resolved by pre-owned onCleanup doctor drain, native deadline clock and project-root removal guard; same-owner omitted/aborted observation controls retain actual cleanup ordering assertions. Production/setup unchanged since source1, no additional Standards/Spec findings. C1 audit cross-checked and verified; C2 remains runtime-pending. A-14896 local red/green and source request macOS checks are limited evidence, not configured/full verification. Reviewer read-only audit only; mode-free exact-head run follows.

Criteria: C1 verified.

### impl-1506 · 2026-10-31T15:04:48.615Z

Configured 2fb6676a at 6ae0214a5 failed T1 on hub/test/cli-usage-compatibility.test.ts::all command usage exports retain their pre-refactor bytes (A-14908, droplet Linux x64 Node24.21.0). Actual output: AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal; actual adds 'enabled loaded disconnected remotes wait up to 10 seconds concurrently for local readiness' and replaces paired-only setup wording. Minimal local reproduction confirmed red. Cause is missed independent frozen command literals in hub/test/fixtures/cli-usage/commands.json, consumed by frozenUsage in both cli-usage-compatibility.test.ts (T1) and cli-help.test.ts (T2 native help composition); no product defect or shared-defect candidate. Consumer inventory now includes these fixtures and tests. Updating only setup/doctor literal entries; retaining every assertion and all unrelated frozen bytes. T2/Web unexecuted in failed run; no coverage/pass claim.

### rev-34 · 2026-10-31T15:05:09.376Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261031-1506-evidence1
commit: 6ae0214a595b3217461d71d7e90f148f983c0871
scope: evidence
findings: [{"severity":"medium","text":"M2: frozen DOCTOR_USAGE/SETUP_USAGE omit the intentional readiness help changes; original run2fb6676a/A-14908 fails the unchanged pre-refactor-byte guard. Migrate only these two owned literals and keep all compatibility assertions; red/green and new-head source review before retry.","file":"hub/test/fixtures/cli-usage/commands.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

Original failed evidence audited in A-14910. T0 passed, T1 red; unique records1253 ordinary pass/1 fail plus155 passing load (30 item setup repetitions). Doctor T2/Web unexecuted, T3 deferred, no T4; C2 remains unverified. C1 source audit retained. No new production Spec finding. Linux x64 c-8 lon1 Node24.21.0/Neovim0.12.5, browser provenance null; prepared host gate reuse not remote re-typecheck. Budgets/lint report-only. Reviewer acknowledges frozen help consumer missed during source review. Preserve A-14908 as failed original; successor source and exact-head verification required.

### rev-34 · 2026-10-31T15:06:00.961Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261031-1506-source3
commit: 7684bcaa9279e9038271d76ebc0879e75109df5b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full cumulative source clear A-14911, tree815a334b0bbbb630161db5d0dc3d996c4dcfc76f. Only two frozen JSON values changed, SETUP_USAGE/DOCTOR_USAGE, each independently equal to production; other keys/values and compatibility/native-help assertions unchanged. M2 resolved; M1 owner correction retained unchanged. No Standards/Spec findings. C1 refreshed; C2 remains runtime-pending. Preserve failed original2fb6676a/A-14908 separately; local macOS claimed1/1+5/5 is not configured runtime evidence. Read-only review; new-head mode-free verification next.

Criteria: C1 verified.
