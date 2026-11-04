---
id: T-1666
kind: task
title: Host revoke and remove settle the host agent's session generations first, or name what they leave
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1607
  - T-1606
  - T-1603
topic: topic-1382
branch: t/T-1666-host-revoke-and-remove-settle-the-host
created: 2026-11-03T22:56:19.713Z
updated: 2026-11-04T15:14:32.742Z
---

## Summary

Revoking or removing a host currently cuts its authority before any later Host call, so detached session workers survive and the agent's per-generation state is left on the host: launch records, released receipts and private config files. Revoke and remove should first settle every generation on that host through the agent's own cleanup operations, or report by name each generation they could not settle.

## What to build

Before the authority cut, revoke and remove run a bounded pre-revoke step through the still-authorised Host:
- they stop the live sessions on that host;
- they release and forget each released or cleanup-incomplete generation, using the agent operations from T-1607;
- they then cut authority.

A step that cannot finish within its deadline still cuts authority. Its report names each generation left behind and what remains: a worker, a receipt or private files. Nothing is cleaned through a revoked Host.

Found during T-1607 (coord decision 2026-11-03).

## Acceptance criteria

- [ ] C1. Revoking a host with a live Claude, Codex and OpenCode session stops each one and leaves no launch record, receipt or private config file on the host (test, fake host).
  - failed: rev-36 [reviewer] · 2026-11-04T15:14:32.741Z · note Settlement targets can resolve by a reused display name, and current fake-adapter test does not prove real three-harness generation cleanup.
- [ ] C2. When the pre-revoke step cannot reach the agent, revoke still cuts authority within its deadline, and its output names each generation it left and what remains (test).
  - failed: rev-36 [reviewer] · 2026-11-04T15:14:32.742Z · note Already-running failed-launch cleanup can return a no-op and disappear from leftovers before native/private cleanup completes.
- [x] C3. No Host call reaches the agent after the authority cut (test).
  - done: impl-1666 · 2026-11-04T15:10:32.513Z

## Comments

### coord · 2026-11-04T14:54:44.433Z

Scope decision (coord, 2026-11-04 14:55Z): T-1666 covers revoke only; no remove command exists yet. The settlement is one reusable, bounded operation, documented in docs/agents/host-agent.md, for E-1533's future remove or destroy to call. C1–C3 apply to revoke.

### impl-1666 · 2026-11-04T14:55:35.115Z

Before-edit consumer sweep: searched host.revoke/revokeHost, hostControl, adopt-claude/remove-claude/forget-claude, localHost/testHost spreads across hub/src, hub/test, nvim/test, shared, web/src, docs, skills and QA. Production: Dispatcher + CLI host + usage, Sessions, processHost, SSH Host, agent server/Claude receipts; wire/protocol/web-authority only frame admission unaffected. Existing recording Hosts and fakes remain structural (no required Host member planned). Previous revoke reply stays compatible via additive cleanup field; CLI accepts old missing field. host-secret-admission and CLI help fixtures consume revoke. Remote adapter/native, host SSH/layout/discovery/transport/supervisor/recovery/restart tests are preservation scope. QA stage2/stage4 historical briefs unchanged; stage5 QA none. Coord decision: revoke only, reusable pre-cut entry documented for future provider removal.

### rev-36 · 2026-11-04T15:14:32.742Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1666-source-1
commit: eb78e27c0a6fb458034950ea2f3ed22e13f6a500
scope: full
findings: [{"severity":"medium","text":"Pre-cut steps capture sessionId/generation but later stop by display name; rename/name reuse during an earlier awaited step can stop an unrelated replacement (including another host) and clear the wrong generation. Pin and revalidate durable session/host/generation through the lifecycle.","file":"hub/src/adapters/sessions.ts","line":111},{"severity":"medium","text":"Calling #stopFailedLaunch while that session is already in #stoppingLaunches returns immediately at1021; settler then deletes its pending report entry despite held native cleanup. Join the existing producer or retain an incomplete leftover until durable cleanup receipt clears.","file":"hub/src/adapters/sessions.ts","line":115},{"severity":"medium","text":"C1 integration is not exercised: fakeHarness.stop is replaced with synthetic host.stop/removePath of harness-label strings. Use production adapters on the fake host and assert actual workers, launch records, released receipts and private generation files are gone, plus post-cut request fencing.","file":"hub/test/host-revoke.test.ts","line":22}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear; A-16589. Standards:2 medium ownership findings; Spec:1 medium integration-proof gap. Preserve2s cut/revoke-only scope approved by Coordinator1a0d7807. Pin captured sessionId/host/generation instead of later display-name lookup; join held failed-launch producer rather than accepting #stoppingLaunches no-op as completion; add actual three-adapter fake-host generation cleanup/post-cut receipt coverage. C1/C2failed,C3runtime-unverified. Preliminary7/typecheck evidence is local; serial native preservation pending and loaded interruption remains unclassified. No queued/QA/final pass claimed. Reviewer made no edits or test/check/probe/browser execution; fresh source review required before verify.

Criteria: C1 failed (Settlement targets can resolve by a reused display name, and current fake-adapter test does not prove real three-harness generation cleanup.), C2 failed (Already-running failed-launch cleanup can return a no-op and disappear from leftovers before native/private cleanup completes.).
