---
id: T-121
kind: task
title: "Ready and the verifier holds: ready when the gate's verdicts are clear, withdrawn when one goes stale; Reviewer and QA take a hold beside the Implementer's claim"
state: open
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: T-107
blocked_by:
  - T-120
topic: topic-47
branch: t/T-121-ready-and-the-verifier-holds-ready-when
created: 2026-10-09T21:56:37.696Z
updated: 2026-10-10T00:18:47.694Z
---

## Parent

T-107 (v0.1 release and status), slice 4 of 6. Spec §3.2 (The hub moves it on events, The merge gate is unchanged), decided on 2026-10-09 with T-98.

## What to build

**Verifier holds.** A Reviewer or QA does not claim. It takes a verifier hold on the item, beside the Implementer's claim and tagged with its role. A Reviewer's hold sets `review`, and QA's sets `qa`. A hold does not change the item's lead or the Implementer's claim. Holds are hub-held, like claims, and appear in `cland task view` and the `task` event. A hold is released when its holder writes a verdict, stops, or releases it.

**The gate rule.** The merge gate refuses a verdict only from the session that holds the Implementer's claim. Everything else the gate requires is unchanged.

**Ready.** When every verdict the merge gate needs is clear and current, the hub sets `ready`. That is a review always, plus QA when the item needs it. The hub decides this with the gate's own provenance and freshness rules, but off the merge path, in a check that runs after each verdict, commit and push event. When a verdict goes stale, the status returns from `ready` to `in progress`. A verdict goes stale through new commits on the branch that change the patch, per D4.

## Acceptance criteria

- [ ] A Reviewer taking a hold moves the task to `review`, and QA's hold to `qa`; the Implementer's claim and the lead are unchanged.
- [ ] A clear review on a task that needs no QA moves it to `ready`. A new commit that changes the patch on its branch moves it back to `in progress`. A rebase with an unchanged patch-id keeps `ready`.
- [ ] A task with the `qa-required` label reaches `ready` only with both verdicts clear and current.
- [ ] The gate still refuses a verdict written by the holder of the Implementer's claim. Every other gate decision is unchanged, which the existing merge tests prove.
- [ ] `ready` is computed by the same code the gate uses for provenance and freshness. A test feeds both from one fixture and checks they agree.
- [ ] The Reviewer and QA clauses in the default roles say to take a hold, not a claim. List the exact `.cland/roles.toml` lines in your report.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. Risk from the sizing: `ready` off the merge path must never disagree with the gate, so share the code and do not reimplement it (A-96, class B and E). Await checklist: re-read the branch tip and the verdicts after each await, and test a commit that lands while `ready` is being computed.

## Comments

### impl-121 · 2026-10-09T23:57:03.598Z

Implementation begun at 7e3797d. Seams confirmed by Coordinator: real hub frame protocol and merge-gate integration. Existing gate assertions remain unchanged. Ready will share the gate's provenance/freshness evaluator; holds remain hub state beside claims.

### impl-121 · 2026-10-10T00:03:40.963Z

Shared evaluator in tracker/gate-verdicts.ts now serves merge and ready. Existing merge suite passes unchanged (39/39); status protocol (11/11) and freshness (5/5) pass. Hold lifecycle and ready race tests added. Coordinator approved retaining last settled status while pending; failed/timed-out patch-id checks now settle stale, with all three outcomes under protocol coverage.

### impl-121 · 2026-10-10T00:18:47.694Z

Fix round covers pre-hello claim/hold identity adoption, one readiness continuation timing scope, bounded delayed retries with a ten-attempt pause/Agents notice and event-driven restart, and startup reconciliation of known stopped process holds. Regressions demonstrate the prior timing/retry failures and the prior crash/restart hold leak; release without a verdict preserves review/QA status as agreed.
