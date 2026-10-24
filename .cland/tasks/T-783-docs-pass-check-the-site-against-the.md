---
id: T-783
kind: task
title: "Docs pass: check the site against the shipped behaviour"
state: open
status: review
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
updated: 2026-10-24T10:07:10.819Z
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
- [x] C2. Each command shown in a code block runs as shown on a fresh project
  - done: impl-783 · 2026-10-24T10:00:17.716Z
- [x] C3. The landing's claims (crew section, features, FAQ) are checked the same way
  - done: impl-783 · 2026-10-24T10:06:21.413Z
  - verified: rev-26 [reviewer] · run rev-20261024-783-source-2 · 2026-10-24T10:07:10.819Z · commit 5e16ec8450df9065e1da1e89790825f1a776c854

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
