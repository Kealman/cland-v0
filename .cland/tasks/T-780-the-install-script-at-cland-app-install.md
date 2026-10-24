---
id: T-780
kind: task
title: The install script at cland.app/install.sh
state: open
status: in progress
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
updated: 2026-10-24T09:56:42.914Z
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

- [ ] C1. Against a local fake release (file:// tarball or local HTTP, sealed scratch HOME and prefix), the script installs a working `cland` from the tag source, including the built web client, without sudo, and prints where it put the command (test).
  - failed: rev-32 [reviewer] · 2026-10-24T09:56:42.914Z · note Native installer test cleanup does not prove npm/build descendants stopped before deleting the fixture root (rule 12).
- [ ] C2. Running the script again against a newer fake release updates the install in place (test).
  - failed: rev-32 [reviewer] · 2026-10-24T09:56:42.914Z · note Interrupted update or failed rollback can delete the only previous installation and leave the command broken.
- [x] C3. With Node missing or outside `>=24.13 <25`, the script stops before changing anything and says how to get Node 24 (test).
  - done: impl-780 · 2026-10-24T09:53:42.922Z
- [x] C4. docs/install.md describes the paths the script uses and how to remove them (docs).
  - done: impl-780 · 2026-10-24T09:53:43.126Z

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
