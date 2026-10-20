---
id: T-957
kind: task
title: cland qa lint checks a QA brief's commands, flags, roles, check ids and cleanup paths against the build
state: open
status: review
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
updated: 2026-10-20T10:13:40.241Z
---

## Summary

The v0.1.4 epic demos stopped on about 25 errors in the briefs, not the product. Examples: a `topic create` the CLI does not have, a verify report sent to General, renamed helpers, duplicate check ids. These cost about 2 hours of ask round-trips. Add `cland qa lint <brief>` so the mechanical class of these errors fails before the QA request.

## What to build

`cland qa lint <brief>` extracts every `cland …` command from the brief's tables and checks that the subcommand and flags exist in the build's own help. It checks each command against the role the brief assigns: for example, an Implementer's `verify --report` must name the item's topic. It also checks that check ids are unique and surface values are valid, and that no `rm` operand is a variable. It exits non-zero with one line per finding. The `qa` skill's "write the brief" step ends on "qa lint passes at the build". This comes from retro finding 2 (A-7261) and cluster 8 of the rule batch (A-7281), which the human approved on 2026-10-20. The judgement lessons stay in BRIEF.md's "Probes that mislead".

## Acceptance criteria

- [ ] C1. A brief naming a nonexistent subcommand or flag fails with the line and the command.
  - failed: rev-23 [reviewer] · 2026-10-20T10:11:00.892Z · note Help prose is parsed as a subcommand and unknown short options pass unchecked.
- [ ] C2. A role-mismatched command (Implementer `verify --report general`) fails, naming the role.
  - failed: rev-23 [reviewer] · 2026-10-20T10:11:00.892Z · note Equals-form --verdict is treated as an ordinary comment, permitting an Implementer verdict in lint.
- [ ] C3. Duplicate check ids, an invalid surface and a variable `rm` operand each fail.
- [ ] C4. The committed briefs under qa/briefs/ for E-611–E-617 either pass or their findings are listed in the evidence.
- [ ] C5. The qa skill and STAGE-BRIEF.md name the lint as the brief's completion criterion.

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
