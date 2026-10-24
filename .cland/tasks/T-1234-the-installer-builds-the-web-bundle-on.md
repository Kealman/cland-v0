---
id: T-1234
kind: task
title: The installer builds the web bundle on the user's machine instead of using a prebuilt release asset
state: open
status: in progress
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
updated: 2026-10-24T20:52:37.269Z
---

## Summary

T-780's installer (cland.app/install.sh) builds the web bundle on the user's machine from the tagged source tarball: `npm ci --ignore-scripts`, build, prune. A release asset with the prebuilt bundle would make installs faster and keep a build toolchain off users' machines. It changes what `cland release` publishes, so the human decides.

## Acceptance criteria

- [x] C1. The human's choice (prebuilt release asset or keep building from source) is recorded on this item.
  - done: coord · 2026-10-24T18:43:22.686Z
- [ ] C2. If chosen: `cland release` attaches a checksummed prebuilt web bundle, and install.sh uses it after verifying the checksum, falling back to the source build (test).

## Comments

### coord · 2026-10-24T18:43:19.681Z

Human decision 2026-10-24 18:42Z (ask 7a0fd5b1, General): 'Yes, now, as part of E-778' — cland release attaches a checksummed prebuilt web bundle and install.sh uses it, falling back to the source build. Moved under E-778 stage 2.

### impl-1234 · 2026-10-24T20:52:37.269Z

C2 seam/consumer inventory before contract edits: releaseGit and .cland/release.tmp (territory-release.ts); Releases.release/log/item-close (hub/releases.ts); runRelease plain/JSON client; ReleaseResult (release.ts) and direct dispatcher release response; release/homebrew/release-item/demo/scenarios/release-t3-component/suite-release-cache tests and release-support/prepared-project fixtures; shared/wire, web and Neovim have no independent ReleaseResult projection. Add only optional webBundle result/receipt fields; retain existing fields and test an older response without the new field. Config consumers: ProjectConfig/defaultConfig/renderConfig/parseConfig, config CLI typed settings, init/update/provision and config/homebrew tests. Installer consumers: site/public/install.sh, packaging/build-install.sh and Homebrew formula (source build unchanged), install-script tests and docs. Docs/skills/briefs found: hub README, release skill, issue-tracker, install + verification-and-release site docs; historical QA T-117/E-426 use generic release config (new publication remains disabled by default). New opt-in release.web_bundle defaults false, enabled only for this product; no generic project gains npm/gh requirements. Native local bare-remotes + fake asset transport prove publication/recovery; shell installer with mapped local downloads proves checksum acceptance/fallback. No public network writes or browser use.
