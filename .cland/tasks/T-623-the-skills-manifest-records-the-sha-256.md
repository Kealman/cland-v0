---
id: T-623
kind: task
title: The skills manifest records the SHA-256 of each file as cland wrote it
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by: []
topic: topic-525
branch: t/T-623-the-skills-manifest-records-the-sha-256
created: 2026-10-16T15:57:48.998Z
updated: 2026-10-18T16:21:33.028Z
---

## Summary

Expand `.agents/skills/.cland-manifest.json` so that, for every file of every skill cland installs, it records the SHA-256 of the bytes cland wrote; the manifest from earlier releases, a list of paths per skill, stays readable. `cland update` behaves as today; this ticket only gives the next ones the fact they decide on.

## What to build

`cland init` and `cland update` write the manifest as a map per skill from each file's relative path to the SHA-256 of the bytes cland wrote there, instead of a bare list of paths. A file cland did not write in this run (left as it was because it already held cland's bytes) records the hash of cland's bytes too. A file cland refused to write (a link on its path, a conflict) records no hash of its own: the entry keeps what the previous manifest held for it.

The validation that runs before anything is touched (the mark, the skill names, the relative paths inside the skill's folder) also accepts the hashed form and refuses a malformed one: a hash that is not 64 lowercase hex characters, or a path entry that is neither a list nor a map. The old form, a list of paths per skill, is still read; how update treats it is the last ticket's concern (07), and until then it keeps today's behaviour. `cland doctor`'s skills manifest check accepts both forms. The comments that describe the manifest, ownership per file and the vendored lock in the init code are rewritten for the curated set and the hashed manifest.

## Acceptance criteria

- [ ] C1. After `cland init` in a temporary project, every file of every installed skill appears in the manifest with the SHA-256 of its bytes on disk.
- [ ] C2. After `cland update` with a newer set simulated through `CLAND_SKILLS_SOURCE_OVERRIDE`, every rewritten file's hash in the manifest is the SHA-256 of the new bytes.
- [ ] C3. A manifest with a malformed hash or a path entry that is neither a list nor a map is reported invalid by `cland update` and `cland doctor`, and nothing is installed, rewritten or removed.
- [ ] C4. A manifest in the old list form passes `cland doctor`'s skills manifest check and is read by `cland update` without an error.
- [ ] C5. The existing manifest tests (an invalid manifest deletes nothing, symlinks are never written through) pass against the hashed form, extended with the cases of C3 in the same test file.
- [ ] C6. The init code's description of the manifest names neither `skills-lock.json` nor `skills/PATCHES.md` and describes the hashes.

## Comments

### impl-623 · 2026-10-18T16:21:33.027Z

Implementation started. Seams: init/update output and on-disk manifest in temporary projects; doctor's public skills-manifest check. Existing init.test.ts covers these seams, including invalid-manifest and symlink guards. Following red→green one slice at a time; no live project provisioning.
