---
id: T-625
kind: task
title: cland update removes a dropped skill left untouched and hands an edited one to the project
state: closed
status: done
size: S
criterion_seq: 5
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by:
  - T-624
topic: topic-537
branch: t/T-625-cland-update-removes-a-dropped-skill
created: 2026-10-16T15:57:49.588Z
updated: 2026-10-18T23:25:04.913Z
closed: 2026-10-18T23:25:04.913Z
---

## Summary

A skill the manifest lists but cland's set no longer holds is removed when the project never touched it, and handed to the project when it was edited: kept, taken out of the manifest, and reported, so `cland update` never writes it again.

## What to build

For each skill listed in the manifest that cland no longer ships, update applies the same untouched-or-edited test as for the shipped skills (05).

- **Untouched**: every listed file is removed, with the folders it leaves empty: `removed`, note "no longer in cland's set".
- **Edited**: the folder stays byte for byte, its entry leaves the manifest, and it is reported `kept` with the note "edited in the project; no longer in cland's set". From then on it is a skill of the project's own: a later update never lists, writes or removes it, even if a newer cland ships a skill of that name again.

In a project with its own `.claude/skills/` folder, cland's link to a removed skill goes, and the link to a skill handed to the project stays, since its folder is still there. Today's handling of a link on the skill's path (kept, reported `symlink:`) holds for both cases.

## Acceptance criteria

- [x] C1. With a simulated set that drops a skill the project never edited, `cland update` removes its folder and reports `removed` with the note "no longer in cland's set".
  - verified: rev-30 [reviewer] · run rev-20261018-625-final · 2026-10-18T22:56:47.976Z · commit 83e6cd020dd0f010e1ca0966a38dca3739ca4192
  - done: impl-625 · 2026-10-18T22:57:03.240Z
- [x] C2. With a simulated set that drops a skill the project edited, the folder is left byte for byte, the skill is no longer in the manifest, and it is reported `kept` with the note "edited in the project; no longer in cland's set".
  - verified: rev-30 [reviewer] · run rev-20261018-625-final · 2026-10-18T22:56:47.976Z · commit 83e6cd020dd0f010e1ca0966a38dca3739ca4192
  - done: impl-625 · 2026-10-18T22:57:03.668Z
- [x] C3. A second `cland update` does not mention the handed-over skill, and a simulated set that ships that name again leaves the project's folder as it is.
  - verified: rev-30 [reviewer] · run rev-20261018-625-final · 2026-10-18T22:56:47.976Z · commit 83e6cd020dd0f010e1ca0966a38dca3739ca4192
  - done: impl-625 · 2026-10-18T22:57:03.989Z
- [x] C4. In a project with its own `.claude/skills/` folder, the link to the removed skill is gone and the link to the handed-over skill remains.
  - verified: rev-30 [reviewer] · run rev-20261018-625-final · 2026-10-18T22:56:47.976Z · commit 83e6cd020dd0f010e1ca0966a38dca3739ca4192
  - done: impl-625 · 2026-10-18T22:57:04.412Z
- [x] C5. The update tests cover C1 to C4 in scratch projects with `CLAND_SKILLS_SOURCE_OVERRIDE`.
  - verified: rev-30 [reviewer] · run rev-20261018-625-final · 2026-10-18T22:56:47.976Z · commit 83e6cd020dd0f010e1ca0966a38dca3739ca4192
  - done: impl-625 · 2026-10-18T22:57:04.740Z

## Comments

### impl-625 · 2026-10-18T22:29:19.691Z

Starting test-first at the existing T1 provisionSkills/provisionClaudeSkills seam; scratch CLAND_SKILLS_SOURCE_OVERRIDE and HOME/XDG only. C1 removal, C2–C3 edited handover/re-shipping, C4 Claude links. Legacy lists remain T-626.

### impl-625 · 2026-10-18T22:32:03.530Z

Implementation committed/pushed as 83e6cd02 on t/T-625-cland-update-removes-a-dropped-skill after fetch/merge origin/dev (already current). C1–C5 covered at T1 with isolated scratch source/HOME/XDG; symlink refusal retains original hashes. Host typecheck/lint green; updater 12/12 (0.160s), existing init 13/13 (8.093s), CLI report 1/1 (0.174s). Evidence A-5618. Requesting responsible Reviewer source review before one mode-free droplet verification.

### rev-30 · 2026-10-18T22:32:46.559Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-625-source
commit: 83e6cd020dd0f010e1ca0966a38dca3739ca4192
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 83e6cd02. Whole dropped hashed-skill preflight removes untouched copies, hands edited/missing/added copies to project ownership without changing bytes, and protects repeat/reshipping behavior. Claude links follow target existence; parent/internal symlink refusals retain whole install hashes. A-5619 records both axes, C1–C5 source/test mapping and claimant-reported host check limits. Legacy path-list policy remains T-626. All criteria await accepted exact-head runtime; no findings or per-item QA.

### rev-30 · 2026-10-18T22:56:47.976Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-625-final
commit: 83e6cd020dd0f010e1ca0966a38dca3739ca4192
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged83e6cd02. A-5630/730761b1 acceptedexit0:2320pass,0fail/cancel,5skip; hub plusNeovimsmoke. Five new dropped-skill cases pass ordinary and25/25repetitions; whole updater12/12 andinit13/13. Removal, edited/deleted/added handover, repeat/reshipping, Claude links and symlink controls all established. A-5631 mapsC1–C5, bothaxes and four inheritedreport-only trips. No findings; verifiedall. Claimant done marks still absent in task.view; please restore them against this evidence.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-18T23:25:04.913Z

Merged 666ea9403f0b768505e75769362caf785b2015f7 onto dev.
