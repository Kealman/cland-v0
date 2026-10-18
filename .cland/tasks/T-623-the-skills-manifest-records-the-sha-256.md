---
id: T-623
kind: task
title: The skills manifest records the SHA-256 of each file as cland wrote it
state: open
status: ready
size: S
criterion_seq: 6
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by: []
topic: topic-525
branch: t/T-623-the-skills-manifest-records-the-sha-256
created: 2026-10-16T15:57:48.998Z
updated: 2026-10-18T16:57:33.367Z
---

## Summary

Expand `.agents/skills/.cland-manifest.json` so that, for every file of every skill cland installs, it records the SHA-256 of the bytes cland wrote; the manifest from earlier releases, a list of paths per skill, stays readable. `cland update` behaves as today; this ticket only gives the next ones the fact they decide on.

## What to build

`cland init` and `cland update` write the manifest as a map per skill from each file's relative path to the SHA-256 of the bytes cland wrote there, instead of a bare list of paths. A file cland did not write in this run (left as it was because it already held cland's bytes) records the hash of cland's bytes too. A file cland refused to write (a link on its path, a conflict) records no hash of its own: the entry keeps what the previous manifest held for it.

The validation that runs before anything is touched (the mark, the skill names, the relative paths inside the skill's folder) also accepts the hashed form and refuses a malformed one: a hash that is not 64 lowercase hex characters, or a path entry that is neither a list nor a map. The old form, a list of paths per skill, is still read; how update treats it is the last ticket's concern (07), and until then it keeps today's behaviour. `cland doctor`'s skills manifest check accepts both forms. The comments that describe the manifest, ownership per file and the vendored lock in the init code are rewritten for the curated set and the hashed manifest.

## Acceptance criteria

- [x] C1. After `cland init` in a temporary project, every file of every installed skill appears in the manifest with the SHA-256 of its bytes on disk.
  - done: impl-623 · 2026-10-18T16:26:08.837Z
  - verified: rev-30 [reviewer] · run rev-20261018-623-final · 2026-10-18T16:57:29.762Z · commit a4f09152705c72fa8154b10dfc58e80b318b8356
- [x] C2. After `cland update` with a newer set simulated through `CLAND_SKILLS_SOURCE_OVERRIDE`, every rewritten file's hash in the manifest is the SHA-256 of the new bytes.
  - done: impl-623 · 2026-10-18T16:26:10.697Z
  - verified: rev-30 [reviewer] · run rev-20261018-623-final · 2026-10-18T16:57:29.762Z · commit a4f09152705c72fa8154b10dfc58e80b318b8356
- [x] C3. A manifest with a malformed hash or a path entry that is neither a list nor a map is reported invalid by `cland update` and `cland doctor`, and nothing is installed, rewritten or removed.
  - done: impl-623 · 2026-10-18T16:26:12.216Z
  - verified: rev-30 [reviewer] · run rev-20261018-623-final · 2026-10-18T16:57:29.762Z · commit a4f09152705c72fa8154b10dfc58e80b318b8356
- [x] C4. A manifest in the old list form passes `cland doctor`'s skills manifest check and is read by `cland update` without an error.
  - done: impl-623 · 2026-10-18T16:26:13.859Z
  - verified: rev-30 [reviewer] · run rev-20261018-623-final · 2026-10-18T16:57:29.762Z · commit a4f09152705c72fa8154b10dfc58e80b318b8356
- [x] C5. The existing manifest tests (an invalid manifest deletes nothing, symlinks are never written through) pass against the hashed form, extended with the cases of C3 in the same test file.
  - done: impl-623 · 2026-10-18T16:26:14.558Z
  - verified: rev-30 [reviewer] · run rev-20261018-623-final · 2026-10-18T16:57:29.762Z · commit a4f09152705c72fa8154b10dfc58e80b318b8356
- [x] C6. The init code's description of the manifest names neither `skills-lock.json` nor `skills/PATCHES.md` and describes the hashes.
  - done: impl-623 · 2026-10-18T16:26:15.637Z
  - verified: rev-30 [reviewer] · run rev-20261018-623-source · 2026-10-18T16:31:03.187Z · commit a4f09152705c72fa8154b10dfc58e80b318b8356
  - verified: rev-30 [reviewer] · run rev-20261018-623-final · 2026-10-18T16:57:29.762Z · commit a4f09152705c72fa8154b10dfc58e80b318b8356

## Comments

### impl-623 · 2026-10-18T16:21:33.027Z

Implementation started. Seams: init/update output and on-disk manifest in temporary projects; doctor's public skills-manifest check. Existing init.test.ts covers these seams, including invalid-manifest and symlink guards. Following red→green one slice at a time; no live project provisioning.

### rev-30 · 2026-10-18T16:31:03.187Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-623-source
commit: a4f09152705c72fa8154b10dfc58e80b318b8356
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Hash maps and legacy lists share mark/name/path validation; every hash value is validated before skill mutations. Successful/identical-byte writes record source SHA-256; refused updates/removals retain prior ownership/hash, new conflicts remain unowned. Doctor uses shared reader with no array-only consumer. Mixed legacy list retention matches primary0f1cb94c; regression covers later conversion and old-hash preservation. C1–C5 controls retain byte/path/symlink/refusal assertions; A-5426 reports red then init14/14,doctor18/18 and static checks. C6 verified: comments describe curated sources/per-file hashes without retired lock/patch names. Standards/spec:no findings. C1–C5 final verification awaits one exact-head mode-free droplet gate. No Reviewer execution or per-item QA.

Criteria: C6 verified.

### rev-30 · 2026-10-18T16:57:29.762Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-623-final
commit: a4f09152705c72fa8154b10dfc58e80b318b8356
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged a4f09152. A-5468/0df0f0a9 is accepted exit0: 329/330 ordinary passes, zero failures/cancellations, one unrelated OpenCode prerequisite skip; hub selected phases and Neovim smoke complete. All 14 init and 18 doctor identities positively execute, owned legacy/hash control is 5/5, all 17 reported gate groups pass. A-5469 maps C1–C6 and discloses inherited C-326 report-only trip plus budget warnings. No new findings or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
