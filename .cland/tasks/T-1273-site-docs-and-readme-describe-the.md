---
id: T-1273
kind: task
title: "Site, docs and README describe the install paths that work since v0.2.1: Homebrew tap, install.sh with the prebuilt web bundle, source"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-1022
branch: t/T-1273-site-docs-and-readme-describe-the
created: 2026-10-25T06:50:39.988Z
updated: 2026-10-25T07:37:29.508Z
closed: 2026-10-25T07:37:29.508Z
---

## Summary

The human (2026-10-25 ~07:0xZ, relayed by cland-impl): «А обновите тогда на сайте и в доке то как сейчас можно установить cland а то там фейково было». Since v0.2.1 (06:47Z), `brew install kealman/tap/cland` resolves Formula/cland.rb v0.2.1 (tap commit a474f8b7), and `curl -fsSL https://cland.app/install.sh | sh` fetches tag v0.2.1 with the prebuilt cland-web.tar.gz release asset (T-1234). The site and docs still describe Homebrew as pending and pin v0.2.0.

## What to build

One install story everywhere, stating only what works:
- site/src/content/docs/docs/install.md: lines 18–19 say the tap is pending; line 59 pins CLAND_VERSION=v0.2.0.
- site/src/pages/index.astro: line 82 "macOS · Homebrew (pending)"; line 221 "Homebrew tap pending publication. Install from source.".
- site/src/content/docs/docs/quickstart.md: line 22.
- The root README.md and hub/README.md install sections.
- Every docs/ page that names install claims, starting with docs/brand/launch-claims-audit-T-783.md.

Name the brew command exactly, the install.sh one-liner, and the source fallback. Version examples follow the latest release, or say "the latest release" instead of pinning one. Grep for "pending", "tap", "v0.2.0" and "Homebrew" across site/, docs/ and the READMEs, and list every hit with its disposition in the item (rule 20 style). No claim beyond what the release proves: the brew and install.sh commands are recorded as published, and their end-to-end run on clean machines is E-778's DoD demo (C1/C2), not this item.

## Acceptance criteria

- [x] C1. No page in site/, docs/ or the READMEs describes the Homebrew tap as pending or pins v0.2.0 as the current version; a grep for those phrases is clean, and the item lists every remaining hit with its reason (test).
  - done: oc-1273 · 2026-10-25T07:00:34.735Z
  - verified: rev-26 [reviewer] · run rev-20261025-1273-final-1 · 2026-10-25T07:16:47.521Z · commit ed7c86454c926a4eee5d00ada0ba413003f31d1f
  - verified: rev-26 [reviewer] · run rev-20261025-1273-final-2 · 2026-10-25T07:31:51.753Z · commit fafe0432b3c403973d45aa64e91499cd7460c4f0
- [x] C2. The install page, the landing install section and the quickstart give the same three paths with the exact commands `brew install kealman/tap/cland` and `curl -fsSL https://cland.app/install.sh | sh` and the source steps, and the site builds (test).
  - done: oc-1273 · 2026-10-25T07:00:34.940Z
  - verified: rev-26 [reviewer] · run rev-20261025-1273-final-1 · 2026-10-25T07:16:47.521Z · commit ed7c86454c926a4eee5d00ada0ba413003f31d1f
  - verified: rev-26 [reviewer] · run rev-20261025-1273-final-2 · 2026-10-25T07:31:51.753Z · commit fafe0432b3c403973d45aa64e91499cd7460c4f0

## Comments

### oc-1273 · 2026-10-25T07:00:32.309Z

Install claims now match v0.2.1. Head `ed7c8645` on `t/T-1273-site-docs-and-readme-describe-the`.

Changed: `site/src/content/docs/docs/install.md`, `quickstart.md`, `site/src/pages/index.astro`, `README.md`, `hub/README.md`; the install script's help example and legacy comment; the Homebrew publication and test guidance docs; a new T1 contract test and its doc. The install page now states what `install.sh` downloads (tag source tarball, `cland-web.tar.gz` and `.sha256`), its SHA-256, entry-confinement and source-stamp checks, its Node/npm/curl/tar/`mktemp`/`readlink` and Git-for-tag-discovery needs, and its `packaging/build-install.sh` and legacy fallbacks.

Grep dispositions after the edits. Full literal hit list is artifact A-11629 (scope `site/src`, `site/public`, `docs/`, `README.md`, `hub/README.md`; generated `site/dist` and `node_modules` excluded):
- `Homebrew` 29 hits/12 files: the current claims in install.md, quickstart.md, index.astro, README.md and hub/README.md; the Homebrew release-feature and publication docs; the dated T-783 audit; the Homebrew and installer test guidance; and the new test doc. All are current, feature or historical; none says publication is pending.
- `tap` 66 hits/21 files: the published tap in the current pages and release docs; UI gestures (`row.tap`, P25/P27/P28/P32, the phone copy); the hub's runtime log tap; the disposable tap repositories in the Homebrew tests; and `agentsRecord().tap` in T-702 evidence. None describes an unpublished Homebrew tap.
- `v0.2.0` 5 hits/2 files: `docs/brand/launch-claims-audit-T-783.md:3` (the audited baseline) and `:237` (the command block it audited); `docs/spec/v0.2.md:84,95,100` (the v0.2.0 scope, release plan and DoD). All historical; the audit now carries a v0.2.1 later-update note, and no current install surface pins v0.2.0.
- `pending` 140 hits/38 files: none is an install claim. They are runtime states (68 in hub/README.md; 2 pending approvals in workbench.md and sessions.mdx), historical specs/evidence, design proposals, operational agent docs and test guidance. The install pages, READMEs and `install.sh` contain none.
- `install` 351 hits/54 files: the five current install surfaces are updated; the rest are installer implementation and its tests, harness installers, PWA/web installation, release-asset docs and product prose.

Tests and evidence:
- Red: `node --test hub/test/install-claims.test.ts` failed on the pending tap and the missing `packaging/build-install.sh` fact before the edits.
- Green: the same file 3/3 pass (T1, 0.12 s). Also `node --test hub/test/test-docs.test.ts` 3/3 pass for the new per-test doc and index row; `npm run typecheck` exit 0; `lint-closed-item-wording` 0 findings across 249 documents and 1271 items; `lint-repository-tier-plan` exit 0 with the new T1 entry.
- Site build: `npm run build --prefix site` in this worktree, exit 0, 23 pages. The root `site/node_modules` was linked into this worktree; no dependency install ran. The two existing warnings remain (the `i18n` collection is missing/empty; the docs 404 entry is missing). The built `dist` has no pending-tap or v0.2.0 hit and contains all three install commands.

No clean-machine end-to-end Brew or install-script run is claimed here; that is E-778's DoD demo (C1/C2).

### rev-26 · 2026-10-25T07:02:10.300Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1273-source-1
commit: ed7c86454c926a4eee5d00ada0ba413003f31d1f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, Standards 0 / Spec 0 findings; A-11630. Current install/quickstart/landing/README copy matches the three intended paths, exact brew/script commands and source steps. Installer prerequisites/tag/prebuilt/checksum/confinement/stamp/shared-helper/legacy facts match immutable implementation; script changes are help/comments only. New read-only T1 contract, tier and exact guide/index valid. A-11629/item dispositions plus immutable scan place five remaining v0.2.0 hits only in dated audit/spec; no current pending tap claim. C1/C2 runtime evidence remains unverified pending retained original local build/command output and same-head mode-free configured receipt. No clean-machine installer/Homebrew or E-778 demo claim. Respect active Coordinator local-test quiet until superseded.

### rev-26 · 2026-10-25T07:16:47.521Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1273-final-1
commit: ed7c86454c926a4eee5d00ada0ba413003f31d1f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1/C2 verified. A-11633 audits A-11629 inventory/dispositions, A-11631 original local excerpts/build tail and exact-head configured A-11632/run08cf4af6. 3114 ordinary passes/438 file passes; separately three new T1 identities each5/5. Stale-claim scan, identical command/source paths and installer-fact contracts pass; site build retains 23pages/Complete/exit0 with known i18n/404 warnings. Local partial capture/per-command source-hash limits preserved, not complete exact-commit replay. T0/T1/all fallback hub+Neovim T2/Web green; host25.47s/tree47cf680890e552bf0bd1b2368e6bb6e7f778a4fd not remotely repeated. Linux c8lon1/Node24.21/nvim.12.5, HeadlessShell156/v1248; lifetime766s/$0.0532 not wall. Report-only lint133/60, one missing baseline and duration warnings retained. No T3/T4, dedicated changed-tab interaction, clean-machine install, E-778 demo, publication or QA claim. No findings; Coordinator owns enqueue/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T07:29:32.696Z

Published marketing marketing/T-1273-install at 4d80c698b4f49deedf0f68afa70fa46cef85548a (GitHub default branch and site); dev a6f349d992396e719ee2f1549c4c50c1a41b3ccb.

### rev-26 · 2026-10-25T07:30:49.326Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1273-source-2
commit: fafe0432b3c403973d45aa64e91499cd7460c4f0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge-only delta source clear; A-11635, no findings. Coordinator d66a3371 authorized exact dev parent b35cca1e. Parents ed7c8645/b35cca1e, combined diff empty; only two tracker records differ from reviewed head, no nontracker content change. All six public blobs match both reviewed head and dev parent; remaining eight-file dev diff unchanged from source-1. C1/C2/spec scope unchanged. Carry A-11629/A-11631 relevant source/build provenance by unchanged inputs, with original limits; A-11632 stays prior-head configured evidence. Current-head C1/C2 runtime settlement awaits one ordinary mode-free verify then evidence review. No repeat local site build needed solely for this merge.

### rev-26 · 2026-10-25T07:31:51.753Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261025-1273-final-2
commit: fafe0432b3c403973d45aa64e91499cd7460c4f0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final cached evidence clear; C1/C2 verified. A-11638 audits configured run0736c258/A-11636, explicitly cache hit of original08cf4af6/A-11632 at ed7c8645, prepared tree47cf680890e552bf0bd1b2368e6bb6e7f778a4fd; requested headfafe0432 source-cleared in A-11635. No fresh execution/timing. Exact retained finish records:3114 ordinary passes/438 files plus15 load tests/files for three identities5/5. Original T0/T1/all fallback hub+Neovim T2/Web pass; no T3/T4. Source-2 confirms every nontracker input unchanged; carry A-11629 inventory/A-11631 site23pages exit0 with original capture/source limits. A-11637 postmerge local excerpts supplementary. Report-only133/60lint/one baseline/duration warnings retained. Original Linux c8/Node24.21/nvim.12.5/HSh156v1248/lifetime766s/$0.0532 not new execution or wall. No clean-machine, changed-tab interaction, E-778 demo/publication/QA claim. Coordinator owns enqueue/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T07:37:29.508Z

Merged 02219bc242b68fe9b2586652589f1f7aad26caa7 onto dev.
