---
id: T-822
kind: task
title: Skills provisioning treats a skill named constructor as still shipped via Object.prototype
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-541
branch: t/T-822-skills-provisioning-treats-a-skill-named
created: 2026-10-18T22:31:42.667Z
updated: 2026-10-19T00:18:25.940Z
---

## Summary

In `hub/src/init/skills.ts`, the dropped-skill loop tests `name in manifest.skills`. A skill named `constructor`, which is a valid name, matches `Object.prototype` even when the new manifest has no own entry for it. So a dropped `constructor` skill skips removal and handover while its ownership entry disappears. Reported by impl-625 while working T-625; the code predates T-625.

## Acceptance criteria

- [x] C1. Manifest membership checks in skills provisioning use own-property tests (`Object.hasOwn` or a Map); a T1 regression with a dropped skill named `constructor` removes it when untouched and hands it over when edited, with bytes and install hashes asserted, and manifests naming `__proto__` or `toString` stay rejected by the existing skill-name validation with bytes and hashes unchanged.
  - done: impl-822 · 2026-10-19T00:09:06.108Z
  - verified: rev-30 [reviewer] · run rev-20261019-822-final · 2026-10-19T00:18:25.440Z · commit faab617d9d79e658a50ef69fb2c936636c21ec99

## Comments

### impl-822 · 2026-10-19T00:07:42.182Z

Implementing at the requested T1 provisionSkills/readManifest seam using scratch source/HOME/XDG. Existing validation permits constructor but rejects __proto__/toString; raised scope clarification to supervising lead. Regression will assert bytes and literal SHA-256 install hashes.

### impl-822 · 2026-10-19T00:09:22.337Z

Committed/pushed faab617d9d79e658a50ef69fb2c936636c21ec99; source review requested from Reviewer in topic-541. A-5665 records both red constructor paths and green 18/18 T1 file (0.243s), plus unchanged rejected-name bytes/hashes. Host npm run typecheck, npm run test:lint and git diff --check passed. Configured mode-free droplet verification follows a clear source verdict; qaPolicy scope none.

### rev-30 · 2026-10-19T00:09:58.166Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-822-source
commit: faab617d9d79e658a50ef69fb2c936636c21ec99
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at faab617d. Final inherited manifest membership test now Object.hasOwn, matching earlier lookup. T1 constructor removal/handover asserts exact bytes, literal hashes, retained unrelated ownership and quiet repeat; __proto__/toString rejection preserves whole snapshots and hashes. Primary name-validation scope confirmed. A-5666 records both axes and claimant host-evidence limits. C1 awaits accepted exact-head runtime; no findings or per-item QA.

### rev-30 · 2026-10-19T00:18:25.440Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-822-final
commit: faab617d9d79e658a50ef69fb2c936636c21ec99
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchangedfaab617d. A-5676/15fb1e73 accepted selected gate:329/329 pass,no fail/cancel/skip; Neovim smoke complete. Constructor untouched/edited nested cases and invalid prototype-name controls execute/pass, both new groups5/5. A-5680 mapsC1 to literal hashes/bytes, own-key removal, repeat stability and unchanged validation, with inherited C-326 trip disclosed. VerifiedC1; no findings.

Criteria: C1 verified.
