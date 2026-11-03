---
id: T-1602
kind: task
title: The ADR 0003 and ADR 0004 amendments
state: open
status: ready
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1591
  - T-1596
  - T-1597
topic: topic-1364
branch: t/T-1602-the-adr-0003-and-adr-0004-amendments
created: 2026-11-02T03:33:55.945Z
updated: 2026-11-03T07:26:10.640Z
---

## Summary

ADR 0003 records the spoke edge on a Unix socket and the per-host git socket, which hosts reach only over the hub's own SSH connection, and the per-host secret's narrower authority; nothing new binds a network address. ADR 0004 records the territory served by `git daemon --inetd` through per-host sockets, pushes limited to task branches leased to the host's sessions, no deletion and no move of `dev` or `main`, and item branches created in the territory.

Hot files: `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, `docs/adr/0004-agents-work-on-a-local-git-territory.md`

## Acceptance criteria

- [x] C1. ADR 0003 has a dated amendment naming `.cland/run/spoke.sock`, the per-host git socket, the per-host secret and its refusal of human authority, and stating that no new listener binds a network address.
  - done: impl-1602 · 2026-11-03T07:23:35.150Z
  - verified: rev-36 [reviewer] · run rev-36-1602-source-1 · 2026-11-03T07:26:09.397Z · commit a1299c8aaa446eaaf8cb98ea9735bb3a250f5294
- [x] C2. ADR 0004 has a dated amendment naming `git daemon --inetd` per connection on per-host sockets, the per-host allow list with its revocation before merges, the refusal of deletions and of `dev` and `main`, and item branches created in the territory.
  - done: impl-1602 · 2026-11-03T07:23:35.287Z
  - verified: rev-36 [reviewer] · run rev-36-1602-source-1 · 2026-11-03T07:26:09.397Z · commit a1299c8aaa446eaaf8cb98ea9735bb3a250f5294
- [x] C3. Both amendments link spec §3.2, §3.3 and §3.12, and use the glossary's Host, Host agent and Tunnel.
  - done: impl-1602 · 2026-11-03T07:23:35.413Z
  - verified: rev-36 [reviewer] · run rev-36-1602-source-1 · 2026-11-03T07:26:09.397Z · commit a1299c8aaa446eaaf8cb98ea9735bb3a250f5294

## Notes

Shared files: `docs/adr/0003-*.md`, `docs/adr/0004-*.md`

## Comments

### impl-1602 · 2026-11-03T07:22:27.838Z

Drafted dated amendments from landing diffs d1eb35e34 (T-1591), f7b7a8367 (T-1596), 1fcc37db5 (T-1597), item comments including both T-1591 seam decisions, and stage-2 QA A-16202. Scope is ADR0003/0004 plus implement CHANGES note only; no runtime or shared contract change. Both link spec §§3.2/3.3/3.12 and glossary terms. Closed-item wording lint passed locally on Node24.21.0; full static docs gates in progress. First-review origin/dev fetch/merge is up to date. No verification run before source review; QA remains after-stage.

### rev-36 · 2026-11-03T07:26:09.397Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1602-source-1
commit: a1299c8aaa446eaaf8cb98ea9735bb3a250f5294
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1602 source review
Commit a1299c8aaa446eaaf8cb98ea9735bb3a250f5294
Branch t/T-1602-the-adr-0003-and-adr-0004-amendments
Run rev-36-1602-source-1; scope full; source clear; findings [].
Source-established criteria C1,C2,C3 verified. Required post-source mode-free verification remains pending; source clear is not final run evidence.

Standards: read all three changed files and both complete ADRs. Dated amendments retain the historical decisions and explicitly replace the older future transport wording and task-base migration. Glossary Host/Host agent/Tunnel definitions and both ADRs' glossary links agree. Each amendment links existing spec v0.4 headings §§3.2/3.3/3.12 with correct relative targets/anchors. The implement CHANGES note records source/provenance without modifying SKILL.md. Scope is documentation only; no runtime, shared contract, settings or role permission change, no new test dependency. Existing unrelated historical ADR amendments are not treated as new claims.

Spec:
C1 — ADR0003's 2026-11-03 amendment names .cland/run/spoke.sock and its fallback, per-host git socket/mode, hub-owned SSH Tunnel and agent.sock, no new network bind and retained local loopback. Per-host secret authenticates a Host without human authority; role/session credential requirements and refused cross-host/local/missing/roleless cases, credentialed CLI dispatch and human-only revoke reflect landed dispatch/host authority behavior.
C2 — ADR0004's dated amendment names per-connection git daemon --inetd on private Unix sockets, half-open proxy, explicit daemon environment/config, 128MiB receive cap, task branch lease allow list, no deletion/tags/other refs or protected dev/main/default moves. Read production git-daemon/environment, territory hook/branch creation, branch-leases, immediate merge and batch territory preparation: receive-pack holds territory lock through native close with30s stalled-push timer; public revoke uses push cap+2s bounded wait and existing lock context; merge revokes before freshness/read/preparation and batch pins heads under the short lock. Local unpublished task-base versus nonlocal territory tip behavior is correctly distinguished.
C3 — both amendments use and link glossary terms and all three required spec sections. No spec requirement missing.

Evidence limits: read A-16202 report at dev722f1ce5. It explicitly scopes stage QA to local macOS/fake transport/scratch repositories, no real SSH/browser/remote-host execution; its source/probe caveats and separately filed fixture follow-up are not rebranded as real carrier proof by these docs. CHANGES preserves those limits. This review establishes documentation against shipped policy/source and decisions, not deployment or transport measurement.

A-16204 local typecheck/static/wording/lint reports are supplemental; its publication says final lint pending, while the request reports later completion. No queued run exists at this head yet, so no suite pass/coverage/timing claimed. After clear source, run required mode-free verification at unchanged head; affected after-stage QA remains separate. Reviewer used source/log reads only, no tests/typecheck/browser/probes, no edits/merges.
A-16206: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16206-t-1602-source-review-of-host-adr-amendments.md

Criteria: C1 verified, C2 verified, C3 verified.
