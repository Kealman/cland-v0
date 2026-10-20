---
id: T-957
kind: task
title: cland qa lint checks a QA brief's commands, flags, roles, check ids and cleanup paths against the build
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-727
branch: t/T-957-cland-qa-lint-checks-a-qa-brief-s
created: 2026-10-20T09:53:28.651Z
updated: 2026-10-20T10:53:41.571Z
closed: 2026-10-20T10:53:41.571Z
---

## Summary

The v0.1.4 epic demos stopped on about 25 errors in the briefs, not the product. Examples: a `topic create` the CLI does not have, a verify report sent to General, renamed helpers, duplicate check ids. These cost about 2 hours of ask round-trips. Add `cland qa lint <brief>` so the mechanical class of these errors fails before the QA request.

## What to build

`cland qa lint <brief>` extracts every `cland …` command from the brief's tables and checks that the subcommand and flags exist in the build's own help. It checks each command against the role the brief assigns: for example, an Implementer's `verify --report` must name the item's topic. It also checks that check ids are unique and surface values are valid, and that no `rm` operand is a variable. It exits non-zero with one line per finding. The `qa` skill's "write the brief" step ends on "qa lint passes at the build". This comes from retro finding 2 (A-7261) and cluster 8 of the rule batch (A-7281), which the human approved on 2026-10-20. The judgement lessons stay in BRIEF.md's "Probes that mislead".

## Acceptance criteria

- [x] C1. A brief naming a nonexistent subcommand or flag fails with the line and the command.
  - verified: rev-23 [reviewer] · run rev-20261020-957-final · 2026-10-20T10:26:32.734Z · commit 601c5001571ca6d1712ecb110ca2e9727e0d2917
  - verified: rev-23 [reviewer] · run rev-20261020-957-merge-final · 2026-10-20T10:49:42.099Z · commit 7f322d6a5f7351328067844aa38168c70b2c85cd
  - done: impl-957 · 2026-10-20T10:50:34.829Z
- [x] C2. A role-mismatched command (Implementer `verify --report general`) fails, naming the role.
  - verified: rev-23 [reviewer] · run rev-20261020-957-merge-final · 2026-10-20T10:49:42.099Z · commit 7f322d6a5f7351328067844aa38168c70b2c85cd
  - done: impl-957 · 2026-10-20T10:50:36.233Z
- [x] C3. Duplicate check ids, an invalid surface and a variable `rm` operand each fail.
  - verified: rev-23 [reviewer] · run rev-20261020-957-final · 2026-10-20T10:26:32.734Z · commit 601c5001571ca6d1712ecb110ca2e9727e0d2917
  - verified: rev-23 [reviewer] · run rev-20261020-957-merge-final · 2026-10-20T10:49:42.099Z · commit 7f322d6a5f7351328067844aa38168c70b2c85cd
  - done: impl-957 · 2026-10-20T10:50:37.834Z
- [x] C4. The committed briefs under qa/briefs/ for E-611–E-617 either pass or their findings are listed in the evidence.
  - verified: rev-23 [reviewer] · run rev-20261020-957-source-corrected · 2026-10-20T10:18:14.110Z · commit 601c5001571ca6d1712ecb110ca2e9727e0d2917
  - verified: rev-23 [reviewer] · run rev-20261020-957-final · 2026-10-20T10:26:32.734Z · commit 601c5001571ca6d1712ecb110ca2e9727e0d2917
  - verified: rev-23 [reviewer] · run rev-20261020-957-merge-source-corrected · 2026-10-20T10:39:40.395Z · commit 7f322d6a5f7351328067844aa38168c70b2c85cd
  - verified: rev-23 [reviewer] · run rev-20261020-957-merge-final · 2026-10-20T10:49:42.099Z · commit 7f322d6a5f7351328067844aa38168c70b2c85cd
  - done: impl-957 · 2026-10-20T10:50:38.904Z
- [x] C5. The qa skill and STAGE-BRIEF.md name the lint as the brief's completion criterion.
  - verified: rev-23 [reviewer] · run rev-20261020-957-source-corrected · 2026-10-20T10:18:14.110Z · commit 601c5001571ca6d1712ecb110ca2e9727e0d2917
  - verified: rev-23 [reviewer] · run rev-20261020-957-final · 2026-10-20T10:26:32.734Z · commit 601c5001571ca6d1712ecb110ca2e9727e0d2917
  - verified: rev-23 [reviewer] · run rev-20261020-957-merge-source-corrected · 2026-10-20T10:39:40.395Z · commit 7f322d6a5f7351328067844aa38168c70b2c85cd
  - verified: rev-23 [reviewer] · run rev-20261020-957-merge-final · 2026-10-20T10:49:42.099Z · commit 7f322d6a5f7351328067844aa38168c70b2c85cd
  - done: impl-957 · 2026-10-20T10:50:39.967Z

## Comments

### impl-957 · 2026-10-20T10:08:27.289Z

Implemented and pushed a0ee15c3dfdc9271d1029764c44e6ccc5e39ff4f on t/T-957-cland-qa-lint-checks-a-qa-brief-s. Offline lint uses build help + built-in role decisions; checks table commands/flags, scoped roles, ids/surfaces, variable cleanup; docs, QA skill/templates and role clauses updated. Coordinator-requested open argv help/forwarding fix included. C4 inventory: A-7357, durable /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7357-t-957-final-c4-lint-inventory-at-4cca42e9.md (17 findings, seven briefs), also committed docs/evidence/T-957-brief-lint.md. npm check exit 0 with existing test-lint report-only findings; focused T1/T2 pass. Requesting source review before same-head mode-free verify; qaPolicy none/after-stage, qaCriteria empty.

### rev-23 · 2026-10-20T10:11:00.892Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-957-source
commit: a0ee15c3dfdc9271d1029764c44e6ccc5e39ff4f
scope: full
findings: [{"severity":"medium","text":"The synopsis parser mistakes description prose for a subcommand: SUBSCRIPTIONS_USAGE begins `subscriptions  list the caller's subscriptions`, so the catalog contains only `subscriptions list` and rejects valid `cland subscriptions` / `cland subscriptions --json`. Separate synopsis tokens from description columns and cover this valid root command.","file":"hub/src/qa-lint.ts","line":22},{"severity":"medium","text":"All single-dash options are skipped. `cland task view T-957 -z` therefore passes lint although task's strict parseArgs rejects it. Validate unknown short options as well as long options, retaining declared short aliases and forwarded argv boundaries.","file":"hub/src/qa-lint.ts","line":72},{"severity":"medium","text":"Verdict detection recognizes only a separate `--verdict` token. An Implementer row with `cland task comment T-957 checked --verdict=review --result clear --scope full --run r` is treated as an ordinary own-item comment and passes, while the actual hub rejects Implementer verdicts. Derive verdict presence from the normalized option value and test equals/separate forms.","file":"hub/src/qa-lint.ts","line":100}]
finding_counts: {"high":0,"medium":3,"low":0}

Standards: 0 independent findings. Spec: 3 medium findings, detailed in A-7378 with source/control-flow counterexamples: valid bare subscriptions is rejected, task view -z is accepted despite strict CLI parsing, and Implementer --verdict=review is accepted as an ordinary own-item comment. No Reviewer runtime reproduction is claimed. C3 cleanup/id/surface checks and C5 completion docs are present; C4 records all seven historical inventories/17 findings with local static-enforce provenance. None is marked verified in this not-clear pass. Preserve forwarded Neovim argv boundaries and quote semantics when fixing catalog/option normalization. Request source review of the corrected head before any mode-free verification.

Criteria: C1 failed (Help prose is parsed as a subcommand and unknown short options pass unchecked.), C2 failed (Equals-form --verdict is treated as an ordinary comment, permitting an Implementer verdict in lint.).

### rev-23 · 2026-10-20T10:18:14.110Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-957-source-corrected
commit: 601c5001571ca6d1712ecb110ca2e9727e0d2917
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no remaining findings. A-7378's three source findings resolved: help synopsis/description separation preserves bare subscriptions, declared short aliases are catalogued and unknown short options checked without inspecting forwarded Neovim argv, and equals/separate verdict/actor options use normalized last values. Added pure public-seam regressions retain the examples and wrong-kind checks. No dev merge; 3-file correction independently checked at branch tip. C4 verified from committed seven-brief/17-finding inventory and exact-head A-7387 recheck; C5 verified from QA skill/BRIEF/STAGE-BRIEF completion rules. A-7387's T1 17/17 and T2 2/2 are targeted local Mac receipts, not a task gate; lint report-only, reachability diagnostic-only. C1–C3 remain unverified for runtime settlement; prior C1/C2 source failures are resolved. A-7406 has both axes and limits. Source clear permits one normal mode-free verify at exact 601c5001, with fresh review required after any head change.

Criteria: C4 verified, C5 verified.

### impl-957 · 2026-10-20T10:26:03.916Z

Same-reviewed-head mode-free verify bb43e73d-994c-4750-89d0-f5c4d0c8b43d is green at 601c5001571ca6d1712ecb110ca2e9727e0d2917. Runtime scope T1 plus fallback all T2, 1966/1966 passed, 0 skipped; T3 deferred to periodic dev/integrated occasions (not this receipt). Executor droplet, c-8 lon1, Linux x64, Node v24.21.0, Neovim v0.12.5; lifetime 395 s, cost $0.0274, workers 2. Host typecheck gate is named separately as 2d128b0379c575fe6b68fce8078560ca422d364e, not repeated remotely. Test-lint/budget/ratchet diagnostics are report-only (2 missing duration baselines); no enforced runtime failure. Log A-7451: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7451-suite-bb43e73d-994c-4750-89d0-f5c4d0c8b43d-auto-at-601c500.log. Awaiting the reviewer's same-head final verdict; source stays unchanged.

### rev-23 · 2026-10-20T10:26:32.734Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-957-final
commit: 601c5001571ca6d1712ecb110ca2e9727e0d2917
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining findings. Spec: no remaining findings. Exact unchanged source-clear head matches green mode-free bb43e73d/A-7451: independently counted 1966 ordinary tests and 317 files pass, no other outcomes. Actual T1/full fallback T2 across hub+Neovim completed; host check 2d128b03 not repeated remotely. All 17 pure lint and 2 CLI cases also have five distinct passing load repetitions each, establishing C1–C3 including corrected examples. C4/C5 retain committed seven-brief/17-finding inventory, A-7387 recheck and source completion docs. Test lint/missing duration baselines/T3 ratchet report-only; T3 deferred, no integration claim. Prior A-7378 source failures resolved and retained historically. A-7452 records actual platform/executor/tiers and limits. All criterion verification marks refreshed; lead still owns claimant done marks.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-957 · 2026-10-20T10:33:33.475Z

Merge batch A-7458 ran T1 only on merged dev dc0177ab/tree c380ed72 and failed 2/625 completed tests (623 pass). Actual symptoms: topic-create finding absent; pipeline test actual findings 0 vs expected 1. Coordinator identified and authorized integration with T-951's newly supported topic create. Merged origin/dev (13e652a7) in ed26492e, reproduced both pure failures and the same CLI stale-fixture failure, replaced all three invalid-command inputs/expectations with reserved no-such-command. Pushed ddb560fbb63ff3799d7ac086d585c663be2f8522; product lint code unchanged. Corrected targeted local macOS: T1 17/17, T2 2/2 functional pass; npm check exit 0. One local T2 case 2.266 s exceeds nominal budget, retained in artifact. Fresh C4 recheck same 17 findings. Requesting delta source review, then new exact-head mode-free verify. Prior green at 601c5001 does not verify this head.

### rev-23 · 2026-10-20T10:35:28.100Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261020-957-merge-source
commit: ddb560fbb63ff3799d7ac086d585c663be2f8522
scope: delta
findings: [{"severity":"medium","text":"After adopting T-951, an Implementer `cland topic create hello` passes lint without --item: the generic args[2] mapping treats the title `hello` as a nonempty item and own() is assumed true. The real CLI takes item only from --item, so the hub rejects that unbound request. Map topic.create item from normalized --item; cover missing/empty and valid item forms without claiming live ownership checks.","file":"hub/src/qa-lint.ts","line":101}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards: no independent findings. Spec: one medium new integration finding at qa-lint.ts:101. Dev/T-951 makes topic create syntactically valid; generic item=args[2] now interprets title as item and assumed own() lets an Implementer omit --item. Actual CLI maps item only from flag and hub refuses unbound Implementer creation. Normalize --item for this tool; cover missing/empty/valid forms while retaining documented live-ownership limit. Source counterexample only, no Reviewer execution. Stale-negative-fixture replacement otherwise preserves checks; A-7469 accurately retains A-7458 red T1 and local2.266s timing exceedance. Prior green at601c5001 not new-head evidence. A-7474 records merge comparisons and limits. C2 failed; fresh source review before verification.

Criteria: C2 failed (New topic create role mapping treats its title as item, allowing an Implementer command without required --item binding in lint.).

### rev-23 · 2026-10-20T10:39:40.395Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-957-merge-source-corrected
commit: 7f322d6a5f7351328067844aa38168c70b2c85cd
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: no remaining findings. A-7474 resolved: topic.create maps only normalized --item, with missing/empty/whitespace/option-looking/post-- bindings rejected through shared own-item decision; valid separate/equals/last-value forms retain pass coverage. Live ownership remains out of scope. Reserved invalid-command fixtures and earlier diagnostic/role/cleanup assertions retained. Matching docs updated. Clause-only follow-up points to QA skill without changing its lint-pass completion rule; final clause checks retained. C4/C5 refreshed using committed seven-brief inventory/A-7489 recheck and skill/templates. A-7489 labels implementation2bfa96b3 local targeted18/18+2/2 separately from final clause/check head; lint report-only/reachability diagnostic-only. Prior2.266s sample and old-head green retained historically. C1–C3 await new exact-head normal gate. A-7495 has complete delta/evidence limits. No Reviewer execution.

Criteria: C4 verified, C5 verified.

### impl-957 · 2026-10-20T10:47:38.455Z

New exact-reviewed-head mode-free verify 15caff87-a548-4f89-a08e-dcd0c442c078 is green at 7f322d6a5f7351328067844aa38168c70b2c85cd. Report: 2028/2028 tests passed, 0 skips; actual scope T1 plus fallback all T2 in hub and Neovim. T3 deferred to periodic dev/integrated occasions, not this receipt. Linux x64 droplet c-8 lon1, Node v24.21.0/Neovim v0.12.5, lifetime 397 s, cost $0.0276, workers 2. Host typecheck gate a6826c2351460d821fa55ddc86fcc3a49ecece7b named separately, not repeated remotely. Test lint/missing baselines/T3 ratchet are report-only; duration regression diagnostics retained in log. A-7510: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7510-suite-15caff87-a548-4f89-a08e-dcd0c442c078-auto-at-7f322d6.log. Source clean and unchanged; waiting for final reviewer criterion refresh.

### rev-23 · 2026-10-20T10:49:42.099Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-957-merge-final
commit: 7f322d6a5f7351328067844aa38168c70b2c85cd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no remaining findings. A-7521 audits exact-head A-7510/run 15caff87: 2028/2028 ordinary tests; 18 pure and 2 CLI lint identities each pass 5/5 load repetitions, including topic.create item binding. C1-C3 now established at the corrected head; C4's seven-brief/17-finding inventory and C5's required skill preflight retained from A-7495. Historical merged-dev red A-7458 and corrected C2 finding/red proof retained. Linux T1/all-T2 fallback includes Neovim; T3/T4 deferred. Host check a6826c23 recorded, not repeated. Existing lint/budgets/ratchet report-only, seven missing baselines/incomplete timing not claimed passes.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-20T10:53:41.571Z

Merged f7ea597142f8f34e857d0f726fca06b77686ed5f onto dev.
