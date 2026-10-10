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
updated: 2026-10-10T00:55:27.547Z
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

### rev-6 · 2026-10-10T00:26:57.161Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-121-1
commit: 9c28896d3b6a5eafe166826c4ecace28e6621fb8

High — hub/src/tracker/tracker.ts:1263: adoption publishes the alias mapping before SQLite commits. If adoption fails, a new verdict uses rev-id while its Implementer claim remains name:rev; gate-verdicts.ts:13 accepts the self-review and ready is written. A pinned SQLite :memory: probe injecting one SQLITE_BUSY confirms this. Fence unresolved adoption and preserve authoritative claimant/writer identity comparison. Coordinator accepted the finding and requested the fix.

No other high or medium findings remain across the full 7e3797d..9c28896 range. Standards are clear. A-283 timing/hold identity, A-284 lost edit and A-287 crash recovery are resolved. Normal hold verdict/release, edited-evidence refusal and pre-hello self-review refusal probes pass. Typecheck and diff check pass; no suite run.

Default Reviewer/QA Work clauses are at hub/src/roles/default-roles.ts:106/:132 (grants :122/:149). Project activation points are .cland/roles.toml:100/:126 (grants :116/:143), still the existing pre-T-121 clauses pending Coordinator activation.

Full evidence A-300: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-300-t-121-full-review-rev-6-121-1-at-9c28896.md. Exact fault probe A-299.

### impl-121 · 2026-10-10T00:29:32.690Z

A-299 partial-failure fix committed at b1e7e2f44512be0fd0f5e83c4648f3e6387efab4. Alias publication now follows atomic adoption commit; failed adoption fences and retries before verdict/claim/hold admission. Shared gate/ready evidence compares authoritative hub identities. SQLITE_BUSY rollback/fence/retry regression passes with no ready event and continued self-review refusal; typecheck passes. Full suite queued on this head behind Coordinator's T-119 suite.

### rev-6 · 2026-10-10T00:33:35.230Z

verdict: review
result: not clear
by: rev-6 [reviewer]
run: rev-6-121-2
commit: b1e7e2f44512be0fd0f5e83c4648f3e6387efab4

Medium — hub/src/tracker/tracker.ts:1289: pending adoption is memory-only; after failed adoption and restart, a stored-real-ID CLI actor can successfully release/write a verdict while its durable name:rev hold remains, and its own claim release is refused. Recover adoption from durable mapping or reconcile it at admission, before a new hello.

The prior High is resolved: alias publication follows commit, failed adoption fences verdict/hold/claim work, retry is atomic, and the authoritative gate keeps self-review refused. No other High/Medium remains. Standards clear; Spec not clear. Hub typecheck and diff --check pass; no suite run. Reproductions: A-302 (.cland/artifacts/A-302-t-121-b1e7e2f-adoption-failure-and-restart-probe.md). Full review: A-303 (.cland/artifacts/A-303-t-121-full-review-rev-6-121-2-at-b1e7e2f.md).

### rev-6 · 2026-10-10T00:40:28.412Z

verdict: review
result: clear
by: rev-6 [reviewer]
run: rev-6-121-3
commit: 29dd607ca9ae666a3d0d6b2514b845b25edb313f

No High, Medium or Low findings remain across 7e3797d..29dd607. Standards clear; Spec clear.

A-299 self-review safety, A-302 restart recovery and legacy NULL claim recovery are resolved: persistent SQLite failure fences verdict/hold/claim work; successful retry atomically adopts durable identities and restores both hold release paths and own claim release. Authoritative ownership comparison refuses a different session ID with a matching display name; self-review remains review-claimant.

Hub typecheck and diff --check pass; pinned restart, persistent-failure and isolated legacy memory probes pass. No suite run. Evidence: A-307 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-307-t-121-d2d4b69-restart-recovery-review-evidence.md), and A-310 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-310-t-121-full-review-rev-6-121-3-at-29dd607.md). Default Reviewer/QA clauses: hub/src/roles/default-roles.ts:106/:132, grants :122/:149; project activation locations .cland/roles.toml:100/:126, grants :116/:143.

### impl-121 · 2026-10-10T00:55:27.547Z

Cancelled the queued full suite on 29dd607 before lock acquisition, at Coordinator request. Awaiting T-119 landing; will rebase once onto origin/dev and run adoption, gate, ready and levels regressions before queuing the final suite.
