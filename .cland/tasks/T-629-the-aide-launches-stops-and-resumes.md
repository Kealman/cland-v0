---
id: T-629
kind: task
title: The Aide launches, stops and resumes sessions of any role on the human's word
state: open
status: review
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - hub
assignee: null
parent: E-611
blocked_by: []
topic: topic-388
branch: t/T-629-the-aide-launches-stops-and-resumes
created: 2026-10-16T16:04:11.671Z
updated: 2026-10-16T16:14:39.570Z
---

## Summary

The Aide's fixed tool boundary and its default grants gain `session.launch`, `session.stop` and `session.resume` for any role, the Coordinator and Leads included, from its spoke tool and from `cland` in its shell. Its clause limits these to the human's word and leaves the crew's staffing to the Coordinator during a build; every other role keeps its refusals (spec v0.1.4 §3.5, amending v0.1 §3.3).

## What to build

In both live onboarding runs (Q-596) the Aide could not start the Coordinator: the hub's Aide rule refused `session.launch` from its tool, and since a `cland` call from a session's shell is checked as that session's own (prototype/onboarding 36c09717), `cland session launch`, `stop` and `resume` in its terminal were refused too. After this ticket:

- The permission table's fixed Aide boundary admits the three session tools, and the Aide's built-in grant list and the shipped `[aide.permissions] tools` list name them. Grants stay hub permissions (ADR 0001), never a harness setting.
- The rule that only the Coordinator launches Leads admits an Aide as well; an Aide may stop and resume any session, the Coordinator's included.
- From the Aide's shell, `cland session launch`, `cland session stop` and `cland session resume` are decided by the table as the Aide's own calls and audited as the Aide; nothing in them is the human's alone any more for an Aide.
- A refusal of a tool still outside the Aide's boundary names the new boundary (tracker, artifacts, named sends, topics, history, who, status, and sessions on the human's word).
- The shipped Aide clause drops launching, stopping and resuming from what it cannot do and says: on the human's word it launches, stops and resumes sessions of any role, the Coordinator first of all, with `session.launch` or `cland session launch | stop | resume` from its shell; it says what it will launch before doing it; during a build the Coordinator keeps the crew's staffing, so the Aide launches only when the human asks. It still never asks, resolves, merges, hands over, releases or syncs.
- The hub README's Aide section and permission table say the same.

Existing projects, whose `roles.toml` lists the Aide's tools explicitly, get the grants through the one-time migration ticket, not here. A running Aide gets new tools only after a hub restart and its relaunch (role tools are fixed at launch).

## Acceptance criteria

- [x] C1. An Aide launches a Coordinator through its `session.launch` tool in a scratch project with the fake harnesses, in a new frame-protocol test.
  - done: impl-629 · 2026-10-16T16:11:18.178Z
- [x] C2. In the same test the Aide launches an Implementer with `cland session launch` from its shell, then stops and resumes it with `cland session stop` and `cland session resume`, each audited as the Aide.
  - done: impl-629 · 2026-10-16T16:11:18.531Z
- [x] C3. An Aide may launch a Lead and stop the Coordinator, while an Implementer, Reviewer and QA are still refused `session.launch`, `session.stop` and `session.resume` from their tools and their shells (permission tests).
  - done: impl-629 · 2026-10-16T16:11:18.820Z
- [x] C4. A Lead keeps its subtree limits and its refusal of `session.resume`, and an Aide is still refused `merge`, `ask`, `resolve`, `role.handover`, `release` and `sync` even when its roles.toml list grants them (existing permission tests extended).
  - done: impl-629 · 2026-10-16T16:11:19.172Z
- [x] C5. The shipped Aide clause says it launches, stops and resumes sessions only on the human's word and that the Coordinator keeps the staffing during a build, and no longer lists those three among what it cannot do.
  - done: impl-629 · 2026-10-16T16:11:19.454Z
  - verified: rev-30 [reviewer] · run rev-20261016-629-source · 2026-10-16T16:14:39.570Z · commit 4b423f2d51ef80bee6598d36356ed702b7adff4b
- [x] C6. The hub README's Aide section and permission table list the three grants and the limit to the human's word.
  - done: impl-629 · 2026-10-16T16:11:19.811Z
  - verified: rev-30 [reviewer] · run rev-20261016-629-source · 2026-10-16T16:14:39.570Z · commit 4b423f2d51ef80bee6598d36356ed702b7adff4b

## Comments

### impl-629 · 2026-10-16T16:05:28.718Z

Implementation started. Read E-611 Coordinator decisions (2026-10-16). Testing at the specified frame-protocol seam with fake harnesses and session-identity CLI calls; existing project migration is out of scope (T-636).

### impl-629 · 2026-10-16T16:11:20.096Z

Implemented and pushed 4b423f2d51ef80bee6598d36356ed702b7adff4b. Evidence A-3974: npm run typecheck at committed head exits 0; targeted files aide (8), permissions (6), lead-launch (5), lead-permissions (5) all green; final lifecycle focused rerun green. New slow-test allowance and renamed timing recorded; shard lint passes. Merged origin/dev before first review. Source review next; inherited QA policy none/after-stage requires no per-item QA.

### rev-30 · 2026-10-16T16:14:39.570Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-629-source
commit: 4b423f2d51ef80bee6598d36356ed702b7adff4b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-629 source review

Commit 4b423f2d51ef80bee6598d36356ed702b7adff4b; fixed point 5d086cfef2dbb3e52d74f7bf5a9fc3593f2d411b. Local and origin task tips agree. Eight files reviewed against T-629, v0.1.4 §3.5 and the existing role permission seams. Both review axes performed in-session because role delegation is disabled.

## Standards
No findings. Lifecycle authority is added to the existing fixed Aide boundary and matching built-in/shipped grants. The Lead-launch exception names only Coordinator and Aide; other permission and subtree checks are unchanged. Existing caller resolution, per-request auditing and asynchronous authorization rechecks remain in use. No harness sandbox or global/current-project role configuration is altered.

The lifecycle test uses exact native completion observations before dependent operations and flushes logs before checking complete audit rows. Existing cleanup remains hub-owned. Duration changes are limited to one reasoned new lifecycle allowance (10.418876 seconds), a renamed existing test timing preserved at 5.372664 seconds, and a reasoned allowance for that existing slow case; no unrelated baseline values change. Diff whitespace check passes.

## Spec
C1/C2 implementation: the new real-frame fake-harness test starts an Aide with a stable session identity, uses its MCP session.launch to start Coordinator and Lead, and sends commands into the fake Aide's actual inherited shell. It launches an Implementer, stops/resumes it, then stops/resumes the Coordinator. Seven lifecycle audit rows are required in order with Aide name, session id and role, distinguishing CLI calls from MCP calls. Relaunch checks preserve the worker session identity and observe new clause completion.

C3/C4 implementation: the Aide may launch Leads, including effective/preassigned roles through the existing permission input. The new permission regression checks Implementer, Reviewer and QA tool and CLI refusals with audited caller identities. Existing Lead tests retain foreign/unbound item refusals, live reparenting behavior, mixed verifier-work refusals, claim-loss refusal, and root-level resume refusal even with extra grants. Aide tests exercise the fixed boundary with KNOWN_TOOLS grants and a malicious roles.toml list; merge, ask, resolve, handover, release and sync remain outside the boundary. Named addressing restrictions remain unchanged.

C5/C6 established by source. The shipped Aide clause says lifecycle actions are on the human's word, announces launches beforehand, and leaves build staffing with the Coordinator. The old lifecycle prohibition is removed while ask/resolve/merge/handover/release/sync/push prohibitions remain. README Aide prose, permission table and session frame table reflect the three permissions and policy limit. This is a role instruction, not a new per-call human-approval token. Existing-project migration is explicitly delegated to T-636; running Aide tool refresh remains restart/relaunch dependent as specified.

## Evidence and criteria
A-3974 is summarized claimant evidence: aide 8/8, permissions 6/6, lead-launch 5/5, lead-permissions 5/5; final lifecycle correction has a focused 1/1 pass at 7.784 seconds. The note distinguishes that focused final rerun from the earlier full Aide file pass. Exact-head typecheck and duration/shard lint exit 0 are reported. It records old-code forbidden session.launch red before implementation. No raw log bundle or Reviewer execution is claimed.

Source clear, zero findings. C5/C6 source verified; C1–C4 and final runtime acceptance await normal same-head cland verify and the new tests' required repetitions. No per-item QA is required.

Standards 0 findings; Spec 0 findings.
Artifact: A-3984 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3984-t-629-source-clear-aide-lifecycle-grants-and-retained-role-boundaries.md

Criteria: C5 verified, C6 verified.
