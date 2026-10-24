---
id: T-422
kind: task
title: Tests register temporary projects in the real host executor ledger
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-936
branch: t/T-422-tests-register-temporary-projects-in-the
created: 2026-10-14T16:43:00.822Z
updated: 2026-10-24T08:00:19.343Z
---

## Summary

The host-wide executor ledger `~/.cland/executor/spend.json` lists 24 projects. Most are temporary test projects (`$TMPDIR/cland-proj-*`, `cland-t347-real-*`, `/private/tmp/q384-*`), and one entry is `/`. Every sweep reads leases from every listed project (`hostLeases`, `hub/src/executor/droplet/spend.ts:62`). So tests leak into the human's real ledger, and the list only grows. This was read on 2026-10-14 16:42Z while answering E-271 QA.

## What to fix

- Tests that touch the executor point the ledger at a scratch path, never the real `~/.cland`.
- `rememberProject` refuses `/` and other non-project roots.
- The sweep drops a registered project whose directory no longer exists, after a grace period, instead of reading it forever.

## Acceptance criteria

- [x] C1. A full suite run leaves `~/.cland/executor/spend.json` `projects` unchanged.
  - done: impl-422 · 2026-10-24T07:59:41.843Z
- [x] C2. `rememberProject('/')` is refused, and the ledger never lists `/`.
  - done: impl-422 · 2026-10-24T07:53:42.861Z
- [x] C3. A registered project whose directory is gone is pruned from `projects` by the sweep, with an event naming it.
  - done: impl-422 · 2026-10-24T07:53:42.964Z

## Comments

### impl-422 · 2026-10-24T07:45:54.788Z

TDD receipts on local macOS working tree: C2 failed accepting `/`, then passed with pre-write validation. C3 failed retaining missing project after 24h, then passed with persisted grace/reset, write-through prune event, accounting preserved. C1 suiteUnit partial options.env reproduced writes to both primary and legacy ledgers under a hostile scratch HOME; sealed env layered after options fixes it. projectHub hostile scratch HOME/XDG/override snapshot also passes. No real HOME state modified.

### rev-32 · 2026-10-24T07:57:49.349Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-422-source
commit: 5ae37b6b50860c1ab9037a83e5257f824cff8aff
scope: full
findings: [{"severity":"medium","text":"M1: options.env XDG_* extras overwrite fixtureEnvironment's scratch defaults; its final seal resets HOME/Git but not XDG. Force/validate final fixture-owned XDG paths and cover hostile explicit overlays, retaining accounting/snapshot assertions.","file":"hub/test/suite-unit-fixture.ts","line":101}]
finding_counts: {"high":0,"medium":1,"low":0}

T-422 full source review — not clear
Replacement head 5ae37b6b50860c1ab9037a83e5257f824cff8aff; tree 63aba510686711af83b2a20c554c60b6e1816290. Supersedes requested 8d3da20c. Fixed point 77a306bfbabdd509fd6836301dfe5aa8ca93ec4f (the dev parent of pre-review merge 2e518053); inspect git diff --no-ext-diff --no-textconv 77a306bf...5ae37b6b --. Includes original implementation, pre-review dev merge and final stopped-project/startup regression additions.

## Standards
M1 (medium), hub/test/suite-unit-fixture.ts:101–104: final fixture env is positioned after ...options, but arbitrary options.env is passed into fixtureEnvironment's extra overlay. That builder sets XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_STATE_HOME and XDG_CACHE_HOME before applying extra; its final hard seal resets HOME and Git and filters credentials, but does not reset XDG_*. Consequently explicit options.env XDG values escape the owning suiteUnit root. CLAND_EXECUTOR_STATE is correctly forced local; that does not seal the other filesystem profiles. This violates rule15 and Coordinator bc930fc5's explicit requirement that HOME/XDG_*/executor state always remain scratch-owned.
The new regression poisons ambient process.env but its options.env contains only a provider token/poll control. It does not exercise explicit XDG overlays. Force/validate the fixture-owned final XDG paths and add a hostile explicit-overlay control using only scratch sentinel directories. Retain the actual accounting completion, nonempty fixture ledger, ambient primary/legacy snapshot and override absence assertions.
No other source findings. No smell finding. Test changes otherwise use classified T1/T2 seams, fake clocks, scratch machine/HOME and injected providers/process identities. Directory renames have no live writer; close precedes cleanup/snapshots. Suite persistence reopening now retains scratch root/env. No real installer/provider operation is introduced.

## Spec
C1 remains blocked by M1. Coordinator f248e85e explicitly reconciles merge evidence to approved hostile scratch HOME/XDG/legacy regressions around real ledger activity, suiteUnit partial-env, projectHub, suite-persistence and a fresh configured mode-free task receipt. The literal full-suite real-ledger projects-count comparison is Coordinator-owned local macOS stage landing evidence, not a pre-merge condition. Do not call a T0–T2/Web task receipt a full-suite run.
C2 source looks sound: before a ledger write, rememberProject canonicalizes paths and refuses filesystem roots/HOME including aliases, missing/relative/file/non-cland paths. Valid aliases register once. Sweeps apply the same validation to invalid legacy registrations.
C3 source looks sound: missing observations persist across restarts; 24h grace resets on return; unreadable errors defer; pruning writes primary/legacy before emitting executor-project-pruned and retains entries/reservations. Tombstones exclude retained accounting roots from hostLeases scans while missing; valid returning roots rejoin projects before provider cleanup, and rememberProject removes the old marker. Last tests explicitly retain initialized projects without hub discovery/lock past48h and re-register a seeded pruned root at projectHub startup.
The docs/help/per-test notes match the registry behavior; implement skill uses its existing metadata.changes=CHANGES with the matching entry. No role grants change.

Evidence: A-10443 reports six local macOS arm64 targeted files, 58 tests, and check pass with test lint report-only/132 findings/zero refusals. Replacement request reports executor-spend20/20 and account-fixture-env5/5; final check was still running. These are supplemental summaries with working-tree provenance, not configured suite/Linux evidence; no verification has run. Preserve original tool/stdout/exits/timing with source attribution, without reruns solely for transcription. No criterion verified by this source pass; fail C1 only for M1, leave C2/C3 runtime pending. qaPolicy none/after-stage, no QA brief.
Reviewer read source/Git/docs/artifacts only, no tests, browser, edits, installer, live ledger mutation or delegation. Both review axes completed in-session.
Standards: one medium finding. Spec: C1 blocked by M1; C2/C3 source paths accepted, execution pending.
Durable audit A-10464: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10464-t-422-full-source-review-at-5ae37b6b.md

Criteria: C1 failed (suiteUnit's explicit options.env XDG_* overlays can escape the fixture-owned scratch paths; regression covers inherited environment only.).

### rev-32 · 2026-10-24T08:00:19.343Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-422-source-2
commit: 9a10dabe40bf6b4d9179d97ed09d8b8be9b936a0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-422 corrected full source review — clear
Head 9a10dabe40bf6b4d9179d97ed09d8b8be9b936a0; tree 2af3f1b903abfebf383d5b8d6a4327531cccabd9; sole parent 5ae37b6b50860c1ab9037a83e5257f824cff8aff. Three-file correction, no dev merge. Full accepted original source scope is documented in A-10464; this pass audits its complete M1 correction.

## Standards
No outstanding findings. M1 resolved: suiteUnit removes caller XDG_* option extras before fixtureEnvironment establishes the fixture's XDG paths. HOME/Git reset in the shared builder and forced local executor state remain; the sealed env still follows the final options spread. Arbitrary provider/account credentials are filtered before the explicit injected synthetic provider is restored.
Both partial and hostile explicit-path controls now assert HOME and all four XDG owners, then exercise real accounting to completion, assert nonempty fixture ledger entries, stop the writer and retain the before/after primary/legacy scratch HOME snapshot and absent inherited override assertions. Hostile paths are scratch-owned. The matching per-test note describes the final layering. No production registry/accounting source changed and no new native process/provider operation was introduced.

## Spec
No outstanding findings. C1's explicit-overlay gap is closed; other approved isolation seams (projectHub/pruned startup and suite-persistence reopening) remain unchanged. C2 validation and C3 persisted grace/pruning/restoration/accounting behavior remain accepted as reviewed in A-10464. Stopped initialized projects continue to survive without a running hub.
Coordinator f248e85e accepts the scratch-ledger proofs plus fresh configured mode-free task receipt for pre-merge C1. The real-ledger projects-count before/after a full local macOS stage cover remains Coordinator-owned landing evidence, not a pre-merge condition; no T0–T2/Web receipt will be called full-suite proof.
All C1–C3 claimant done marks are current. Execution-dependent verification remains pending the post-source configured mode-free receipt at this exact head, so no verified criterion is asserted now. qaPolicy none/after-stage, no per-item QA brief.

Supplemental request evidence: local macOS arm64 affected suite-accounting + executor-run-rules25/25 and npm run check pass, test lint report-only132 findings/59files/zero refusals. Earlier six-file59/59 remains attributed to 5ae37b6b. These are targeted/local summaries, not configured/Linux or full-suite evidence. Preserve original command/stdout/exit/timing attribution without transcription reruns.
Reviewer performed source/Git/docs reads only; no tests, probes, installs, browser, edits, live ledger changes or delegation.
Standards: 0 outstanding findings. Spec: 0 outstanding findings.
Durable audit A-10466: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10466-t-422-corrected-source-review-at-9a10dabe.md
