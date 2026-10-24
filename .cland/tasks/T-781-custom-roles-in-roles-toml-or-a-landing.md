---
id: T-781
kind: task
title: Custom roles in roles.toml, or a landing card that claims none
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-956
branch: t/T-781-custom-roles-in-roles-toml-or-a-landing
created: 2026-10-18T06:04:23.355Z
updated: 2026-10-24T10:16:49.364Z
---

## Summary

The landing's crew section ends with a card "+ your own role: a docs writer, a security reviewer, an epic lead. A role is a few lines in `.cland/roles.toml`". Today `roles.toml` refuses unknown roles, and no spec covers custom roles. The human chose to ship custom roles (option a, General 2026-10-24 09:40Z, answer to ask 2e5b9645); the card stays as written.

## What to build

A custom role is a `roles.toml` table with its own clause, hub tool grants, launch harness, model and effort, and skills, launched like a built-in role. Tool grants are validated against the known tool table and default to deny. A custom role can never hold Coordinator-only tools, the human's authority, or the review and QA verdict authority unless the design agreed with the Coordinator says otherwise.

## Acceptance criteria

- [x] C1. A role named in roles.toml but not built in launches with its own clause, tools, harness and model, and its clause reaches the session on launch and on reconnect (test).
  - done: impl-781 · 2026-10-24T10:15:31.982Z
- [x] C2. An unknown tool, a forbidden grant, or a name that clashes with a built-in role is refused when roles.toml loads, with an error naming the field (test).
  - done: impl-781 · 2026-10-24T10:05:49.699Z
- [x] C3. site/src/content/docs/docs/crew.md and the landing card describe custom roles as they ship, with one worked example (docs).
  - done: impl-781 · 2026-10-24T10:05:50.035Z

## Comments

### coord · 2026-10-24T09:40:49.155Z

Decision (human, General 2026-10-24 09:40Z, answer to ask 2e5b9645): (a) custom roles ship. A role is a roles.toml table with its own clause, tools, harness and model, launched like the built-in roles. The landing card stays as written.

### impl-781 · 2026-10-24T09:42:35.349Z

Design-first exploration complete; proposed namespaced custom roles, deny-by-default grants with an immutable advisory-role ceiling, loaded-role launch/reconnect/client rows and T1/T2/client test seams. Design submitted to Coordinator in topic-956; production code waits for approval.

### impl-781 · 2026-10-24T10:06:48.858Z

Implemented approved custom-role schema and immutable authority ceiling, own-claim review/done/verify workflow, role launch/reconnect/routing/client rows, and worked docs example. Pushed head 26441bf741116f2ebe607b0e3360d496843a3afe after merging origin/dev. Local macOS at that head: npm run check passed (test lint report-only, zero refusals); roles-launch-permissions 12/12 T1, custom-roles-component 5/5 T2, roles-editor 13/13 T1, launcher-component 12/12 Neovim T2, session-launch 10/10 isolated Web. Targeted receipts only; custom verify test is dry-run admission, no integrated/runtime verification receipt yet. C1–C3 marked done. Source review next; Coordinator's verify pause remains in force.

### rev-32 · 2026-10-24T10:13:24.696Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-781-source
commit: 26441bf741116f2ebe607b0e3360d496843a3afe
scope: full
findings: [{"severity":"medium","text":"M1: custom claimant identity is omitted from same-session review/QA exclusion; reassignment to built-in Reviewer/QA permits self-verdict. Extend the independent gate and test reassignment refusal plus independent success.","file":"hub/src/tracker/gate-verdicts.ts","line":13},{"severity":"medium","text":"M2: three new indexed test notes have prose headings, violating the existing exact test-path heading guard; correct custom-roles, roles-launch-permissions and Neovim launcher notes without weakening test-docs.","file":"docs/agents/tests/hub-test-custom-roles-component.test.ts.md","line":1},{"severity":"low","text":"L1: valid custom constructor inherits CODEX_SANDBOX.constructor; changing its harness to codex passes a function as sandbox and generates invalid TOML. Use an own-key/built-in compatibility lookup and test the edit.","file":"hub/src/roles/launch.ts","line":18}]
finding_counts: {"high":0,"medium":2,"low":1}

T-781 full source review — not clear

Head 26441bf741116f2ebe607b0e3360d496843a3afe; tree 441ba727b01b390a986c9932308ac9c3e7d6c6f2. Fixed diff 63e0e0b0...26441bf7:30 files,706 additions/89 removals. Incoming dev was merged before this first source pass. Approved design A-10683 and Coordinator decisions74b0b151/4f36c483 read in topic-956; source brief A-10715 read. Both axes completed personally, without delegation.

## Standards

M2 (medium), docs/agents/tests/hub-test-custom-roles-component.test.ts.md:1, hub-test-roles-launch-permissions.test.ts.md:1 and nvim-test-launcher-component.test.ts.md:1: three newly indexed notes use prose headings. The existing T1 test-docs.test.ts requires "# <repository/path.test.ts>", verifies the matching note filename and test/index path, so these additions deterministically fail that unchanged guard. Correct all three exact-path headings and run the direct docs seam; preserve the guard. The Web note retains its earlier correct path heading and is not this failure.

Test tier choices otherwise fit: T1 parser/authority permutations; sealed T2 projectHub with FakeClock/fake adapters for launch/reconnect/settings/routing/claim/done/review/own verification; existing recorded-headless Neovim T2 and isolated Web launcher. Verification within the new component case is only a dry-run admission preview. Ready-row and Web row observers are armed before the actions; final claim/status/default/frame assertions remain. Main and sliced protocol fixture changes are additive44lines each with no removals. No new native harness/daemon boundary. Both pure and public tests preserve existing built-in cases. No independent smell finding.

## Spec

M1 (medium), hub/src/tracker/gate-verdicts.ts:13: the normal gate excludes same-session verdicts only when claim.role is implementer/aide. New custom claims persist their custom role, and ordinary role assignment changes the holder without rewriting that claim. Reassigning the same custom claimant to built-in Reviewer or QA therefore permits its own current verdict through the writer-role and identity checks. This violates the approved unchanged independent gates. Include custom-worker claimant identity in both review/QA exclusions; prove refusal after role reassignment plus independent Reviewer success at the established gate/public seam. The implementer accepted this source trace; no live reproduction was performed.

L1 (low), hub/src/roles/launch.ts:18: constructor is an explicitly supported custom role name, but setMissingCodexSandbox still reads CODEX_SANDBOX[role] through a normal object. For role launch constructor --harness codex, it receives the inherited constructor function and passes it into setRoleKey; JSON.stringify yields undefined and the resulting sandbox=undefined text is invalid TOML. Use an own-key/built-in-only compatibility lookup and retain a custom-name launch-edit control. Parser grant/label null-prototype fixes cover their own paths but not this one.

Source otherwise implements the approved namespace: required nonempty clause/harness, strict custom top/launch/permission field errors, reserved-name collisions, deny-by-default exact tool/scope grants. Both availability and decide apply the immutable custom ceiling. Criterion done/review-only writes require own live claims; forbidden statuses/extra edits/foreign claims fail. Own mode-free verification is restricted to an open claimed task's topic and exact worktree, no all/occasion. The registered scope, docs and skill changes match those approved additions. Built-in Coordinator/Reviewer/QA/human powers and Aide named-only routing remain separate; lead T-n uses built-in ownership.

Loaded definitions drive role validation/assignment/reconnect/list/subscriptions/role mentions. Launch/model/effort/account/native policy and clause/usable skills feed existing launch machinery; client selectors already consume these rows. Custom launch with item follows the normal worktree/claim path and plan checks. The component fixture explicitly proves root fallback when no territory exists, not actual native worktree creation. Built-in default-role source blob is unchanged. Automatic custom pools/hierarchy remain the approved follow-up.

C1 fails until M1 preserves independent gate behavior and M2's new docs guard failure is fixed; requested launch/claim/review workflow is not ready to verify. C2 schema/immutable-ceiling source paths otherwise established but runtime verification remains pending. C3 worked docs-writer example, help, hub README, session-permission guidance and implement skill pointer are present; landing card remains unchanged as instructed. Skill CHANGES records T-781. No source criterion marks renewed on this not-clear pass.

## Evidence and limits

A-10715 reports exact-head local macOS check pass (lint report-only/zero refusals), roles-launch-permissions12/12T1, custom-roles-component5/5T2, roles-editor13/13T1, launcher-component12/12T2replay and session-launch10/10Web. These are targeted reports, not a configured suite, Linux receipt, duration-gate pass or actual custom verify execution. Preserve original stdout/exits/native timings/head attribution without rerunning solely for transcription; no such replacement evidence was generated by Reviewer. No per-item QA under none/after-stage.

Complete finding set: M1/M2 and L1. Fix, commit/push and request a fresh full source review before configured verification. No dev merge requested. The Coordinator restart pause has now been lifted, but T-781 still needs corrected source clearance.
Reviewer performed read-only Git/source/docs/topic/artifact inspection only; no tests, probes, edits, browser, merge or delegation.
Standards: one medium finding. Spec: one medium and one low finding.

Durable audit A-10725: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10725-t-781-full-source-review-at-26441bf7.md

Criteria: C1 failed (Custom worker lifecycle permits same-session verdicts after role reassignment, and new indexed note headings fail the existing T1 docs guard.).

### impl-781 · 2026-10-24T10:16:34.370Z

Addressed complete source review A-10725 (M1/M2/L1) in pushed bbc68b93. M1: stable custom claimant identity now excludes self-review/QA and self stage QA after role reassignment; regressions retain independent Reviewer/QA acceptance and exact independent stage closure. M2: all three new test-note headings are exact repository paths; existing docs guard unchanged and passes 3/3 T1. L1: Codex sandbox compatibility lookup is own-key-only; constructor is tested through pure helper and public role.launch edit. Original red excerpts, exits, native per-test timings and base-head attribution retained in A-10728 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10728-t-781-review-regression-red-receipts.md). Local macOS review-fix working tree, now committed unchanged as bbc68b93: npm run check passed (test lint report-only, zero refusals), roles-launch-permissions 12/12 T1, custom-roles-component 8/8 T2, test-docs 3/3 T1. C1 re-marked done; C1–C3 all done. No dev merge after first review. Fresh full source review requested before configured verification.
