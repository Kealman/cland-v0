---
id: T-157
kind: task
title: "The criteria gate: cland merge refuses until every criterion is done and verified and names them; ready waits for the same; in-flight items are not stranded"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-112
blocked_by:
  - T-155
  - T-156
topic: topic-87
branch: t/T-157-the-criteria-gate-cland-merge-refuses
created: 2026-10-10T07:49:36.269Z
updated: 2026-10-10T15:08:11.848Z
---

## Parent

T-112 (Criteria that live), slice 4 of 5. Spec §3.4 (The merge gate), §3.2 (ready).

## What to build

`cland merge` refuses while any criterion is not done, or not verified by at least one verdict, and names those criteria. `ready` waits for the same. An item with no criteria passes this check. Items already in flight when this lands are not stranded: a legacy section with no ids reads as unmarked criteria, so the gate refuses; the refusal says how to mark them (Implementer marks done, a verdict with `--verified`).

## Acceptance criteria

- [ ] `cland merge T-n` refuses while a criterion is not done or not verified, naming each; it accepts once all are done and verified.
- [ ] `ready` waits for the same condition.
- [ ] An item with no criteria passes the criteria check.
- [ ] The refusal names the path forward for a legacy section; a frame-protocol test covers an in-flight legacy item reaching merge.
- [ ] `docs/review-and-qa.md` and `hub/README.md` describe the gate.
- [ ] `npm run typecheck && npm test` pass.

## Blocked by

- T-155 (Marks the hub writes)
- T-156 (Verdicts verify)

## Comments

### impl-157 · 2026-10-10T14:26:24.661Z

Using the epic’s pre-agreed frame-protocol seam: merge CLI/UI plus MCP criterion/verdict writes against a real hub and temporary Git project. The shared gate evaluator currently checks verdicts only; ready has a separate failed-mark stopgap. I’ll unify criteria evaluation and prove legacy checkboxes migrate via done then a verdict with --verified.

### impl-157 · 2026-10-10T14:32:22.667Z

Implementation committed and pushed: 0405665a814259250961c5539924d8203082d5ad. Shared criteria/verdict evaluation drives merge and automatic ready; criteria-incomplete lists missing done/verified marks and the legacy migration path. Frame-protocol tests cover legacy migration, partial marks, empty criteria, separate verification and ready invalidation/recovery. Typecheck and targeted tests pass; own full suite running. Implementation Standards/Spec reviews both clear (A-628). Live hub predates task.criterion; Coordinator confirmed the planned restart is after T-142 and T-157 land, so done marks must wait for that restart.

### rev-9 · 2026-10-10T14:35:38.072Z

verdict: review
result: not clear
by: rev-9 [reviewer]
run: rev-2026-10-10-157-1
commit: 0405665a814259250961c5539924d8203082d5ad

Medium — hub/README.md:511 (also hub/src/cli/merge.ts:6): override is still documented as skipping only verdicts; the Coordinator's topic-87 decision requires explicitly documenting the human-only override as skipping both verdicts and criteria.

Medium — hub/src/hub/merge.ts:157: successful merge/resume records only the override reason; neither that log, the receipt at125 nor item comment at160 records the unmet criterion identifiers/text/missing marks skipped. Add the required audit snapshot and preserve it through recovery.

The override itself is authorized and is not a finding (Coordinator decision3d124d4d-2fb3-4744-9803-195dee2d1365). Standards:0 findings; Spec:2 medium decision gaps. Normal shared merge/ready evaluator, no-criteria pass, legacy done/id assignment/verdict migration and mark-change ready revalidation are clear. Reviewer parser/evaluator memory probe passes these cases; diff check passes. Full suite separately running; no edits or real tests. Evidence A-631: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-631-t-157-review-override-documentation-and-skipped-criteria-audit-missing.md.

### impl-157 · 2026-10-10T14:36:56.162Z

Addressed rev-9’s two override findings in 8ff4036a231804d5e510a9550c8f9e9e0c1ea001, pushed to origin. Human --override explicitly skips verdicts and criteria in docs and CLI help; merge validation logs each skipped incomplete criterion’s id/text/missing marks and the override reason as merge-criteria-overridden in the journal. Targeted override test and typecheck pass. Stopped the earlier pre-follow-up full run intentionally; a fresh full suite on final head is running.

### rev-9 · 2026-10-10T14:40:08.364Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-157-2
commit: 8ff4036a231804d5e510a9550c8f9e9e0c1ea001

No high or medium findings remain. Standards: clear. Spec: clear.

Both A-631 findings are resolved: docs/help explicitly describe the human override of verdicts and criteria, and merge validation journals the skipped criteria ids/text/missing marks and override reason before Git preparation. The shared evaluator preserves ordinary merge/ready refusal, failed-criterion handling, empty criteria and legacy migration.

Review evidence and limits: A-633, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-633-t-157-review-override-documentation-and-criteria-audit-clear.md. Pinned source/diff, parallel Standards/Spec reviews, disk-free production-source probe and diff check; no edits. Coordinator's final full suite remains pending.

### coord · 2026-10-10T15:08:11.848Z

Merged d3fb7613e37b24c6322a5822e7d17666da8e91a2 onto dev.
