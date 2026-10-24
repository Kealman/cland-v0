---
id: T-783
kind: task
title: "Docs pass: check the site against the shipped behaviour"
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by:
  - T-779
  - T-780
  - T-781
  - Q-782
  - E-611
  - E-612
  - E-613
  - E-614
  - E-615
  - E-616
  - E-415
  - E-418
  - E-419
topic: topic-953
branch: t/T-783-docs-pass-check-the-site-against-the
created: 2026-10-18T06:04:23.644Z
updated: 2026-10-24T11:53:35.476Z
closed: 2026-10-24T11:53:35.476Z
---

## Summary

The eleven docs pages under `site/src/content/docs/docs/` were written before the features they describe shipped, partly from specs and partly by inference. Each page needs a pass against the shipped behaviour before promotion starts.

## What to check

Every command, flag, key and default the pages name. These were guessed and need checking first:

- `[web]` keys `bind` and `url`, and `cland web --qr`.
- The `[verification]` keys `prepare`, `check` and `test`, and the order `cland verify` runs them in; `cland verify --report general`.
- Codex `model = ""`, the effort values, and the Codex sandbox defaults: the docs follow the v0.1.4 spec (Implementer `workspace-write`), the code defaults to `danger-full-access`.
- The product default numbers in the docs (`daily_spend_usd = 5`, `remote_budget = 4`, …).
- `permissions = "auto"` for Claude Code roles, and `cland role launch`.
- The XL size refusal and `cland task import-github` defaulting to `origin`.
- The install and uninstall paths, the user state directories and the Neovim cache location.

## Acceptance criteria

- [x] C1. Every docs page is read against the shipped release and every wrong statement is corrected
  - done: impl-783 · 2026-10-24T10:06:21.307Z
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-2 · 2026-10-24T10:07:10.819Z · commit 5e16ec8450df9065e1da1e89790825f1a776c854
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-1 · 2026-10-24T10:26:28.365Z · commit 5e16ec8450df9065e1da1e89790825f1a776c854
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-3 · 2026-10-24T11:03:21.208Z · commit 16c622dcd859d9c33dfad6f2536b0393171d5485
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-4 · 2026-10-24T11:08:47.428Z · commit 4371f90b04f5f2e48590da0a321166e9aa077929
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-2 · 2026-10-24T11:22:33.100Z · commit 4371f90b04f5f2e48590da0a321166e9aa077929
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-5 · 2026-10-24T11:25:40.708Z · commit d4abd37853d9743531a50efcaf9c421e9ffd4f40
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-3 · 2026-10-24T11:43:58.131Z · commit d4abd37853d9743531a50efcaf9c421e9ffd4f40
- [x] C2. Each command shown in a code block runs as shown on a fresh project
  - done: impl-783 · 2026-10-24T10:00:17.716Z
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-1 · 2026-10-24T10:26:28.365Z · commit 5e16ec8450df9065e1da1e89790825f1a776c854
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-2 · 2026-10-24T11:22:33.100Z · commit 4371f90b04f5f2e48590da0a321166e9aa077929
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-3 · 2026-10-24T11:43:58.131Z · commit d4abd37853d9743531a50efcaf9c421e9ffd4f40
- [x] C3. The landing's claims (crew section, features, FAQ) are checked the same way
  - done: impl-783 · 2026-10-24T10:06:21.413Z
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-2 · 2026-10-24T10:07:10.819Z · commit 5e16ec8450df9065e1da1e89790825f1a776c854
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-1 · 2026-10-24T10:26:28.365Z · commit 5e16ec8450df9065e1da1e89790825f1a776c854
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-3 · 2026-10-24T11:03:21.208Z · commit 16c622dcd859d9c33dfad6f2536b0393171d5485
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-4 · 2026-10-24T11:08:47.428Z · commit 4371f90b04f5f2e48590da0a321166e9aa077929
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-2 · 2026-10-24T11:22:33.100Z · commit 4371f90b04f5f2e48590da0a321166e9aa077929
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-5 · 2026-10-24T11:25:40.708Z · commit d4abd37853d9743531a50efcaf9c421e9ffd4f40
  - verified: rev-26 [reviewer] · run rev-20261024-783-final-3 · 2026-10-24T11:43:58.131Z · commit d4abd37853d9743531a50efcaf9c421e9ffd4f40

## Comments

### impl-783 · 2026-10-24T10:00:41.927Z

Documentation audit committed/pushed at d843b1d869d192b7a5db74b5d4464877c463c705 (branch t/T-783-docs-pass-check-the-site-against-the), dev baseline 86449530. All 15 pages + README + landing read; 171 claim rows and 60 syntax-checked shell blocks. A-10709 contains the table, actual isolated CLI receipts, and final root/site build logs. macOS arm64 local npm run check passes (test lint report-only: 133 existing findings/60 files, zero refusals); Astro builds 23 pages with existing i18n/404 warnings. C2 external execution exceptions explicitly accepted by Coordinator decision ae3f5d65 in topic-953 and listed in the table. QA scope none. No suite receipt claimed: verify submission paused for Coordinator hub restart.

### rev-26 · 2026-10-24T10:04:45.503Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-783-source-1
commit: d843b1d869d192b7a5db74b5d4464877c463c705
scope: full
findings: [{"severity":"medium","text":"M1: Repository table still identifies skills/ as curated skill source. hub/src/init/skills.ts SKILLS_SOURCE and skills/README.md identify .agents/skills/; skills/ holds provisioning templates. Correct both table descriptions as applicable and audit entry.","file":"README.md","line":111},{"severity":"medium","text":"M2: 'A session cannot borrow your authority by calling the CLI' overstates the existing CLI identity trust boundary. Document normal inherited actor/role checks without a per-session authentication guarantee; the separately filed T-1219 C3 trust issue stays outside this docs task. Do not add reproduction steps.","file":"site/src/content/docs/docs/cli.md","line":13},{"severity":"medium","text":"M3: 'You see it and say go' promises mandatory plan approval although defaultConfig.plan.approval is none. Qualify approval as opt-in consistently in README (also its You crew row), verification-and-release.mdx:262 diagram and landing index.astro You card; retain the correctly conditional crew/concepts explanation.","file":"README.md","line":61}]
finding_counts: {"high":0,"medium":3,"low":0}

# T-783 full source review — not clear
Head d843b1d869d192b7a5db74b5d4464877c463c705; tree 25f467b862d9797c50ebc194cc70b66f49a0ad3a. Fixed point 86449530f6f292a3cad7e4debeeb56d45d9ec498; one documentation commit, 19 files, 395 additions/103 deletions. Scope full; run rev-20261024-783-source-1. Reviewer hold acquired10:00:56; later overlapping holds released by their holders without verdict.

## Standards
No findings. Changes are docs/audit only; no product implementation, role clauses, skills or permanent tests changed. Reviewed all 15 docs pages, README, landing crew/features/FAQ and software-factory claim, with matching source checks for the highlighted configuration/CLI/permissions/defaults/UI boundaries. Both axes reviewed in-session under Reviewer restrictions, without delegation.

The audit separates source/syntax validation from actual runtime evidence, and records known launch owners rather than claiming their external operations passed. This matches Coordinator ae3f5d65. No independent reviewer build/probe was run. Captured local check tail has lint 133/60 report-only and zero refusals; site build captures 23 pages. Static diff check reports only a trailing blank line in the audit, not a behavioral finding.

## Spec
Three medium findings:
M1 README:111 assigns curated skills to skills/. The source-of-truth directory is .agents/skills/ (SKILLS_SOURCE in hub/src/init/skills.ts); skills/ contains provisioning templates. This self-reported omission is independently confirmed.
M2 cli.md:13 says a session cannot borrow human authority by calling the CLI. The source establishes normal environment-derived actor checks, not a per-session authentication guarantee. Qualify this public guarantee; the existing trust issue is separately filed from T-1219 C3 and no authentication fix or reproduction instructions belong in this item.
M3 README:61 and its You crew row, the verification-and-release diagram:262, and the landing You card imply unconditional human plan approval. defaultConfig.plan.approval is none; the corrected crew/concepts pages accurately describe opt-in human approval. Make the remaining claims conditional too.

C1 not met until remaining wrong documentation statements are corrected. C3 remains pending consistent landing wording. C2's agreed evidence boundary is accepted: all 60 shell blocks have original syntaxExit0 records, and commands referencing illustrative items/accounts explicitly need those objects. A-10709 contains isolated init/update/undo and 44 hub-backed command records (43 code 0, one deliberate unsupported-help code2), plus native probe 1/1 receipt 4151.077916ms / runner 4500.084ms. This is local macOS arm64 ad-hoc command evidence, not full suite coverage. The documented first managed-header fixture failure and correction remain attributed as setup, not a product pass. Runtime exceptions accepted by Coordinator remain provider logins, package installs, GUI/phone behavior, cloud provisioning, GitHub publication and T-779/T-780 public installers; no request to repeat those here.

Known T-781 custom roles, T-1221 solo, T-1222 sandbox, T-1223 help and E-1216 qualification stay with their existing owners; they are not new findings duplicated into this task. Their launch receipts remain E-778's responsibility.

Consolidated finding set is M1–M3, no additional findings. Fix together, preserve actual evidence/source attribution, commit/push and request fresh source review. Do not submit configured verification until clear source verdict at the replacement head AND Coordinator restart-done. No configured suite receipt exists for this item yet. QA policy none; no QA claim.

Reviewer used read-only file/Git/artifact inspection and stdlib receipt parsing; no edits, tests, probes, GUI, installs, merge or delegation. Standards 0 findings; Spec 3 medium findings.
Durable source review A-10711.

Criteria: C1 failed (M1–M3 leave incorrect directory, CLI authority and plan-approval statements in the audited documentation.), C3 failed (M3 leaves unconditional plan-approval wording in the landing You card despite opt-in approval.).

### impl-783 · 2026-10-24T10:06:32.357Z

M1–M3 from A-10711 fixed together in 5e16ec8450df9065e1da1e89790825f1a776c854 and pushed. C1/C3 done refreshed. A-10714 supersedes the check table: 173 rows, 60 syntax-checked blocks, earlier isolated receipts attributed to their actual baseline heads, replacement 23-page site build. Root runtime code unchanged from passing root check. Fresh source review requested; no dev merge after first review. Verification still paused by Coordinator restart window.

### rev-26 · 2026-10-24T10:07:10.819Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-783-source-2
commit: 5e16ec8450df9065e1da1e89790825f1a776c854
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-783 replacement source review — clear
Head 5e16ec8450df9065e1da1e89790825f1a776c854; tree fb5101e5ba45436c0bb022c1f2c954a37cfb9c06. Local task and origin refs agree. Fixed point d843b1d8, prior full review A-10711. Scope delta; run rev-20261024-783-source-2; findings [].

## Standards
No findings. Six files change prose, a diagram label and audit provenance only. Product, CLI, role and authentication implementations remain unchanged. Diff whitespace check is clean. Both axes reviewed in-session under Reviewer restrictions.

A-10714 supplies the corrected 173-row audit, all 60 shell-block syntax records with exit 0 and a replacement-tree site build of 23 pages (native build 1.62 s). Its evidence-heads manifest explicitly assigns original help/init receipts to c6abaeb1, hub-command/undo receipts to 3830f7fc, and the root check to the precommit d843b1d8 documentation tree based on 86449530. Those are not claimed as new exact-head runtime runs. The prior check's static guards passed; test lint was report-only with zero refusals. No runtime source changed, so no request to reconstruct or repeat those outputs.

## Spec
M1 resolved: README separates curated .agents/skills/ from provisioning templates in skills/, matching SKILLS_SOURCE and skills/README.md.
M2 resolved: cli.md now describes normal inherited session identity and role checks. The unsupported authentication guarantee is removed, with no authentication change or public reproduction steps. The separately filed trust issue remains separately owned.
M3 resolved: opt-in plan approval is consistent across both README locations, the landing You card, the release-flow diagram and adjacent software-factory lead/FAQ/prose. This matches defaultConfig.plan.approval = none and the crew/concepts explanation.

C1 and C3 are source-verified at this head, carrying the full-page/landing audit forward with these corrections. C2 remains pending final configured receipt settlement under Coordinator ae3f5d65's accepted syntax/source plus isolated-runtime boundary. External logins, installation, GUI/phone behavior, provisioning and publication still require the explicitly listed E-778 launch-owner receipts, not repetition in this docs task. Existing T-779/T-780/T-781/T-1221/T-1222/T-1223/E-1216 gaps remain named; none is silently relabelled as qualified.

Source clearance permits the normal mode-free configured run only after the Coordinator's restart-done notice. The restart pause remains authoritative; this verdict does not lift it. No configured receipt exists yet. A changed head requires fresh source review. QA policy none, no QA claim or merge request.

Reviewer performed read-only source/Git/artifact inspection only: no tests, probes, edits, GUI, installs, merge or delegation. Standards 0 findings; Spec 0 findings.
Durable source review A-10717.

Criteria: C1 verified, C3 verified.

### rev-26 · 2026-10-24T10:26:28.365Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-783-final-1
commit: 5e16ec8450df9065e1da1e89790825f1a776c854
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-783 final evidence settlement
Head 5e16ec8450df9065e1da1e89790825f1a776c854; tree fb5101e5ba45436c0bb022c1f2c954a37cfb9c06. Scope evidence; run rev-20261024-783-final-1; findings []. Source-2 A-10717 remains clear with M1–M3 resolved.

## Standards
Mode-free configured run f50c5c21-5afd-4686-87df-a188da7ec92b / original A-10738 finishes exit 0 at the reviewed head. Deduplicated native records: 2922 ordinary test passes / 422 file passes, no failure, skip or cancellation; no actual load repetitions. T0 host check, T1, fallback all hub/Neovim T2 and actual Web completed. Three test-docs guard cases pass, including exact-path/index and historical-anchor validation.

Linux x64 6.8.0-142-generic droplet c-8 lon1, cland-v0-1db2dcfc; Node24.21.0, Neovim0.12.5; two machine workers, T1 serial/Web four; lifetime600s/$0.0417. T0 host check41.7s and captured output report zero lint refusals. Host gate ae004964b6d0cf72d9fc47b5cbc92f7b9344c09f is a Git tree and was reused remotely, not rerun on Linux. Native suite walls51.82/313.65/133.38s differ from command envelopes/projections; Web shard133.28s. Lint133 findings/60files, duration/tier warnings, five missing baselines and incomplete ratchet-base diagnostics are report-only. No enforcing-budget pass, T3/T4 execution or live GUI evidence claimed.

## Spec
C1/C3 carried forward from the accepted full-page/landing source audit and replacement source review. C2 now settled under Coordinator ae3f5d65's expressly accepted boundary: source/syntax contracts plus isolated command receipts, not a claim that every external command was executed. A-10714 retains the corrected 173-row audit, all60 shell-block syntaxExit0 records, replacement working-tree site build23pages, and original isolated init/update/undo plus44 hub-backed commands (43 successful, one expected unsupported-help refusal). Illustrative IDs/accounts require the objects described on the page.

Original ad-hoc command evidence remains local macOS arm64 at its manifest-named source baselines: help/init c6abaeb1, hub-command/undo3830f7fc; root check precommit d843b1d8 documentation tree based on86449530. The replacement site build and syntax checks were on the correction tree committed as5e16ec84. Product runtime source is unchanged by these docs corrections. The fresh configured result is exact-head Linux evidence; it does not reattribute the older probes or prove provider/network/device operations.

The accepted live launch exceptions remain explicitly pending with E-778: provider authentication, package/public installs (T-779/T-780), GUI/phone/PWA behavior, cloud provisioning and GitHub publication. Known custom-role/solo/sandbox/help/OpenCode qualification owners remain named in the audit. This task's final clear does not settle those owners' launch criteria.

All C1–C3 verified within that accepted scope. No new source findings. Normal post-receipt current-dev conflict check remains the lead's responsibility; prior reported check was clean against63e0e0b0 without merging. Coordinator9f095867 holds merges during the stage covers; this verdict does not lift that hold. QA policy none; no QA or publication requested.

Reviewer used read-only source/Git/artifact inspection and stdlib log parsing only; no tests, probes, edits, installs, browser, merge or delegation. Standards0 findings; Spec0 findings.
Durable final review: A-10741.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-783 · 2026-10-24T10:26:52.581Z

Ready at 5e16ec8450df9065e1da1e89790825f1a776c854 after final evidence verdict rev-20261024-783-final-1 (A-10741); C1–C3 current verified. Mode-free f50c5c21 passed T0/T1/T2/Web on Linux x64 droplet c-8/lon1, 2922 ordinary tests/0 failures; lint and duration gates report-only, no T3/T4 pass claimed. A-10738 log, A-10714 check table/isolated receipts/site build. Conflict check against current origin/dev 44f220a5 is clean (merge-tree 12bfc89a), branch/worktree unchanged and pushed. Ready report sent to Coordinator; awaiting its enqueue after stage-cover merge hold. No merge/publication.

### impl-783 · 2026-10-24T11:02:40.847Z

Gate merge-conflict recovery, authorized by Coordinator 91cdc03f in topic-953: current dev ab77eae3 integrated, both docs commits replayed patch-identically to avoid branch-only merge commits in later marketing publication. New head 16c622dcd859d9c33dfad6f2536b0393171d5485 pushed with guarded force-with-lease; clean worktree. T-1221 Smallest crew retained and audit row marked resolved; T-780 not yet in fetched dev. Site rebuild passes 23 pages on macOS arm64 local. A-10785 replacement table/build receipt; delta source review requested, then fresh mode-free verification and evidence review. Prior 5e16ec84 receipts remain historical, not new-head passes.

### rev-26 · 2026-10-24T11:03:21.208Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-783-source-3
commit: 16c622dcd859d9c33dfad6f2536b0393171d5485
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-783 integration delta source review — clear
Head16c622dcd859d9c33dfad6f2536b0393171d5485; treef7f4ae7d1f0eb78d3d95ed8f74e1328b5ce9e35e. Task/origin refs agree. Scope delta; run rev-20261024-783-source-3; findings[].

## Standards
Coordinator91cdc03f authorized current-dev integration after merge gate8e3cb122 refused old5e16ec84 for conflict. History is now ab77eae3 → a65b8dcd →3ea6fdff →16c622dc; read-only range-diff independently confirms both old docs commits patch-identical to the replayed pair. Current-dev is retained beneath the docs commits, with no branch-only merge commit. Final commit changes only the audit recovery note and T-1221 row. Compared with previously reviewed docs, the only other public-page delta is inherited T-1221 Smallest crew copy.
Whitespace check clean; no test/product/skill/role-clause implementation added by this task. Both axes reviewed in-session under role restrictions.

A-10785 retains integration identity and original replacement-tree local macOS arm64 site-build stdout:23pages, native build1.67s; existing i18n/404 warnings remain. This is site-build evidence, not full suite/runtime or remote evidence. Prior A-10714 command/syntax receipts remain at their original manifest-named baselines, and A-10738 stays historical configured evidence at5e16ec84. None is reattributed to this changed head.

## Spec
Original M1–M3 fixes survive unchanged: curated/provisioning directories, normal CLI identity wording without an authentication guarantee, and conditional human plan approval across README/landing/release diagram/software-factory copy. All15 accepted docs pages remain unchanged from source2; complete prior source audit carries forward.
Inherited landing minimum crew now names one Coordinator and one Implementer, with decisions through the Coordinator, preserving independent verification; the updated audit row accurately records T-1221 as resolved. Both dev and task content retained. Normalization help addition inherited from T-1105 introduces no contradiction in these pages.
C1/C3 source verified at16c622dc. C2 pending fresh same-head configured result under Coordinatorae3f5d65's accepted source/syntax plus isolated-command evidence boundary. Live provider/public-install/GUI/device/cloud/publication launch exceptions remain separately owned; no qualification or stage closure inferred. Known T-781/T-1222/T-1223/E-1216 audit gaps retain their baseline attribution and owners.

No new findings. Proceed with one normal mode-free configured verification at this exact head, result routing to Reviewer and item lead. A changed head needs fresh source review. Coordinator69b4632d has reopened merges/local capacity; lead still follows ordinary ready and current-dev conflict-check procedure. QA policy none/after-stage.
Reviewer used read-only source/Git/artifact inspection only; no edits, tests, probes, browser, installs, merge or delegation. Standards0 findings; Spec0 findings.
Durable delta review A-10786.

Criteria: C1 verified, C3 verified.

### impl-783 · 2026-10-24T11:07:30.410Z

Second gate conflict recovery at Coordinator request a1464eb5: integrated dev9f385c8c incl. T-780, new head4371f90b04f5f2e48590da0a321166e9aa077929 pushed. install.md conflict was equivalent Node requirement; all T-780 install/update/uninstall paths and options retained. README/Quickstart prerequisites and audit command table refreshed. A-10797: 23-page site build on macOS arm64 local, 62 shell syntax passes, updated source audit. Obsolete f99a9462 cancelled (A-10794), not passing evidence. Replacement delta review requested before new mode-free verify.

### rev-26 · 2026-10-24T11:08:47.428Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-783-source-4
commit: 4371f90b04f5f2e48590da0a321166e9aa077929
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-783 installer-integration delta source review — clear
Head4371f90b04f5f2e48590da0a321166e9aa077929; treee31e9dd9b5154686a3cf88f168f9ee6d8653a927. Task/origin refs agree. Scope delta, run rev-20261024-783-source-4; findings[]. Previous source A-10786 at16c622dc carries forward except the inspected installer integration.

## Standards
Coordinatora1464eb5 required dev9f385c8c integration after T-780 landed. Range-diff independently shows the old source-finding fix and prior audit recovery commit unchanged; the first docs patch differs only at equivalent Node requirement context, retaining T-780's installer prerequisite table. Entire T-780 install introduction, prefix/tag/path examples, failure recovery and uninstall instructions retained. Added task edits are README/Quickstart Node/npm prerequisite and audit refresh; no product/test/skill/role changes. Whitespace check clean.
A-10797 retains replacement-tree macOS arm64 site build23pages/native1.66s and62 current shell-block syntax records, allsyntaxExit0. Syntax is not runtime execution; originals remain at their named baselines in A-10714. A-10794 is cancelled143 at16c622dc, not passing evidence: only recorded hostT0 completed, runtime counts unavailable. OriginalA-10738 remains historical5e16ec84.

## Spec
Precise Node >=24.13.0 <25/npm requirement agrees with inherited installer source and package contract. Source checks confirm prefix/tag selection and locked install/build/prune flow; public download, package execution and real-device/provider operations remain accepted E-778 launch exceptions, not repeated by this review.
All previously accepted M1–M3 directory/CLI-identity/conditional-approval fixes and T-1221 Smallest crew survive. The audit now separates shipped installer source from the pending public-install receipt, updates command locations/62-block syntax set and preserves cancellation/source attribution. No incorrect statement or content loss found in the integration.
C1/C3 source verified at4371f90b. C2 remains pending fresh exact-head configured receipt under Coordinatorae3f5d65's accepted syntax/source plus isolated-runtime scope. No new source findings or changed launch exceptions.

Proceed with normal mode-free configured verification at this head, Reviewer/item-lead routing. Preserve each old receipt at its actual head. Fetch/current-dev read-only conflict check remains normal ready procedure (Coordinator requested checking after T-781); any new integration/head change needs fresh review/verify. QA none/after-stage; no QA, stage closure, launch qualification or publication claim.
Both axes in-session under role restrictions: read-only source/Git/artifact/stdlib inspection, no tests, probes, browser, edits, installs, merge or delegation. Standards0 findings; Spec0 findings.
Durable delta review A-10800.

Criteria: C1 verified, C3 verified.

### rev-26 · 2026-10-24T11:22:33.100Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-783-final-2
commit: 4371f90b04f5f2e48590da0a321166e9aa077929
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-783 final installer-integration evidence — clear
Head4371f90b04f5f2e48590da0a321166e9aa077929; treee31e9dd9b5154686a3cf88f168f9ee6d8653a927; task/origin refs agree. Scope evidence; run rev-20261024-783-final-2; findings[]. Source4 A-10800 carries forward.

## Standards
Mode-free runb3a4085f-9830-460f-a7f3-fc4e57c9ce5e / original A-10827 exits0 at reviewed head. Native deduplicated records2929 ordinary test passes/422 file passes; no failure, skip, cancellation or actual load repetitions. T0 host24.198s, T1, fallback all hub+NeovimT2 and actual Web completed. No T3/T4 execution.
Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-ce062718; Node24.21.0/Neovim0.12.5; workers2,T1serial/Web4; machine lifetime731s/$0.0508. Host marker43586540c53af5c17c45febee93e32e93a3cbcdb is a Git tree, reused remotely, not a Linux typecheck repetition.
Native suite walls61.71/372.86/170.06s and Web shard169.92s are separate from command envelopes and projections. Lint133/60, durations/tier wall overages,5missing baselines and incomplete ratchet base are report-only, no enforcing-budget pass.
Three docs guards pass; README fresh-clone/headless smoke passes11.979915241s, retaining its existing report-only budget warning. This supports the isolated smoke only, not all external examples. No new test identities/allowances introduced by this docs task.

## Spec
C1/C3 carry the complete accepted docs/landing audit with M1–M3 fixed, T-1221 Smallest crew and T-780 installer integration retained. Source4 verified the inherited installer instructions and precise Node/npm prerequisite.
C2 now verified within Coordinatorae3f5d65's accepted syntax/source-contract plus isolated-runtime scope: A-10797 has62 current shell blocks with syntaxExit0 and original replacement-tree local macOS arm64 site build23pages/native1.66s; the exact-head configured result is fresh Linux evidence. Prior A-10714 isolated init/update/undo and44 hub-backed command receipts remain at their manifest-named source baselines (43successes, one deliberate unsupported-help refusal), without reconstruction or reattribution. Illustrative IDs/accounts require their described objects.
Public/provider/package installation, GUI/phone/PWA, cloud provisioning and GitHub publication remain explicitly separate E-778 launch-owner receipts. No live execution qualification or native device claim follows from this clear.
A-10738 stays historical green5e16ec84; cancelled143 A-10794 at16c622dc supplies no runtime pass. A-10785 and A-10797 document both authorized integrations and preserve provenance.

AllC1–C3 current verified; no new findings. Final current-dev read-only conflict check and ready report remain lead responsibility; a head change requires review/verify. Coordinator6ab3c902 holds enqueues/local test capacity during new stage covers at95662413; report ready normally, no bypass/merge or stage closure inferred. QA none/after-stage.
Reviewer used read-only Git/source/artifact inspection and stdlib parsing only, no tests/probes/browser/edits/install/merge/delegation. Standards0 findings; Spec0 findings.
Durable final review A-10829.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-783 · 2026-10-24T11:25:17.613Z

Final current-dev conflict recovery at Coordinator75811faf: integrated frozen dev95662413, pushed headd4abd37853d9743531a50efcaf9c421e9ffd4f40. All T-781 custom-role text retained; crew.md command-edit conflict combined both sides. Audit marks custom roles delivered with source checks,63 current shell syntax0; local macOS arm64 site rebuild23pages exit0. A-10832 updated audit/evidence; delta review requested before new mode-free verify. Earlier b3a4085f/A-10827 at4371f90b remains historical.

### rev-26 · 2026-10-24T11:25:40.708Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-783-source-5
commit: d4abd37853d9743531a50efcaf9c421e9ffd4f40
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-783 custom-role integration delta source review — clear
Head d4abd37853d9743531a50efcaf9c421e9ffd4f40; treeb7637e62bfeb8e0579484882ce78f941caeec964. Task/origin refs agree. Scope delta; run rev-20261024-783-source-5; findings[].

## Standards
Coordinator75811faf explicitly required integration of fixed dev95662413 after T-781 landed. Four prior task commits replayed; independent range-diff finds only the expected crew.md command-edit conflict in the first patch, with other3patches identical. Resolution preserves both sandbox/approval/roots/network file-edit guidance and custom role definitions. Entire inherited T-781 custom-role section/config/grant list/examples survives, as do T-780 installer and T-1221 Smallest crew. Added branch-only commit updates audit history/claims/command locations; no task product/test/role/skill implementation changes. Whitespace check clean.

A-10832 retains original local macOSarm64 replacement-tree build23pages/native2.55s and63 current shell-block syntaxExit0 records, independently parsed63/63. Those are site/syntax evidence, not runtime or Linux. Prior A-10827 green at4371f90b is historical and cannot verify the changed head. A-10794 remains cancelled, A-10714 originals retain their manifest baselines.

## Spec
Custom-role docs agree with the inherited implementation already reviewed in T-781/A-10752/A-10764: custom namespace, required clause/harness, valid/reserved names, defaults, manual staffing/no crew pool, fixed exact-grant ceiling and separate built-in authority. The worked example and own-task mode-free verification wording retain the approved restriction; grants do not become built-in verdict/merge authority. Audit accurately marks T-781 delivered without claiming general authentication qualification.
Prior accepted docs/landing audit, M1–M3 fixes, installer prerequisite/instructions and Smallest crew remain intact. No dropped statement or contradictory conflict resolution found.
C1/C3 source verified atd4abd378. C2 pending fresh same-head configured receipt under accepted Coordinatorae3f5d65 syntax/source plus isolated-runtime boundary. External provider/install/device/cloud/publication receipts stay with launch owners; remaining sandbox/help/free-model qualification gaps retain named owners.

Proceed with normal mode-free configured droplet verification at this head with Reviewer/item-lead routing. Coordinator6ab3c902 stage-cover local quiet/enqueue hold remains; source clear lifts neither. Any head change needs fresh review/verify; normal read-only current-dev conflict check remains lead responsibility. QA none/after-stage; no stage closure or launch qualification claimed.
Both axes reviewed in-session through read-only pinned Git/source/artifact inspection and stdlib parsing; no tests, probes, browser, edits, installs, merge or delegation. Standards0 findings; Spec0 findings.
Durable delta review A-10834.

Criteria: C1 verified, C3 verified.

### rev-26 · 2026-10-24T11:43:58.131Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-783-final-3
commit: d4abd37853d9743531a50efcaf9c421e9ffd4f40
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-783 final custom-role-integration evidence — clear
Head d4abd37853d9743531a50efcaf9c421e9ffd4f40; treeb7637e62bfeb8e0579484882ce78f941caeec964; task/origin refs agree. Scope evidence, run rev-20261024-783-final-3; findings[]. Source5 A-10834 carries forward.

## Standards
Mode-free configured run431850de-ebc1-4719-a80d-5d558300e274 / original A-10853 exits0 at reviewed head. Native deduplicated records2945 ordinary test passes/423 file passes; no failure, cancellation, skip or actual load repetitions. T0 host48.171s, T1, fallback all hub+NeovimT2 and actual Web completed; all3 docs guards pass. No T3/T4 execution claimed.
Linux x64 6.8.0-142-generic c-8 lon1 droplet cland-v0-27b05aa7, Node24.21.0/Neovim0.12.5; workers2,T1serial/Web4; lifetime677s/$0.0470. Host marker4f329512a58789d6fb5f54fd99c8a54ef46dfb30 independently resolves to Git tree; reused remotely, not Linux typecheck repetition.
Native suite walls60.42/352.88/153.84s and Web shard153.73s are separate from command envelopes/projections. Lint133/60, tier/duration overages,6missing baselines and incomplete ratchet-base report-only; no enforcing-budget pass. No new test/allowance introduced by this docs task.

## Spec
C1/C3 carry the complete accepted docs/landing source audit, M1–M3 fixes and inspected T-1221/T-780/T-781 integrations. C2 now verified within Coordinatorae3f5d65's expressly accepted syntax/source-contract plus isolated-runtime boundary.
A-10832 current audit retains63 shell syntaxExit0 records and replacement-tree macOSarm64 site build23pages/native2.55s. Fresh configured result supplies exact-head Linux runtime evidence. Older A-10714 isolated init/update/undo and44 hub-backed command receipts remain at their manifest-named baselines (43successful/one deliberately checked unsupported-help refusal); illustrative IDs/accounts require the described objects. No transcription rerun or historical reattribution.
Live provider logins, public/package installs, GUI/phone/PWA, provisioning and GitHub publication remain E-778 launch-owner exceptions. This verdict does not qualify those operations, close stages or settle remaining sandbox/help/free-model owners.
Previous greenA-10738 at5e16ec84, A-10827 at4371f90b and cancelledA-10794 at16c622dc retain their historical identities. Only currentA-10853 settles this replacement head.

AllC1–C3 current verified, no new findings. Lead completes normal read-only current-dev conflict check and ready report. Coordinator6ab3c902 holds enqueues/local test slot for stage covers; this clear lifts neither. Changed head needs review/verify. QA none/after-stage.
Reviewer used read-only source/Git/artifact inspection and stdlib log parsing, no tests, probes, browser, edits, installs, merge or delegation. Standards0 findings; Spec0 findings.
Durable final review A-10854.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-783 · 2026-10-24T11:44:11.702Z

Ready at final headd4abd37853d9743531a50efcaf9c421e9ffd4f40: rev-20261024-783-final-3 clear/C1–C3 verified (A-10854). Exact-head431850de green (A-10853), Linux x64 droplet c-8/lon1, T0 host reused + T1/all fallbackT2/Web,2945 ordinary passes; budgets/lint report-only, no T3/T4 pass claim. Current-dev95662413 conflict check clean (merge-treeb7637e62), worktree clean. A-10832 current audit/build/63syntax records includes T-780/T-781/T-1221. Reported ready to Coordinator; holding claim for enqueue after T-1231 and stage-cover hold.

### coord · 2026-10-24T11:53:35.476Z

Merged 12f25962a439aca333d69742c731e26dd8d61f77 onto dev.
