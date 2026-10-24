---
id: T-780
kind: task
title: The install script at cland.app/install.sh
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-778
blocked_by: []
topic: topic-954
branch: t/T-780-the-install-script-at-cland-app-install
created: 2026-10-18T06:04:23.227Z
updated: 2026-10-24T10:17:41.923Z
---

## Summary

The landing, the README and the install docs tell Linux users to run `curl -fsSL https://cland.app/install.sh | sh`. The script does not exist.

## What to build

`install.sh`, served by the site at `https://cland.app/install.sh` (from `site/public/`), that installs the released cland on Linux and on macOS without Homebrew.

- It installs a released version, not a checkout of `dev`, and states where it put the `cland` command (`docs/install.md` says `command -v cland` shows it).
- It checks for Node 24 (`>=24.13 <25`) and says how to get it when missing, or brings its own runtime.
- Running it again updates cland, as `docs/install.md` says.
- It is POSIX `sh`, prints what it does, and never uses `sudo` silently.

## Acceptance criteria

- [x] C1. Against a local fake release (file:// tarball or local HTTP, sealed scratch HOME and prefix), the script installs a working `cland` from the tag source, including the built web client, without sudo, and prints where it put the command (test).
  - done: impl-780 · 2026-10-24T10:17:12.523Z
- [x] C2. Running the script again against a newer fake release updates the install in place (test).
  - done: impl-780 · 2026-10-24T10:04:02.131Z
- [x] C3. With Node missing or outside `>=24.13 <25`, the script stops before changing anything and says how to get Node 24 (test).
  - done: impl-780 · 2026-10-24T09:53:42.922Z
- [x] C4. docs/install.md describes the paths the script uses and how to remove them (docs).
  - done: impl-780 · 2026-10-24T09:53:43.126Z
  - verified: rev-32 [reviewer] · run rev-20261024-780-source-2 · 2026-10-24T10:05:55.944Z · commit 50ecd66047613b8de9b1b19393c9a6b90646cf9f
  - verified: rev-32 [reviewer] · run rev-20261024-780-source-3 · 2026-10-24T10:17:41.922Z · commit 194873735e27ff64bd78f7e0468193f0976361dd

Landing evidence, not a merge condition: the one-line command on a clean Ubuntu LTS and a clean Fedora droplet, recorded under E-778 C2.

## Comments

### impl-780 · 2026-10-24T09:41:34.209Z

Implementation started. Assigned test seam: POSIX installer CLI against sealed local fake releases with scratch HOME/PREFIX, proving install, update, and Node rejection. Checking release artifact contract because tagged source omits web/dist; clean Ubuntu/Fedora runs remain post-landing evidence per launch brief.

### impl-780 · 2026-10-24T09:53:53.671Z

Source review requested from Reviewer at pushed head 47e6d1028e06d216cafa7e3439956883fea8a7b1 after origin/dev merge. All C1–C4 done. Local macOS arm64 Node24.21: npm run check green (test lint report-only, zero refusals), shellcheck0.11 POSIX clean, targeted T3 installer tests 3/3 green on that head. Source artifact A-10697. Site build skipped because site/node_modules is absent. No publication, release changes, or merge performed.

### rev-32 · 2026-10-24T09:56:42.914Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-780-source
commit: 47e6d1028e06d216cafa7e3439956883fea8a7b1
scope: full
findings: [{"severity":"medium","text":"M1: raw root cleanup plus shell-only execFile timeouts do not stop/drain npm/build descendants before removing their fixture. Use owned command/process-group cleanup and positive close/descendant receipts.","file":"hub/test/install-script.test.ts","line":21},{"severity":"medium","text":"M2: cleanup unconditionally deletes previous after update moves the live tree aside; interruption between publication moves or failed rollback can destroy the old install. Restore or retain the backup until publication commits.","file":"site/public/install.sh","line":49}]
finding_counts: {"high":0,"medium":2,"low":0}

T-780 full source review — not clear

Head 47e6d1028e06d216cafa7e3439956883fea8a7b1; tree 8f440c84871aab5210ba6c85e8ed0b9a2ced8330. Fixed comparison fd834380...47e6d102 (incoming dev parent before first review): seven files, 329 additions/9 removals. Commits 9ab12db2 and pre-review dev merge 47e6d102. Both axes audited personally; role forbids delegation.

## Standards

M1 (medium), hub/test/install-script.test.ts:21,99,123: fixture teardown directly removes the root, while promisified execFile timeouts own only the shell PID. Installer invocations launch npm/build descendants. On timeout/maxBuffer or abnormal termination, shell exit does not establish descendant completion, and shell EXIT cleanup may delete staging while a writer remains. No owned process group, bounded stop/drain or positive descendant receipt precedes directory removal. This violates rule 12 and docs/agents/tests.md:819. Use the repository's owned command/process cleanup with per-command deadlines and stop/close/descendant drainage before removal; retain the final installed-version/build/pruning assertions.

The T3 classification is otherwise appropriate for the actual POSIX installer/native npm/build subject. Test Git/curl boundaries reject real network, local tarballs and offline npm avoid dependency downloads, fixtureEnvironment seals HOME/XDG/Git and applies the shared credential filter after extras. Source build-only dev dependency plus failing prepare establish build-before-prune and ignored lifecycle scripts. Version refusal and update/readback assertions observe actual command/filesystem results rather than launch replies. No independent smell finding.

## Spec

M2 (medium), site/public/install.sh:49,98–101: update moves the only live installation to staging/previous before moving the new source into place. HUP/INT/TERM in that interval invokes cleanup, which unconditionally removes previous, leaving the command dangling. A failed rollback also loses its only backup in that cleanup. Preserve the old tree until publication commits; restore on abort when the live path is absent, and retain/report the backup location if restoration fails. Exercise the held/faulted publication point through the installer and retain a working old-version command assertion. The existing broken-build test proves an earlier failure boundary only. C2 cannot clear while interrupted reruns can remove the previous installation.

C1 source otherwise selects the numerically highest stable vX.Y.Z tag (excluding prereleases), supports explicit version/mirror inputs, downloads the tag archive, builds before pruning, installs a managed prefix and reports its command/PATH. It refuses unmanaged command/directory replacement and never runs sudo.
C3 checks Node >=24.13 <25 before creating prefix/staging or fetching. Missing/bad version yields the Node download guidance; runtime cases remain pending.
C4 source-established: matching install docs describe default/custom command/source paths, rerun update, prerequisites, PATH and removal of both symlink and installation; shared npm cache is identified. Installer --help and hub README match these controls. Release skill/role authority is unchanged; no asset publishing change is claimed. All execution-dependent verification remains pending.

## Evidence and next head

Implementer reports local macOS arm64 Node24.21 npm run check exit0 (lint report-only/zero refusals), three T3 installer cases green and shellcheck0.11 clean. These are implementation reports, not independently run Reviewer tests or a configured/Linux receipt. Source artifact A-10697. Original raw outputs/exits/timings should be retained with exact source/platform provenance without reruns for transcription.
During review the implementer reported a copied-source offline failure: npm prune --package-lock=false attempted registry metadata and reported ENOTCACHED playwright-core. It is preparing ordinary locked prune plus lockfile/mtime preservation; this proposed correction is not yet reviewed at this head. The subsequent site build reportedly succeeded with copied install.sh matching source; retain original evidence and attribute its precise tree.
No configured verification submitted, no clean Ubuntu/Fedora pass claimed. task.view explicitly places clean Ubuntu/Fedora landing evidence under E-778 C2, outside pre-merge acceptance. QA policy none/after-stage.

Complete Reviewer finding set at this head is M1/M2. Correct these plus the disclosed prune change, commit/push and request fresh full source review at the replacement head before mode-free verification; no new dev merge is requested.
Reviewer read-only Git/source/docs/artifacts; no test/probe/installer invocation, files edited, merge, browser or delegation.
Standards: one medium finding. Spec: one medium finding.

Durable audit A-10702: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10702-t-780-initial-full-source-review-at-47e6d102.md

Criteria: C1 failed (Native installer test cleanup does not prove npm/build descendants stopped before deleting the fixture root (rule 12).), C2 failed (Interrupted update or failed rollback can delete the only previous installation and leave the command broken.).

### rev-32 · 2026-10-24T10:05:55.944Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-780-source-2
commit: 50ecd66047613b8de9b1b19393c9a6b90646cf9f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-780 corrected full source review — clear

Head 50ecd66047613b8de9b1b19393c9a6b90646cf9f; tree 4960c5c5f87f3165a98ddc58cb8380502dc7e732. Fixed full comparison fd834380...50ecd660: eight files, 461 additions/10 removals. Corrections d428e2ff and 50ecd660 follow reviewed 47e6d102 without another dev merge. Both axes reviewed personally under the role's no-delegation instruction; initial accepted scope and findings in A-10702 carried.

## Standards

No outstanding findings. M1 resolved: fixture root is canonicalized and registered with ownDirectory; every tar/installer/installed-CLI command uses spawn with detached:true and a separately registered ownProcess. The 1 MiB output limit and per-command watchdog invoke owned process cleanup; completion uses child close, and finally awaits shared owned cleanup before returning. Cleanup registration precedes asynchronous native work. Shared process-cleanup captures process identity/group, drains surviving owned group members/descendants and orders resources before directories. On the product's signal path, staging is retained while npm/build children may unwind, rather than deleted beneath them.

All launches reapply fixtureEnvironment after final explicit fake inputs; HOME/XDG/Git/account/credential isolation remains scratch-owned. Only explicit local release mappings/file URLs reach the curl fake; Git accepts the tag-discovery command only, npm is offline. No installer is run against the live project, shared HOME or credentials. POSIX installer/native npm/build and faulted publication are appropriate T3 lifecycle subjects; manifest/index/note all match.

The deterministic publication seam writes the actual old-move receipt and signals the parent before returning; final restored/backup CLI execution asserts the old version. No sleep, weakened assertion, broad exemption or unrelated abstraction introduced. No independent smell finding.

## Spec

No outstanding findings. M2 resolved: previous remains until command publication commits (published=1). Exit cleanup restores the old tree on an aborted publication; if moving the replacement aside or restoring previous fails, cleanup returns after reporting the preserved backup location rather than deleting it. Interrupted cleanup retains staging. The two new fault controls exercise normal restoration and failed restoration and execute the old command from the live or reported preserved location.

The disclosed prune correction uses ordinary locked npm prune with --omit=dev --ignore-scripts, backing up/restoring package-lock.json via cp -p around build/prune. This preserves the bundle input contents/mtime while avoiding --package-lock=false. The retained fixture assertion checks the build-time lockfile mtime and that the build-only dependency is removed; a failing prepare hook still proves lifecycle suppression. Actual product/copied-source estimates remain separately attributable evidence, not implied by a fake-release source review.

C1 source: highest stable tag discovery, pin/mirror controls, staged install/build/prune, managed source/prefix/command validation and printed path remain as reviewed. Runtime fake-release verification pending.
C2 source: rerun update and failure preservation now include the publication interruption/rollback window; runtime verification pending.
C3 source: absent/unsupported Node refusal is before prefix/staging/fetch writes, with Node24 download guidance. Cases retain missing/22/24.12/25 controls and accepted24.13; runtime verification pending.
C4 verified from source: install docs describe default/custom paths, prerequisites/PATH, rerun update, removal of command and installation, shared npm cache, plus interruption/recovery behavior. Installer --help, hub README and test-specific guidance agree. The site .gitignore change also ignores a node_modules symlink supplied for the site build. No release/role authority changes; no publication performed.

## Evidence and limits

Implementer reports local macOS arm64 Node24.21 targeted T3 5/5 on replacement source, check pass at d428e2ff before the canonical-root-only follow-up, check rerun at50ecd660 pending at request time, shellcheck clean and site build succeeded with supplied dependencies (rebuilding copied script output pending). These reports are not a configured/Linux receipt. Preserve their original command output/exits/native timings with exact source/tree/platform attribution; no rerun for transcription is requested.

Read A-10705: actual superseded-head offline output is “npm error code ENOTCACHED” and “cache mode is 'only-if-cached' but no cached response is available” for playwright-core. It is correctly labelled an incomplete estimate, not a passing install/prune; earlier numeric build/prune estimates are not relabelled as corrected-head evidence. Corrected copied-source estimate is still forthcoming.

C1–C3 remain unverified pending same-head configured evidence and the actual selected T3 installer receipt. C4 verified from this source review only. Coordinator restart pause remains controlling: source clear authorizes verification once that pause is lifted; it does not authorize bypassing the pause. Clean Ubuntu/Fedora cold install remains E-778 C2 landing evidence, not a pre-merge condition; no such pass/full suite/QA claimed. QA policy none/after-stage.

Reviewer read-only source/Git/docs/artifact audit; no tests/probes/installer invocation, edits, merge, browser or delegation.
Standards: zero outstanding findings. Spec: zero outstanding findings.

Durable audit A-10713: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10713-t-780-corrected-source-review-at-50ecd660.md

Criteria: C4 verified.

### rev-32 · 2026-10-24T10:17:01.422Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-780-evidence-1
commit: 50ecd66047613b8de9b1b19393c9a6b90646cf9f
scope: evidence
findings: [{"severity":"medium","text":"M3: new note heading omits hub/test/ and fails the path-derived note filename assertion in test-docs.test.ts. Correct exact repository heading and retain guard; source clearance missed this failure.","file":"docs/agents/tests/hub-test-install-script.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

T-780 failed same-head evidence — not clear
Head50ecd66047613b8de9b1b19393c9a6b90646cf9f; tree4960c5c5f87f3165a98ddc58cb8380502dc7e732. Run1f51afaa-c67f-43e3-ad01-78dda21264e8, original A-10730.

Actual output before classification (lines4727–4742): AssertionError [ERR_ASSERTION]: Expected values to be strictly equal; actual 'hub-test-install-script.test.ts.md', expected 'install-script.test.ts.md', at hub/test/test-docs.test.ts:25. The failing case is “the per-test index links every document to its existing test file”.

## Standards
M3 (medium), docs/agents/tests/hub-test-install-script.test.ts.md:1: heading "# install-script.test.ts" omits hub/test/, so its derived filename differs from the indexed note filename. Set "# hub/test/install-script.test.ts", retaining the existing guard. This is a deterministic new documentation-contract failure. I missed this in the source clearance A-10713; that earlier clearance does not override the failed receipt. M1/M2 corrections remain source-established.

## Spec
C1 cannot receive final verification while the configured task run fails before the installer T3 cases execute. C1 failed pending heading correction, fresh source review and a new same-head configured run. C2/C3 remain runtime unverified; C4's actual install-path/removal documentation remains source-established at this head.

Evidence: Linuxx64 6.8.0-142-generic c-8lon1 cland-v0-18c0a4b8, Node24.21.0/Nvim0.12.5, workers2. Overall exit1. T0 exit0,42.46s; host gate e6e121a29978c6f8d74f66c6a58b031c81cd8cf4 not repeated remotely. T1 829 reported tests,828pass/1fail,0cancel/skip/todo; command59s/measured suite55.25s. File-plan aggregate827 is separate. T2, changedT3 installer and Web did not run; their projections are not observed passes or timings. Generic lint/budgets/ratchet report-only,133findings60files,4missingbaselines/incompletebase. Droplet lifetime154s/$0.0107. No full-suite/QA or cold-OS install pass.

Implementer independently identified the exact heading correction and will preserve the guard, run the direct docs seam and request fresh source review. No unchanged-head retry requested. Reviewer only read logs/source, no tests, edits, installer or browser.
Standards:one medium finding. Spec:C1 blocked by failed configured evidence.
Audit A-10731: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10731-t-780-failed-evidence-and-missed-heading-at-50ecd660.md

Criteria: C1 failed (Configured run fails T1's per-test note filename guard before installer T3 execution; fix the heading and obtain fresh source/configured evidence.).

### rev-32 · 2026-10-24T10:17:41.923Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-780-source-3
commit: 194873735e27ff64bd78f7e0468193f0976361dd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-780 corrected heading source review — clear
Head194873735e27ff64bd78f7e0468193f0976361dd; tree468c3914e36e48dc70315c790d3b74526906e897; parent50ecd66047613b8de9b1b19393c9a6b90646cf9f. Full corrected-source pass carries accepted A-10713 scope and A-10731 failed-evidence finding. Read-only exact parent comparison shows one line changed, no dev merge or installer/test behavior mutation.

## Standards
M3 resolved: "# hub/test/install-script.test.ts" now yields the actual note filename hub-test-install-script.test.ts.md, matches the existing repository test and index row, and satisfies the unchanged guard's exact path contract. No assertion or guard weakened. M1 owned process/drain correction remains unchanged. No findings.

## Spec
M2 rollback/backup preservation, locked prune/mtime restoration, Node-before-write preflight, stable-tag selection/build/reporting and install/removal documentation remain exactly as reviewed in A-10713. C4 source verification renewed at this head. C1–C3 runtime verification pending fresh configured evidence, including the selected T3 installer file; prior failed A-10730 is not reused as green.

Implementer reports direct docs red then3/3 green on local macOS arm64 Node24.21 with unchanged guard; preserve the original output under its actual precommit/corrected-head attribution. A-10716's earlier targeted/check/site and copied-source estimates remain50ecd660 evidence, not this new configured head. No new suite has run yet; no Linux/full-suite/cold-OS/QA pass claimed. Coordinator restart pause lifted, so mode-free verification may proceed at this unchanged reviewed commit. QA policy none/after-stage; Ubuntu/Fedora landing proof remains E-778 C2.

Reviewer only read Git/source/tracker; no tests, edits, browser, installer or delegation.
Standards:zero findings. Spec:zero findings.

Audit A-10734: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10734-t-780-heading-correction-source-review-at-19487373.md

Criteria: C4 verified.
