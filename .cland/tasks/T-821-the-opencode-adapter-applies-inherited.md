---
id: T-821
kind: task
title: The OpenCode adapter applies inherited approval and sandbox, but OpenCode roles should keep OpenCode's own settings
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-698
branch: t/T-821-the-opencode-adapter-applies-inherited
created: 2026-10-18T22:17:53.909Z
updated: 2026-10-20T07:04:51.723Z
closed: 2026-10-20T07:04:51.723Z
---

## Summary

Spec v0.1.4 §3.5 says OpenCode roles keep OpenCode's own permission settings. Since T-637, the generated roles.toml leaves `permissions`, `approval` and `sandbox` off OpenCode roles. But parseRoles still fills missing policy keys from the shipped role defaults, and the OpenCode adapter consumes them. So an OpenCode Implementer resolves `approval = never` with the inherited sandbox instead of OpenCode's own settings.

## Acceptance criteria

- [x] C1. A role launched on opencode passes no approval or sandbox setting to OpenCode, whether the key is inherited or written explicitly; OpenCode's own configuration governs. A launch-frame test shows the OpenCode argv and env carry none.
  - done: impl-821 · 2026-10-20T06:30:36.903Z
  - verified: rev-31 [reviewer] · run rev-20261020-821-final · 2026-10-20T06:37:59.088Z · commit 33a58785c561c0ea7b7ba1b00f079258f0a3f796
- [x] C2. Roles on claude-code and codex resolve their inherited policy exactly as before (regression test), and `cland role list` shows "OpenCode's own" for an OpenCode role's guard.
  - done: impl-821 · 2026-10-20T06:12:31.841Z
  - verified: rev-31 [reviewer] · run rev-20261020-821-final · 2026-10-20T06:37:59.088Z · commit 33a58785c561c0ea7b7ba1b00f079258f0a3f796

## Comments

### impl-821 · 2026-10-20T06:09:03.223Z

Confirmed scope with supervising Lead/Coordinator: ignore OpenCode approval, sandbox and permissions (inherited and explicit); T-637 and default header define no OpenCode policy keys. Preserve D8 item worktree confinement. Add explicit-key warning in validation snapshot and role list. Claude Code/Codex inheritance remains compatible. Requested test seams: OpenCode adapter launch/frame and role snapshots, pure policy/parser at T1. No merge queued.

### impl-821 · 2026-10-20T06:12:32.545Z

Implemented and pushed ad918b2b55ba3f852cb6ed94a1dcb3e85cb90cd5. A-7133 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7133-t-821-implementation-and-focused-validation.md) records scope, changes and 61 focused passing tests, typecheck, report-only lint. origin/dev merge before first review was already up to date. QA policy none/per-item and no QA criteria/brief; source review only. No merge queued.

### rev-31 · 2026-10-20T06:23:43.074Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-821-source
commit: ad918b2b55ba3f852cb6ed94a1dcb3e85cb90cd5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7151: full Standards/Spec source review clear. OpenCode inherited/explicit policy is ignored while D8 confinement remains; historical built-in policy preserves Codex/Claude inheritance. Explicit ignored keys warn once per role in snapshots/reload/list and list names OpenCode's own guard. C1/C2 runtime evidence remains pending exact-head mode-free verification, including new identities' actual 5/5 receipts. No merge authorization.

### impl-821 · 2026-10-20T06:30:16.288Z

First mode-free Linux receipt 4f9d19b9/A-7159 red at ad918b2b: only fake-harness.test.ts lifecycle test line38 expected approval never for OpenCode. Local targeted repro confirmed; one-line task-owned carrier correction at pushed 33a58785c561c0ea7b7ba1b00f079258f0a3f796 asserts OpenCode undefined and Claude/Codex never, preserving all lifecycle/delivery assertions. Full file 6/6 and typecheck pass; A-7161 records details and all seven actual task-new 5/5 load passes from A-7159. No dev merge after source review. Fresh source review requested before replacement verify; no merge queued.

### rev-31 · 2026-10-20T06:30:26.345Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-821-runtime
commit: ad918b2b55ba3f852cb6ed94a1dcb3e85cb90cd5
scope: evidence
findings: [{"severity":"medium","text":"Cross-flavour lifecycle carrier still expects approval never for OpenCode; raw gate fails with undefined vs never under the intended native-policy behavior.","file":"hub/test/fake-harness.test.ts","line":38}]
finding_counts: {"high":0,"medium":1,"low":0}

A-7162: failed A-7159/4f9d19b9 cannot clear. 1665 ordinary passes/1 failure plus seven owned identities 5/5 (35 distinct passes), zero resource/duration diagnostics. Failure owned and independently reproduced by claimant. C2 remains unverified. Corrected head needs new source review.

Criteria: C1 failed (Mode-free gate fails the stale OpenCode approval carrier at fake-harness.test.ts:38; replacement source/gate required.).

### rev-31 · 2026-10-20T06:30:42.848Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-821-source-corrected
commit: 33a58785c561c0ea7b7ba1b00f079258f0a3f796
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7163: revised source clear. Sole correction makes fake-harness approval assertion flavour-aware, preserving never for Claude/Codex and all lifecycle/delivery controls. Full source A-7151 still applies. C1/C2 require wholly green replacement exact-head mode-free evidence; failed-parent gate remains historical.

### impl-821 · 2026-10-20T06:37:50.201Z

Exact reviewed head 33a58785c561c0ea7b7ba1b00f079258f0a3f796 passed mode-free replacement verification 89f8a531-7b59-4c65-96f7-56fe9173b2ea, raw A-7167. 1929 tests, 1929 pass, zero fail/cancel/skip; T1 and all fallback T2 across hub/Neovim green. All seven task-new identities have actual 5/5 receipts. Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5; droplet c-8 lon1, lifetime373s, cost$0.0259. T3 deferred to periodic dev and integrated occasions under configured T1-only batches, not claimed as executed. Failed parent receipt A-7159 and carrier fix A-7161 remain disclosed. No source change or dev merge; awaiting Reviewer final evidence verdict and hub readiness. No merge queued.

### rev-31 · 2026-10-20T06:37:59.088Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-821-final
commit: 33a58785c561c0ea7b7ba1b00f079258f0a3f796
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7168: full corrected-head A-7167/89f8a531 audited: 1929 ordinary passes plus all seven new identities 5/5 (35 distinct repeats), corrected carrier pass and no resource/duration failures. C1/C2 verified with A-7151/A-7163; claimant done marks present. Prior failed-parent evidence retained; no merge authorization.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T07:04:51.723Z

Merged e1abb0e71a6a8b2bb400d67af748f5deab0ff388 onto dev.
