---
id: T-781
kind: task
title: Custom roles in roles.toml, or a landing card that claims none
state: open
status: ready
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
updated: 2026-10-24T10:45:23.504Z
---

## Summary

The landing's crew section ends with a card "+ your own role: a docs writer, a security reviewer, an epic lead. A role is a few lines in `.cland/roles.toml`". Today `roles.toml` refuses unknown roles, and no spec covers custom roles. The human chose to ship custom roles (option a, General 2026-10-24 09:40Z, answer to ask 2e5b9645); the card stays as written.

## What to build

A custom role is a `roles.toml` table with its own clause, hub tool grants, launch harness, model and effort, and skills, launched like a built-in role. Tool grants are validated against the known tool table and default to deny. A custom role can never hold Coordinator-only tools, the human's authority, or the review and QA verdict authority unless the design agreed with the Coordinator says otherwise.

## Acceptance criteria

- [x] C1. A role named in roles.toml but not built in launches with its own clause, tools, harness and model, and its clause reaches the session on launch and on reconnect (test).
  - done: impl-781 · 2026-10-24T10:30:40.890Z
  - verified: rev-26 [reviewer] · run rev-20261024-781-final-1 · 2026-10-24T10:44:32.721Z · commit 604cc53e0abe611c3c3b3c54ce35870946f60ee1
- [x] C2. An unknown tool, a forbidden grant, or a name that clashes with a built-in role is refused when roles.toml loads, with an error naming the field (test).
  - done: impl-781 · 2026-10-24T10:05:49.699Z
  - verified: rev-26 [reviewer] · run rev-20261024-781-final-1 · 2026-10-24T10:44:32.721Z · commit 604cc53e0abe611c3c3b3c54ce35870946f60ee1
- [x] C3. site/src/content/docs/docs/crew.md and the landing card describe custom roles as they ship, with one worked example (docs).
  - done: impl-781 · 2026-10-24T10:05:50.035Z
  - verified: rev-26 [reviewer] · run rev-20261024-781-source-3 · 2026-10-24T10:20:47.550Z · commit a77f19746005da40171e74766c36b60db4e8c5ee
  - verified: rev-26 [reviewer] · run rev-20261024-781-source-4 · 2026-10-24T10:32:10.383Z · commit 604cc53e0abe611c3c3b3c54ce35870946f60ee1
  - verified: rev-26 [reviewer] · run rev-20261024-781-final-1 · 2026-10-24T10:44:32.721Z · commit 604cc53e0abe611c3c3b3c54ce35870946f60ee1

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

### rev-26 · 2026-10-24T10:19:36.950Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-781-source-2
commit: bbc68b93fefd1d6cb8ef845a83ac271428294f8a
scope: full
findings: [{"severity":"medium","text":"M3: direct Tracker.stop is registered in a later native t.after than tempProject's shared directory-removal hook, so the database/watchers can outlive removal of their root. Await stop through onCleanup/beforeDirectories; preserve exact independent stage assertions (rule12).","file":"hub/test/custom-roles-component.test.ts","line":248}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-781 corrected full source review — not clear
Head bbc68b93fefd1d6cb8ef845a83ac271428294f8a; tree 6ecffe4960784ea9a5cda9f9d79da0ac9c803964. Local/origin task refs agree. Full source comparison against incorporated dev63e0e0b0, plus correction comparison26441bf7...bbc68b93 (8 files,106 additions/10 removals). Scope full; run rev-20261024-781-source-2. Prior full review A-10725 and approved design A-10683 carried explicitly; both axes inspected personally without delegation.

## Standards
M3 (medium), hub/test/custom-roles-component.test.ts:248: the new direct Tracker fixture registers stop with a native t.after after tempProject has already registered the shared ownership hook. tempProject's ownDirectory adds removal to that first hook; shared cleanup executes resources/hubs/directories before the later native hook. Therefore the Tracker's open database/watchers can survive removal of their root, contrary to rule12. Register/await tracker.stop in onCleanup or beforeDirectories so it completes before directory removal. Retain the same-session stage-QA rejection and exact independent closed/current stage assertions. This is a static ownership-order finding, not a claimed observed runtime failure.

M2's three exact-path note headings are corrected and guidance now covers ordinary and stage independent-gate controls plus the constructor launch edit. Parser tests remain T1; sealed projectHub/fake-adapter and recorded-headless Neovim tests stay T2, and the browser test stays isolated Web. Web/ready observers remain armed before actions. Fixture recordings retain all built-in rows and add custom rows; no caps, timing bounds or final assertions weakened. Full whitespace check clean. No independent smell finding.

## Spec
Prior M1 resolved in production: custom claims are included in ordinary review/QA claimant exclusion and both stage-QA guards, including restored closure validation. New tests preserve the custom claim's session identity after reassignment to built-in Reviewer/QA, reject its own accepted gate result, and retain independent Reviewer/QA success. Stage-QA includes same-session rejection plus exact independent current closure. Prior L1 resolved by Object.hasOwn on CODEX_SANDBOX, with pure constructor control and public launch-edit assertions.

The remaining implementation matches the approved namespace and authority model: required custom clause/harness; reserved-name and unknown-field/grant rejection; explicit default-deny grants; immutable custom ceiling at both availability and decision boundaries. Own done/review/verification restrictions remain separate from built-in verifier and Coordinator authority. Loaded custom definitions drive launch/list/assignment/reconnect/clause/skills/routing and both launchers. Normal task worktree/plan checks and custom claim persistence apply; the no-territory component case proves only root fallback/claim, not native Git worktree creation. Manual staffing and advisory custom helpers retain the approved limits.

C3's crew worked example, exact grant list, manual staffing, launch command and landing card match the shipped boundary. Hub README/help/session-permission and implement-skill pointer match; skill CHANGES records the edit. Built-in clause bytes stay unchanged as approved. No new Spec finding.

## Evidence and next step
A-10728 preserves original local macOS red excerpts with exits/native timings: self-review Missing expected exception; self-QA true!==false; stage-QA Missing expected rejection; constructor invalid TOML; exact-path docs heading guard. Green counts are reported12/12 T1 parser,8/8 T2 component,3/3 docs, check0/report-only lint. They are review-fix working-tree evidence committed unchanged as this head, not configured Linux coverage. Earlier editor/Neovim/Web receipts stay attributed to26441bf7; no reattribution or reconstructed stdout.

Only M3 remains blocking; M1/M2/L1 are resolved. C1 failed pending the lifecycle-safe test correction; C2/C3 final marks remain pending source clearance and actual same-head configured evidence. Fix M3, commit/push and request fresh source review before mode-free verify. Coordinator9f095867's stage cover now holds the local test slot: respect cover-quiet, do not bypass or rerun local node tests during the cover. No local transcription rerun is requested; the subsequent source-cleared configured droplet run can supply runtime evidence. No dev merge authorized. QA none/after-stage.

Reviewer used read-only source/Git/topic/artifact inspection only; no edits, tests, probes, GUI, installs, merge or delegation. Standards one medium finding; Spec zero unresolved findings.
Durable review A-10735.

Criteria: C1 failed (M3: the new stage-QA regression removes its scratch root before stopping the direct Tracker writer; fix shared teardown ordering.).

### impl-781 · 2026-10-24T10:20:22.220Z

M3 from consolidated A-10735 corrected in pushed a77f19746005da40171e74766c36b60db4e8c5ee: direct Tracker stop now uses shared onCleanup, awaited before owned directory removal. Both same-session stage-QA rejection and independent closed/current stage assertions unchanged; guidance updated. npm run check passed on the unchanged fix tree (local macOS, test lint report-only/zero refusals). Targeted runtime attempt was refused before fixture setup by cover-quiet run 91eb2773-f39a-4146-89c1-f10e931e884e; no current runtime receipt, no bypass/retry. A-10736 retains this admission receipt and scope. C1 done restored; all criteria done. No dev merge. Fresh source review next, then authorized configured droplet verification.

### rev-26 · 2026-10-24T10:20:47.550Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-781-source-3
commit: a77f19746005da40171e74766c36b60db4e8c5ee
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-781 consolidated corrected source — clear
Head a77f19746005da40171e74766c36b60db4e8c5ee; tree 85c2da976c4c4e339dde2aef944ea674d370a5f0. Local/origin refs agree. Full scope consolidates A-10725 and A-10735 with the two-file correction from bbc68b93. Run rev-20261024-781-source-3; findings [].

## Standards
M3 resolved: the direct Tracker stop is now registered through onCleanup; the shared owner awaits resource disposal before removing tempProject's root. The stage-QA same-session rejection and independent closed/current assertions are byte-unchanged. Per-test guidance records this required ordering. Earlier M2 exact-path headings and tier/fixture ownership corrections remain intact. No new findings.

## Spec
Earlier M1 independent-verdict gates and L1 own-key Codex compatibility lookup remain resolved. Parser, immutable custom grant ceiling, launch/reconnect/settings/routing, manual staffing, own-claim completion/verification and existing built-in authority boundaries are unchanged from the full corrected-source audit. No additional implementation or dev merge. C3's worked custom docs-writer example, landing claim, help, hub/agent guidance and kept-skill provenance match the approved scope. C3 source-verified; C1/C2 await actual configured runtime evidence at this head.

## Evidence
A-10736 explicitly records the local cover-quiet refusal: integrated run91eb2773 holds the slot. It occurred at admission before fixture setup, so the eight failed wrappers are not eight observed product assertion failures. No bypass/retry occurred. Static check is reported successful on the correction tree with test lint report-only/zero refusals; prior runtime receipts keep their earlier source attribution. No current component runtime pass or configured suite is claimed.

C1's done mark has been refreshed. Source clear now permits normal mode-free configured droplet verification at this unchanged head, respecting the local stage cover and Coordinator merge hold. Report actual phases, platform/executor, native samples and gate modes; generic load/deferred messages are not executed repetitions/T3 evidence. A changed head needs fresh source review. No local rerun, full-suite override or merge requested. QA none/after-stage.

Reviewer performed read-only source/Git/artifact inspection only; no tests/probes, edits, GUI, installs, merge or delegation. Standards 0 findings; Spec 0 findings.
Durable review A-10737.

Criteria: C3 verified.

### rev-26 · 2026-10-24T10:28:36.333Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-781-evidence-1
commit: a77f19746005da40171e74766c36b60db4e8c5ee
scope: evidence
findings: [{"severity":"medium","text":"M4: Adding verify to KNOWN_TOOLS now routes built-in verification briefs through DEFAULT_PERMISSIONS, whose built-in lists omit verify. Five qa-lint tests fail; a valid Implementer dry-run is incorrectly refused. Migrate the linter to actual built-in verification admission without weakening report-topic/all/Aide/permission controls.","file":"hub/src/qa-lint.ts","line":118}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-781 configured evidence — not clear
Head a77f19746005da40171e74766c36b60db4e8c5ee; tree85c2da976c4c4e339dde2aef944ea674d370a5f0. Run rev-20261024-781-evidence-1. Original configured run923f099a-efd1-45d5-b767-8360ad99ef55 / A-10744 exits1 in T1.

Standards: one medium M4. The first failure at A-10744:5000 reads: expected /Implementer.*item.s topic/, actual 'implementer: Implementer may not use verify'. Valid quoted --dry-run also gains the same unexpected refusal; three other qa-lint cases fail through the same path (five failures total).

Read-only pinned-source comparison identifies the item-caused integration: adding verify to KNOWN_TOOLS in roles/permissions.ts makes qa-lint.ts:97–118 route ordinary built-in verify commands through decide(role, DEFAULT_PERMISSIONS[role], call). Built-in default lists do not include verify; the linter previously handled this command through its separate CLI/report checks at203–207. Valid Implementer verification briefs are now incorrectly rejected. Migrate this consumer to the actual built-in verification admission contract while preserving its report-topic, all/occasion, Aide and existing permission negative controls. Do not merely erase assertions or broadly grant verification to bypass the failure. Include custom-role behavior only within its approved own-task/grant scope.

Spec: C1 remains unverified and failed for this integrated permission regression. C2 remains pending actual configured T2; C3 source verification carries forward from A-10737. Prior M1/M2/L1 and fixture-ownership M3 corrections are not reversed.

Receipt scope: Linux x64 6.8.0-142-generic c-8 lon1 cland-v0-0475d0ef; Node24.21.0/Neovim0.12.5; workers2; lifetime153s/$0.0106. T0 host check40.549s passes; host treeabc79b2c9a0202580bcbe0b12710a070ffb69574 reused, not repeated remotely. T1 reports838pass/5fail; completion summary863pass/5fail includes other completed records. No T2/Web/mapped T4 execution; projections are not passes. Lint133/60 and duration diagnostics report-only. No configured green, T3/T4 or enforcing-budget claim.

Consolidated new finding M4 only. Preserve original failed receipt; fix, commit/push, request fresh source review before fresh mode-free verification. Local test slot remains cover-quiet under Coordinator9f095867; wait or obtain the normal authorized remote targeted path, never bypass. Merge hold remains. Reviewer ran no tests/probes, edits, browser or delegation.
Durable review A-10746.

Criteria: C1 failed (M4: integrated permission-table change rejects valid built-in verification briefs; configured T1 has five failures.).

### impl-781 · 2026-10-24T10:31:30.312Z

M4 from evidence review A-10746 fixed in pushed 604cc53e0abe611c3c3b3c54ce35870946f60ee1. QA brief lint now keeps verify/suite on its existing scheduler-specific report/mode/Aide policy instead of generic DEFAULT_PERMISSIONS after KNOWN_TOOLS expansion. Existing five failing qa-lint cases/negative assertions unchanged; no broad grants or custom admission changes. npm run check passed on unchanged fix tree (local macOS, lint report-only/zero refusals). No local runtime rerun under cover-quiet; original failed Linux receipt A-10744/923f099a remains retained: T0 host passed, T1 failed5, T2/Web/T4 not run. C1 restored done; fresh full source review before new configured droplet run. No dev merge.

### rev-26 · 2026-10-24T10:32:10.383Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-781-source-4
commit: 604cc53e0abe611c3c3b3c54ce35870946f60ee1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-781 consolidated corrected-source review — clear
Head604cc53e0abe611c3c3b3c54ce35870946f60ee1; treee49798b540e7eee21d0d9367c17b8ef58c0a4656. Local task/origin refs agree. Scope full, run rev-20261024-781-source-4; findings[]. Consolidates prior full review A-10737 and evidence finding A-10746.

## Standards
M4 resolved in source: qa-lint roleProblem returns verify/suite to the pre-existing scheduler-specific CLI policy, ahead of generic KNOWN_TOOLS/DEFAULT_PERMISSIONS lookup. checkCommand still validates syntax/flags; lintQaBrief retains Implementer report-topic and dry-run handling, reserved-all checks, and Aide refusal. All five failing existing qa-lint assertions and other permission/quoting/scoped-verdict controls are unchanged. The two-file5+/1− delta contains only this consumer correction plus matching QA brief guidance; no test relaxation, default-grant broadening or custom live-admission change. Diff whitespace check clean.

A-10744 retains the original deterministic red seam: expected report-topic refusal, actual 'Implementer may not use verify'; five failures at old a77f1974, no old configured green. A-10750 describes static check0/report lint zero refusals on the fix tree committed unchanged as604cc53e; it contains no complete raw check output, and no post-fix local runtime is claimed. Cover-quiet is respected. Fresh configured run must provide actual same-head green.

## Spec
Prior corrections remain: M1 custom claimants cannot self-verify through built-in role reassignment (ordinary and stage QA gates); M2 exact-path per-test headings; L1 own-property sandbox default lookup; M3 direct Tracker is stopped through awaited shared-resource onCleanup before directory removal.
Custom roles remain namespaced/default-deny, bounded by immutable safe grants; manual staffing, launch/reconnect clause/harness/model routing and config field diagnostics unchanged. Documentation/worked example remains consistent with approved behavior.
Runtime custom verify admission still checks the loaded grant, live own open claimed item/topic, exact task worktree, mode-free auto and no occasion before scheduler admission. Built-ins continue using their existing scheduler CLI admission. The lint correction introduces no runtime authority.
C3 source verified at604cc53e by carry-forward of unchanged accepted docs. C1/C2 done marks present but remain pending configured runtime settlement, including parser/refusal and public launch/reconnect/independence controls plus Neovim/Web launch fixtures and mapped T4 where selected. No new source finding.

Both review axes performed in-session through read-only pinned-source/Git/artifact inspection, with unchanged accepted implementation carried forward and the full correction inspected; no tests, probes, edits, installs, browser, merge or delegation. Standards0 findings; Spec0 findings.
Proceed with one normal mode-free configured droplet run at this head. Cover-quiet local slot and Coordinator stage-cover merge hold remain; this verdict lifts neither. Changed head requires fresh source review.
Durable full review A-10752.

Criteria: C3 verified.

### rev-26 · 2026-10-24T10:44:32.721Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-781-final-1
commit: 604cc53e0abe611c3c3b3c54ce35870946f60ee1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-781 final same-head evidence — clear
Head604cc53e0abe611c3c3b3c54ce35870946f60ee1; treee49798b540e7eee21d0d9367c17b8ef58c0a4656. Task/origin refs agree. Scope evidence; run rev-20261024-781-final-1; findings[]. Full source A-10752 carries forward.

## Standards
Mode-free configured run03acc344-2136-4361-9baa-a58198242773 / original A-10761 exits0 at the reviewed head. Deduplicated native finish records:2939 ordinary test passes /424 file passes, plus70 actual load-test passes /70 load-file passes across14 identities each5/5. No fail, skip or cancellation.
T0 host gate39.864s, allT1, fallback all hub+NeovimT2, mapped T4 and actual Web completed. Host gate bfb49910319a9017136166e418603f7874483707 is independently a Git tree, reused remotely rather than rerun as Linux typecheck.
Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-f7c5a851; Node24.21.0/Neovim0.12.5; workers2, T1serial/Web4; lifetime604s/$0.0420.
Suite walls51.57/312.57/1.87/132.05s differ from command envelopes/projections; Web shard131.96s exceeds40s report-only. Lint133/60, duration/tier diagnostics, six missing baselines and incomplete ratchet-base are report-only; no enforcing-budget pass.

Mapped T4 inbox-verifier-load executes its100-frame/no-history-scan guard once at1.008448808s, added measured phase wall1.830s. No T4 repetitions or general T3 execution claimed; remaining T3 stays periodic/integrated. Ordinary mapped guard counted within2939, not added again.

## Spec
C1 verified: all8 public custom-role component cases pass (0.075730193–0.327813895s ordinary). They cover own launch settings/clause delivery/reconnect, reload-refused forbidden grants, scoped own workflow, custom routing/normal task-worktree claim adoption, and review/QA role-reassignment plus stage-QA independence regressions. These8 identities also pass5/5 each, worst0.434958157s. The fixed direct Tracker cleanup is exercised by the stage-QA case; no independent post-process census is invented.
All12 roles-launch-permissions parser/policy cases pass; five new parser/grant identities also pass5/5, maximum0.005607862s. Neovim custom role launcher/crew case passes ordinary0.286849234s plus5/5 (worst0.388624677s); Web custom role selectable/defaults/crew case passes1.413055047s, below4s. No new identity reaches allowance threshold.
C2 verified: field-named missing/unknown/collision/forbidden-grant load refusals and deny-by-default/fixed authority checks pass in parser and public component receipts. Own-task custom verification controls are grant/admission and dry-run preview coverage; no nested executed custom verification is claimed.
C3 carries the accepted worked-example/crew docs source verification to this head.

M4 settled: all19 existing qa-lint cases now pass, including the five failed at old a77f1974. Their assertions were unchanged in the source-cleared correction. M1/M2/L1 and fixture-cleanup M3 corrections remain accepted; no new findings.
Old A-10744 stays a failed T1 receipt at a77f1974 with no T2/Web/T4 cover. A-10728 local correction excerpts, earlier local source baselines and A-10750 static-check account remain attributed to their actual trees; current exact-head Linux result supplies fresh runtime evidence. No transcript reconstruction or replacement reviewer reruns.

AllC1–C3 verified. Normal final read-only current-dev conflict check/ready routing remain the lead's responsibility; a new head requires source review and configured verification. Coordinator69b4632d lifted local quiet/merge hold; stage covers remain open for separately owned regressions. This item verdict does not close stages or settle E-778 launch qualifications. QA policy none/after-stage, no item QA claim.
Reviewer performed read-only source/Git/artifact inspection and stdlib log parsing, no tests, probes, browser, edits, installs, merge or delegation. Standards0 findings; Spec0 findings.
Durable final review A-10764.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-781 · 2026-10-24T10:45:23.503Z

Final same-head source/evidence review is clear at 604cc53e; C1–C3 verified, hub status ready. Configured droplet run 03acc344/A-10761 passed T0 host gate, all T1, fallback all T2 in both packages, Web and mapped T4 guard; 2939 ordinary test passes, 14 new identities 5/5 load controls. Linux c-8 lon1; lifetime604s/$0.0420; lint/duration report-only, no general T3 or enforcing-budget pass claimed. A-10764 retains final provenance. Fresh read-only merge-tree against origin/dev44f220a5 exits0/no conflicts, clean worktree, task head unchanged. Reported ready to Coordinator, claim retained; no merge. Automatic custom staffing/pools/hierarchy remains agreed separate feature follow-up.
