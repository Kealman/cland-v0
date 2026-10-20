---
id: T-944
kind: task
title: Codex launches of OpenCode-default roles lose their inherited approval and permissions (T-821 regression)
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-617
blocked_by: []
regression_of: T-821
found_by: cover
topic: topic-705
branch: t/T-944-codex-launches-of-opencode-default-roles
created: 2026-10-20T07:35:44.533Z
updated: 2026-10-20T07:55:17.153Z
closed: 2026-10-20T07:55:17.153Z
---

## Summary

The periodic dev T3 run 3998189d at eaa11b6 (A-7200) failed `hub/test/codex-adapter.test.ts:417` "Codex launches Implementer and QA with full access…" at :460. The Implementer launched on Codex got `{ approvalPolicy: 'never' }` without `permissions: ':danger-full-access'`. T-821 (e1abb0e7) stopped OpenCode roles inheriting approval, sandbox and permissions, but it decided by the role's configured default harness rather than the harness the session actually launches on. The built-in Implementer defaults to OpenCode, so a Codex launch of it lost its inherited policy. The test's own comment states the rule: approval and sandbox belong to the role, not to its default harness. T3 tests don't run in T1-only batches (D67), so the regression landed.

## Acceptance criteria

- [x] C1. Policy inheritance is resolved against the harness of the actual launch: a role launched on Codex or Claude Code gets its inherited approval, sandbox and permissions whatever its default harness, and only a launch on OpenCode drops them (T-821's rule).
  - done: impl-944 · 2026-10-20T07:41:06.175Z
  - verified: rev-31 [reviewer] · run rev-20261020-944-source · 2026-10-20T07:43:46.445Z · commit da346ecc8fa7fbd6d847ea7221537ddc8012cf10
  - verified: rev-31 [reviewer] · run rev-20261020-944-final · 2026-10-20T07:51:12.449Z · commit da346ecc8fa7fbd6d847ea7221537ddc8012cf10
- [x] C2. codex-adapter.test.ts passes whole on the fix head, and T-821's OpenCode policy tests still pass; the evidence names both.
  - done: impl-944 · 2026-10-20T07:41:06.893Z
  - verified: rev-31 [reviewer] · run rev-20261020-944-final · 2026-10-20T07:51:12.449Z · commit da346ecc8fa7fbd6d847ea7221537ddc8012cf10
- [x] C3. A mode-free `cland verify` at the reviewed head is green, plus a T3 run of codex-adapter.test.ts (it is T3, so name its receipt).
  - done: impl-944 · 2026-10-20T07:50:37.337Z
  - verified: rev-31 [reviewer] · run rev-20261020-944-final · 2026-10-20T07:51:12.449Z · commit da346ecc8fa7fbd6d847ea7221537ddc8012cf10

## Comments

### impl-944 · 2026-10-20T07:39:57.219Z

Reproduced T3 codex-adapter.ts:460 missing :danger-full-access before fix; new T2 launch/relaunch cross-harness matrix also failed before fix. Parser now retains OpenCode-default ignored policy inputs for actual non-OpenCode launches, leaving native OpenCode snapshots/warnings unchanged; Sessions resolves both spawn and resume against actual harness. Local targeted files run sequentially: codex-adapter 12/12, opencode-policy 2/2, opencode-launch-policy 4/4, roles-launch-permissions 6/6, roles-snapshot 11/11, adapter-composition 4/4. Typecheck passes; report-only test lint exits 0 (131 existing findings, changed files correctly tiered). origin/dev fetched/merged, already up to date. Source review and mode-free gate still pending. No merge enqueued.

### impl-944 · 2026-10-20T07:41:14.004Z

Committed/pushed da346ecc8fa7fbd6d847ea7221537ddc8012cf10. A-7204 is the exact-head local T3 Codex + OpenCode policy and all targeted receipts (44/44); A-7205 is implementation/source review brief. C1/C2 marked done. First source review requested with role routing; hub queued it waiting for next free live verifier and will assign automatically, so no duplicate request. C3 awaits that source verdict and mode-free verification.

### rev-31 · 2026-10-20T07:43:46.445Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-944-source
commit: da346ecc8fa7fbd6d847ea7221537ddc8012cf10
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7208: full Standards/Spec source clear. Actual harness now governs spawn and both resume policy paths; retained raw OpenCode-default policy restores Codex/Claude inheritance/explicit values while OpenCode snapshots/warnings remain native. Omitted/empty/invalid cases and 18-combination spawn/relaunch coverage reviewed. A-7204 whole T3 Codex 12/12 plus OpenCode/other targets (44 total) read. C1 verified; C2/C3 await exact-head mode-free gate with explicit T3 proof retained.

Criteria: C1 verified.

### impl-944 · 2026-10-20T07:44:18.108Z

Reviewer source clear at unchanged da346ecc8fa7fbd6d847ea7221537ddc8012cf10, A-7208 / rev-20261020-944-source; C1 verified. Mode-free verify submitted with --report topic-705 --to rev-31 --to impl-944, admitted by hub as 412b7cfe-bc8f-431b-a6bb-fc0fe75e4323. CLI submission acknowledgment timed out after 15s (exit75) but hub explicitly admitted the run; no duplicate submission. Awaiting result. No head change or dev merge after source review.

### impl-944 · 2026-10-20T07:50:51.697Z

C3 done: same reviewed head da346ecc8fa7fbd6d847ea7221537ddc8012cf10 passed mode-free verification 412b7cfe-bc8f-431b-a6bb-fc0fe75e4323, raw receipt A-7214. 1946/1946 pass, zero fail/cancel/skip, T1 plus fallback all T2 across hub/Neovim. Both new identities have actual 5/5 load-gate passes (10 distinct repeats). Explicit T3 codex-adapter whole 12/12 at exact head is A-7204, alongside T-821 OpenCode policy 2/2 and launch-policy 4/4; broader T3 is deferred to periodic/integrated occasions, absent from configured batch tiers. Executor Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5; droplet c-8 lon1, lifetime346s, cost$0.0240. Typecheck was host-gate cached at 4469fd0; local exact-source typecheck also passed before commit. Clean unchanged head, no dev merge, no merge enqueue. Awaiting Reviewer final evidence verdict and hub readiness.

### rev-31 · 2026-10-20T07:51:12.449Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-944-final
commit: da346ecc8fa7fbd6d847ea7221537ddc8012cf10
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7216: exact-head A-7214/412b7cfe audited: 1946 ordinary passes plus both new identities 5/5 (10 distinct repetitions), existing OpenCode policy files 2/2 and 4/4, no resource/duration violations. C1–C3 verified with source A-7208 and explicit whole macOS T3 Codex 12/12 A-7204; Linux T3 not claimed. All claimant done marks present.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T07:55:17.153Z

Merged de9096a3e1cefab329502892282daf005c2127e8 onto dev.
