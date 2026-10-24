---
id: T-1234
kind: task
title: The installer builds the web bundle on the user's machine instead of using a prebuilt release asset
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-1004
branch: t/T-1234-the-installer-builds-the-web-bundle-on
created: 2026-10-24T11:05:26.095Z
updated: 2026-10-24T21:48:00.836Z
---

## Summary

T-780's installer (cland.app/install.sh) builds the web bundle on the user's machine from the tagged source tarball: `npm ci --ignore-scripts`, build, prune. A release asset with the prebuilt bundle would make installs faster and keep a build toolchain off users' machines. It changes what `cland release` publishes, so the human decides.

## Acceptance criteria

- [x] C1. The human's choice (prebuilt release asset or keep building from source) is recorded on this item.
  - done: coord · 2026-10-24T18:43:22.686Z
  - verified: rev-31 [reviewer] · run rev-20261024-1234-source · 2026-10-24T21:09:10.889Z · commit a27508498bc2c1e24bf550c43c13888a13e0ff88
  - verified: rev-31 [reviewer] · run rev-20261024-1234-authorized-merge · 2026-10-24T21:17:47.988Z · commit a19562ea013a447aa0bd0ffd11166dad0799ed89
  - verified: rev-31 [reviewer] · run rev-20261024-1234-final · 2026-10-24T21:48:00.721Z · commit a19562ea013a447aa0bd0ffd11166dad0799ed89
- [x] C2. If chosen: `cland release` attaches a checksummed prebuilt web bundle, and install.sh uses it after verifying the checksum, falling back to the source build (test).
  - done: impl-1234 · 2026-10-24T21:05:38.105Z
  - verified: rev-31 [reviewer] · run rev-20261024-1234-final · 2026-10-24T21:48:00.721Z · commit a19562ea013a447aa0bd0ffd11166dad0799ed89

## Comments

### coord · 2026-10-24T18:43:19.681Z

Human decision 2026-10-24 18:42Z (ask 7a0fd5b1, General): 'Yes, now, as part of E-778' — cland release attaches a checksummed prebuilt web bundle and install.sh uses it, falling back to the source build. Moved under E-778 stage 2.

### impl-1234 · 2026-10-24T20:52:37.269Z

C2 seam/consumer inventory before contract edits: releaseGit and .cland/release.tmp (territory-release.ts); Releases.release/log/item-close (hub/releases.ts); runRelease plain/JSON client; ReleaseResult (release.ts) and direct dispatcher release response; release/homebrew/release-item/demo/scenarios/release-t3-component/suite-release-cache tests and release-support/prepared-project fixtures; shared/wire, web and Neovim have no independent ReleaseResult projection. Add only optional webBundle result/receipt fields; retain existing fields and test an older response without the new field. Config consumers: ProjectConfig/defaultConfig/renderConfig/parseConfig, config CLI typed settings, init/update/provision and config/homebrew tests. Installer consumers: site/public/install.sh, packaging/build-install.sh and Homebrew formula (source build unchanged), install-script tests and docs. Docs/skills/briefs found: hub README, release skill, issue-tracker, install + verification-and-release site docs; historical QA T-117/E-426 use generic release config (new publication remains disabled by default). New opt-in release.web_bundle defaults false, enabled only for this product; no generic project gains npm/gh requirements. Native local bare-remotes + fake asset transport prove publication/recovery; shell installer with mapped local downloads proves checksum acceptance/fallback. No public network writes or browser use.

### impl-1234 · 2026-10-24T21:02:48.053Z

Consumer audit completion: production config consumers searched include init/config{,-set}, provision, cli/config/qa-fixture, hub/configuration/daemon/dispatch/demos/suites, adapters/index/sessions, executor/{executor,droplet/droplet,droplet/run}, doctor/{project,web}, setup/steps/{accounts,harnesses}, suite-limits/selection, verification-commands, offline-migrate. Only config's new optional/defaulted webBundle member and release owner consume it; unrelated config consumers retain their existing fields. Release reply/receipt consumers are territory-release, Releases.release, runRelease, dispatch.publishRelease injection, and tracker/offline-migrate (presence-only pending-receipt guard, unchanged). Existing native release/homebrew/release-item tests and QA T-117/E-426 use default-off fixture config/legacy receipts, so keep prior behavior. Web/Neovim/shared wire have no independent typed release response. Tests across every tier searched by releaseGit, ReleaseResult, release.tmp, release.homebrew and installer/build helper names; new T3 covers exact assets/recovery, T1 covers old response shape; all prior fields remain. New cache ignore is in project.GITIGNORE and root .gitignore; config-set derives writable vocabulary from renderConfig automatically. Current T0 lint caught only new tiers.json entry sort order, now corrected; no shared-defect candidate.

### rev-31 · 2026-10-24T21:09:10.889Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1234-source
commit: a27508498bc2c1e24bf550c43c13888a13e0ff88
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1234 full source review — CLEAR

Reviewed branch t/T-1234-the-installer-builds-the-web-bundle-on at a27508498bc2c1e24bf550c43c13888a13e0ff88; Git tree 0ecdb8e5d950e23ded252b5e471d49145bb68b13. Fixed parent/base c6bc05cdc7b832f7aaa0ddeb762498594f8cc32a. Origin task ref resolves to the reviewed commit. Reviewed all 26 changed files and relevant existing release, build-stamp, process/fixture, help and clause consumers. Read-only source review: no tests, build, installer, browser, public endpoint, fetch or Git mutation executed by Reviewer.

## Standards

No findings.

The item records the shared-contract consumer inventory across production configuration/release owners, CLI, persisted receipt readers, clients, skills/QA fixtures and tests at all tiers. Source searches agree with the identified owners. Config parsing defaults the new setting off; only cland's committed config opts in. ReleaseResult and recovery receipts keep previous fields and add optional Web data. The new T1 previous-wire-shape client regression reads the old response without webBundle.

Native tests remain T3 and use prepared disposable repositories, shared fixtureEnvironment after overlays, offline npm and in-process asset transport. Installer launches retain owned-process cleanup, bounded output/deadlines and exit/signal diagnostics. No public gh release endpoint is used by the tests. Pure rendering/config/compatibility tests remain T1. The new canonical test guide and index row describe the native file; installer guide is updated. No new keyboard action is involved.

Matching changes cover CLI usage/frozen composition, hub README, site install/release docs, agent tracker guidance, release skill and both Coordinator clauses. The release skill is project-owned (no kept-upstream metadata), so the upstream CHANGES requirement is not applicable. Existing command-help parsing excludes all colon-labelled annotation tokens, including the new release annotation. Existing clause predicates remain consistent with the replaced approval sentence.

The production gh boundary uses existing authentication through environment/keychain, no token argument, fixed github.com host and disabled prompts. Its caught command diagnostics omit stdout/stderr. Initial release preparation checks gh before asset building/product push. The isolated build comes from Git's immutable archive; the commit cache and checksum readback preserve approved bytes. Build roots are retained rather than deleted beneath possible native descendants.

## Spec

No findings.

C1 is established from the item's recorded human decision, cited by Coordinator to ask 7a0fd5b1 on 2026-10-24: implement this now within E-778. The subsequent Coordinator constraints in topic-1004 are accounted for: dry-run names repository/tag, filenames, byte sizes and archive SHA-256; authenticated gh is preflighted before the approval; documentation states that prerequisite; no test contacts GitHub.

C2 is implemented in source but remains runtime-dependent and unverified here:
- Committed opt-in config controls publication. Dry-run builds/checks the pinned source stamp and previews exact cached archive/checksum facts. Live release uses the cached commit bytes.
- Atomic product/tag Git push remains separate. Durable release.tmp retains the Web plan; follow-up errors name web-bundle and prevent successful closure. Recovery uses the original receipt even after dev/config moves.
- Publication lists Releases rather than treating arbitrary API errors as absence, creates a draft when needed, uploads missing assets, downloads and compares exact remote bytes, refuses conflicting assets and publishes only after successful readback. Final metadata must show both assets and a non-draft Release.
- Installer downloads matching tag assets, validates exact SHA-256 content, rejects nonordinary or escaping archive entries before extraction, and requires a source-matching build stamp. Verified assets select runtime-only locked dependency installation with preserved lockfile/mtime.
- Missing, bad-checksum or wrong-source assets select the existing locked source fallback; custom source URLs do not implicitly fetch GitHub assets. Legacy tags without the shared build helper retain their previous path. Homebrew continues source building.

The new tests encode default-off/type/round-trip behavior, old reply compatibility, preview-before-push/auth failure, pinned recovery after lost replies, immutable-source/cache facts, idempotent exact remote readback/conflict refusal, valid-asset installation with a deliberately failing source build, and missing/bad/wrong-source fallback with working installed commands and lock/prune facts.

## Evidence and next gate

A-11443 is local implementation/TDD summary, not a complete original command-output receipt. It reports Darwin arm64/Node 24.21.0 local homebrew 4/4, publication 2/2 and installer 10/10 before the final metadata-readback addition; typecheck/static results are separately reported. No browser binary was used. No exact-head native rerun, configured task suite, Linux result or final runtime verification is inferred.

The final native publication rerun was refused by cover-quiet 242e7c14-56a7-4f01-8cba-1cc731d415e5 before fixtures. Coordinator explicitly allowed source review while that slot remains occupied and will announce its release. That refusal remains a non-execution, not a pass or failure. Respect the slot restriction; do not route around it.

Source CLEAR at this exact head; verify C1 only. C2 stays unverified until same-head configured evidence and the missing native proof are reviewed. After the Coordinator releases the local slot, perform its authorized single native-file rerun, and submit one ordinary configured mode-free cland verify at the unchanged reviewed head (subject to hosting admission). Then request evidence review with the original receipts, actual selected phases/absences and gate modes. Preserve available original stdout/exits/native timings with source/platform and missing-record limits; do not rerun commands merely to reconstruct evidence.

Standards: 0 findings. Spec: 0 findings. This is source clearance, not final runtime settlement.
Durable review A-11448.

Criteria: C1 verified.

### rev-31 · 2026-10-24T21:17:47.988Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1234-authorized-merge
commit: a19562ea013a447aa0bd0ffd11166dad0799ed89
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1234 authorized merge-only delta — CLEAR

Reviewed a19562ea013a447aa0bd0ffd11166dad0799ed89, tree 5a111e85fcfb98b6d8ced963597cedc206482d98. Parents exactly a27508498bc2c1e24bf550c43c13888a13e0ff88 (full source clear A-11448) and Coordinator-authorized dev 5205aeb68c1e9f5b8978afbbe9c18e8a6a103dde. Common base c6bc05cdc7b832f7aaa0ddeb762498594f8cc32a. Authorization d92e1365 in Agents was read; no additional integration is covered.

## Standards

No new findings. No combined conflict-resolution diff. All 25 nonoverlapping task-owned files match the accepted first parent byte-for-byte, including release implementation/config/result/receipt boundaries, POSIX installer, tests, tiers/help/frozen fixture, skills/clauses and docs. All 11 nonoverlapping incoming files match dev byte-for-byte. Their scope is independently landed OpenCode default/fallback behavior, associated fixtures/tests/guides and duration identities.

The sole overlapping path is hub/README.md. Its first-parent-to-merge diff contains only the upstream OpenCode section. The second-parent-to-merge diff contains only the already reviewed T-1234 installer/release documentation changes. Both independent sections survive; no source behavior or conflict choice is added.

The full duration manifest matches dev blob 3754dbb207e40b77433a092a9b52000de93a47a0. This task's previous source head already included c6bc05cd/E-880 allowance ownership. The merge retains every dev entry and makes no task-picked duration adjustment. This is a merge integration review, not an independent full audit of previously landed OpenCode work.

## Spec

No new findings. Full source audit A-11448, including consumer compatibility, no-token-argv/auth preflight, immutable build/cache, draft/upload/readback/retry and verified-installer/source-fallback behavior, remains applicable because those source blobs are unchanged. Reverify recorded human decision C1 at this head; C2 remains runtime-dependent and unverified.

## Evidence and disposition

A-11469 attributes root typecheck exit 0 to this merge head on macOS/local, Node 24.21.0, covering hub/Neovim/shared wire/Web and colour/contrast/HTML/hooks checks. This note is summary rather than full original stdout; no overall wall time is inferred. No browser ran. No native test rerun or configured runtime result exists at this head. A-11443's original local passes retain their pre-final-readback source limitations.

Source delta CLEAR; no final runtime clearance. Respect the Coordinator's active cover-quiet. After its explicit slot-free notice, perform the authorized single native publication-file rerun, then one ordinary configured mode-free verify at this unchanged head and request evidence review. Report original output/exit/source/native timing limits and actual selected phases/executor/platform/browser/gates; never reconstruct missing evidence by rerunning for transcription. No extra dev merge is authorized.

Reviewer ran no tests, builds, captures or Git mutations. Standards delta: 0 findings. Spec delta: 0 findings.
Durable review A-11473.

Criteria: C1 verified.

### rev-31 · 2026-10-24T21:48:00.721Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-1234-final
commit: a19562ea013a447aa0bd0ffd11166dad0799ed89
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1234 final same-head evidence — CLEAR

Head a19562ea013a447aa0bd0ffd11166dad0799ed89 / tree5a111e85fcfb98b6d8ced963597cedc206482d98, source A-11448 plus authorized merge A-11473. Original configured run213c674f-9cd3-4340-af20-b52ca4b5df27/A-11497 exits0; task.view confirms finished/passed at that exact head. No changed source or additional integration is covered.

Parsed unique terminal test identities, excluding file containers:3077ordinary passes plus10separate load-gate passes, no fail/cancel/skip/todo. Required C2 outcomes checked independently of aggregate exit:
- pinned checksummed assets before push/lost-upload retry:1.197874568s pass.
- immutable pinned build/reusable checksum/idempotent exact remote readback:0.965196390s pass.
- valid tag asset/runtime-only install despite deliberately failing source build:0.942241110s pass.
- locked source fallback for missing checksum1.121010657s, bad checksum1.191246460s and wrong sources1.311050017s, all pass.
- six original installer Node rejection/update/build-failure/legacy/interruption/rollback cases all pass.
- T1 opt-in/default/round-trip config0.001175983s and previous-wire-response compatibility0.000245346s pass; each also has5/5load passes (worst0.009217980s/0.001969707s respectively).

The two changed T3 files are install-script.test.ts and web-release-publication.test.ts:12passing identities, one base execution each/no repetitions. The selected duration receipt reports17.400s added wall excluding machine wait. Native fixture-only Git/npm/asset transport exercises behavior without contacting GitHub or publishing a real Release.

## Actual execution and provenance

Mode-free auto/effective full: T0host check exit0/27.843s; allT1 exit0/74s; fallback-all hub+Neovim T2 exit0/406s; changedT3 exit0/22s; Web exit0/182s. Unsupported skill coverage caused all-T2 fallback. Remaining T3 and allT4 did not run; remaining T3 is deferred to periodic/integrated occasions and absent configured batch tiers. No all-T3/T4, stage or QA cover is claimed.

Linux x64 6.8.0-142-generic droplet c-8lon1/cland-v0-4dedaea1,2workers. Prepare explicitly installs Chrome Headless Shell156.0.8078.4/revision1248/linux64 under /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248 for Web fixtures. Delivered metadata omits trailing runtime-version/lifetime/cost fields; machine lifetime and cost are unavailable, not zero or estimates. The host check's gate tree edc935206404434257eb22c8f0a78dddaa090fa1 is reused remotely, not a different task head or repeated remote typecheck.

Phase envelopes, native case times, selectedT3wall and projections are distinct. Web actual suite176.98s exceeds40s report-only budget; numerous existing Web/T1/T2 overages and133lint findings/60files remain report-only. New publication file has no baseline (observed2.163s), not zero. T3 ratchet2203.867s vs2197.138s is +6.729s and explicitly 'would refuse growth' in report mode; retain for Coordinator landing planning, do not claim a ratchet pass or invent an allowance. Actual enforced admission/new-identity checks did pass.

A-11478 closes the previously missing final native-file proof after Coordinator slot-free notice: exact merged head, macOSarm64/local Node24.21.0/no browser, two publication cases2489.274209ms/880.886875ms, exit0,2/2, Node file3717.6895ms. Bare remotes/offline npm/fake asset transport only. It is original returned output, not a transcription rerun or full real-product installation benchmark. A-11500 preserves runtime selection and unavailable metadata; earlier A-11443 remains partial implementation evidence at its original source.

## Final disposition

CLEAR, C1/C2 verified across recorded human decision, accepted source and same-head native/configured evidence. No findings or per-item QA requirement. No public GitHub write, human release approval, actual release or clean-OS install is asserted by this task evidence.

Report fresh no-auto-maintenance dev conflict check and unchanged-head readiness to Coordinator for enqueue, retaining the +6.729s report-only T3 growth for planning. No extra rerun, source edit or dev merge is requested. Reviewer performed read-only source/artifact/tracker inspection only.
Durable final review A-11505.

Criteria: C1 verified, C2 verified.
