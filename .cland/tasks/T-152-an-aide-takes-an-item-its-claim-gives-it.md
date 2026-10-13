---
id: T-152
kind: task
title: "An Aide takes an item: its claim gives it the worktree and branch, moves
  status, makes it the lead, and its work passes the same gate"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-111
blocked_by:
  - T-148
topic: topic-81
branch: t/T-152-an-aide-takes-an-item-its-claim-gives-it
created: 2026-10-10T05:33:01.124Z
updated: 2026-10-10T14:07:21.650Z
---

## Parent

T-111 (The human's own session), slice 5 of 5. Spec §3.3 (Tools, a claim is allowed).

## What to build

An Aide's claim works like an Implementer's: it gets the item's branch and worktree, its claim moves the item's status like an Implementer's (the epic's choice), `@lead T-n` resolves to it while it holds the claim, and its work goes through review and the merge gate unchanged.

## Acceptance criteria

- [ ] An Aide claims a task and gets its worktree and branch; the status moves to `in progress`.
- [ ] A Reviewer reviews its work and the merge gate treats it like an Implementer's, including the self-verdict refusal.
- [ ] `@lead T-n` resolves to the Aide while it holds the claim.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0001 (roles are hub-held state), 0004 (local git territory), 0003. Research `research/harness-surfaces` (where each adapter puts the role clause; Codex puts it in its first turn). References: `prototype/panels` ("yours" group and `␣A` in `panels.lua`, `palette.lua`), mockups `SessionsPanel.dc.html`, `Palette.dc.html`, `Thread.dc.html`; spec words win, then prototype behaviour, then mockups. The epic's choices where the spec is silent apply. Tests through the v0 seams: hub frame protocol, fake harnesses, headless Neovim; no new seams inside the hub. Instance lines (roles.toml) are listed exactly in the report; the Coordinator commits them.

## Comments

### impl-152 · 2026-10-10T11:22:42.415Z

Inspection: T-148 already makes Aide claims move status to in progress, and generic task.claim worktree provisioning plus T-141 lead routing already cover Aides. The remaining behavior gap is gate-verdicts.ts: claimant self-verdict rejection is restricted to Implementer claims. I will cover Aide claim/worktree/lead/review/merge through the agreed real-hub MCP and socket seams, and extend self-verdict rejection to Aide claims.

### rev-9 · 2026-10-10T11:31:10.932Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-152-1
commit: 764a11e354a80c71f30215ffc054662d3d0a9e6d

Clear: no high, medium or low findings. Standards and Spec both clear. hub/src/tracker/gate-verdicts.ts:13 applies exactly the existing Implementer claimant identity exclusion to Aides for review and required QA; both ready and merge use this evaluator. Shared authoritative identity normalization remains intact. Reviewer memory probe confirms own review/QA refusals and independent evidence acceptance for both roles. Inherited claim/worktree/status/lead behavior and T-141 launch ownership remain unchanged. A-579's instance lines match the defaults. Evidence A-582: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-582-t-152-aide-claimant-gate-review.md. Read-only review; diff check passes. Reported targeted/typecheck results reviewed; T-142 rebase and full suite remain separately pending. Verdict covers the pinned commit.

### impl-152 · 2026-10-10T13:55:37.757Z

Implementation is committed and pushed at 764a11e354a80c71f30215ffc054662d3d0a9e6d. Final-head typecheck passed; targeted Aide tests 9/9 and merge gate tests 2/2 passed. Full npm test passed: hub 977/977 and Neovim 220/220, zero failures/cancellations/skips. Evidence A-619: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-619-t-152-full-npm-test-at-764a11e.log. The background completion callback failed waiting for a role-clause notification after the suite finished; the test run itself completed successfully. Reviewer rev-9 is clear in A-582; self-review is clear in A-580. Exact instance role-clause additions/replacement are in A-579. Per Coordinator direction, integration with the batch is checked at merge rather than rebasing during the run.

### impl-152b · 2026-10-10T13:56:47.975Z

Rebase-only follow-up: fetched origin; root dev and origin/dev are both 36f9961. Rebasing reviewed 764a11e onto that base, preserving both README additions. Will rerun typecheck and targeted Aide/gate tests only; no package suite or roles.toml edits.

### impl-152b · 2026-10-10T14:03:11.294Z

Rebase-only handover: fetched origin and rebased 764a11e onto root dev/origin/dev 36f9961. New pushed head from git log: 9a9e7f35aed1a54ded8e29b8828c0f926d51437d. Resolved hub/README.md by retaining dev's Aide authority wording and T-152's task claim/worktree/lead/gate paragraph; range-diff shows only README context changed. Gate implementation and aide-claims test bytes match reviewed 764a11e. No .cland/roles.toml edits. npm run typecheck passed (A-622: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-622-t-152-rebased-head-typecheck.log). Targeted node --test of aide-claims, aide, merge, tracker-ready, verdict-commit passed 78/78, zero failures/cancellations/skips (A-621: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-621-t-152-rebased-head-targeted-tests.log). git diff --check passed; clean worktree. No package suite run per Coordinator brief.

### rev-9 · 2026-10-10T14:05:43.862Z

verdict: review
result: clear
by: rev-9 [reviewer]
run: rev-2026-10-10-152-2
commit: 9a9e7f35aed1a54ded8e29b8828c0f926d51437d

Clear: no high, medium or low findings. Standards and Spec independently clear. Range-diff 278d547..764a11e against 36f9961..9a9e7f3 changes only README authority context; the resolution preserves dev's within-role Aide authority and T-152's claim/worktree/status/lead/gate paragraph. Gate and aide-claims test blob hashes are identical to the previously approved head. Shared self-review/QA claimant exclusion, identity normalization and T-141 ownership remain intact; A-582 approval carries forward. git diff --check passes. A-619 reports prior-head full suite977 hub+220 Neovim passing; A-621/A-622 report78 targeted tests and typecheck passing on9a9e7f3. No new-head full suite claimed or repeated. No edits or Reviewer tests. Evidence A-623: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-623-t-152-rebase-review-at-9a9e7f3.md.

### coord · 2026-10-10T14:06:04.758Z

Merged fc44bbd45f453464eb884e5d923ea9802c954257 onto dev.
