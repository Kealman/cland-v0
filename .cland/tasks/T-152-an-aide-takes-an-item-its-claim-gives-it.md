---
id: T-152
kind: task
title: "An Aide takes an item: its claim gives it the worktree and branch, moves status, makes it the lead, and its work passes the same gate"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-111
blocked_by:
  - T-148
topic: topic-81
branch: t/T-152-an-aide-takes-an-item-its-claim-gives-it
created: 2026-10-10T05:33:01.124Z
updated: 2026-10-10T11:31:10.969Z
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
