---
id: E-617
kind: epic
title: Release v0.1.4 from the item
state: open
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by:
  - E-612
  - E-613
  - E-611
  - E-614
  - E-615
  - E-616
  - E-424
  - E-482
  - E-578
  - E-579
topic: null
branch: null
created: 2026-10-16T15:34:18.937Z
updated: 2026-10-20T06:13:16.791Z
---

## Summary

v0.1.4 ships from its release item R-577 once every other epic has closed on its QA demo: two end-to-end demos on this Mac, the newcomer's first page, the green suites, the version bump and the dry run close this epic, and the release, its check and the retrospective follow. The release is the build's only push to GitHub.

## Goal

v0.1.4, "cland on a new project", ships from its release item: `cland release --item R-577` publishes version 0.1.4 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective records the run. Before it, QA takes both paths a newcomer takes, on this Mac, from the first command to a crew at work: an empty folder, and a clone of an existing public repository. The build of v0.2, the web workbench (R-377), follows.

## Contents

- **The demos** (Q-601 resolution 4), run by QA on this Mac with its real harnesses:
  - a fresh folder, then `cland init`, `cland setup` and the onboarding of an empty project, with the Coordinator taking the first task to a merge;
  - a clone of a public repository, then `cland init`, `cland setup` and the onboarding, with the import of its open issues and a first release from "what next".
- **The other epics.** The six theme epics closed on their demos; the carried-over E-424, E-482, E-578 and E-579 done, or re-carried by the human's decision; R-577's own tasks (T-609 and T-610 at this writing) done, moved under an epic, or re-carried.
- **The docs.** `hub/README.md`'s first page, the READMEs, `docs/agents/tests.md` and the templates `cland init` writes describe v0.1.4 as built.
- **The version bump.** An ordinary commit sets the root `package.json` version to 0.1.4 before the dry run, since `cland release` refuses a version that differs (Q-599 resolution 7).
- **The release.** R-577's `## Notes` written from the item and its epics; `cland release --item R-577 --dry-run`, with its notes and version 0.1.4 shown in an ask; `cland release --item R-577`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective**: an artifact of the run, as for v0.1.3.

Not in this epic: findings of the demos or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; the one-command install (deferred, Q-592); the build of v0.2.

As in E-426:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-577.
- **The version** is R-577's recorded 0.1.4. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The suites.** A full suite on the dry run's tip, sharded on droplets as a release run, and one full local run on macOS for the macOS-only cases.
- **The carried-over epics** run in the lanes' gaps, at the Coordinator's discretion (Q-601 resolution 2).

## Tracer-bullet order

1. **The empty-folder demo.** Demo: in a fresh folder on this Mac, `cland init`, `cland setup` and the onboarding lead to a first release, and the Coordinator takes its first task through review and verify to a merge on `dev`.
2. **The existing-project demo.** Demo: in a clone of a public repository, `cland init`, `cland setup` and the onboarding import its open issues and file a first release from "what next".
3. **The docs, the bump, the notes and the dry run.** Demo: the dry run prints version 0.1.4 and the notes, with every other child of R-577 closed and the root `package.json` at 0.1.4.
4. **The release and its check.** After this epic closes: the ask, `cland release --item R-577`, and QA's check of the tag. Demo: tag `v0.1.4` is on GitHub `main`, R-577 is closed, and QA's verdict on R-577 is clear.
5. **The retrospective.** After the release: the artifact of the run.

## Definition of done

QA runs the demo below on `dev` on this Mac, playing the human through a terminal, the `cland` CLI and a headless workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it.

In a fresh folder, QA follows `hub/README.md`'s first page through `cland init` and `cland setup` into the onboarding of an empty project, answers the Aide, gives its ok to the start, and watches the Coordinator take the first task to a merge on `dev`. In a clone of a public repository with open issues, QA follows the same page into the onboarding, confirms the import and reads a first release filed from "what next". On `dev`, `cland task list --under R-577 --state open --json` lists only this epic; QA reads the root `package.json` version, R-577's notes and `cland release --item R-577 --dry-run` with version 0.1.4, and the latest full suites on that tip, sharded on droplets and local on macOS, are green.

- [ ] C1. Every other epic of R-577 is closed on a clear QA verdict, or re-carried by the human's decision, and no open item other than this epic remains under R-577.
- [ ] C2. In a fresh folder on this Mac, `cland init`, `cland setup` and the onboarding of an empty project end with the Coordinator taking the first task to a merge on `dev`.
- [ ] C3. In a clone of a public repository, `cland init`, `cland setup` and the onboarding import its open issues and file a first release from "what next".
- [ ] C4. `hub/README.md`'s first page takes a newcomer from the checkout install to the workbench, and the docs and the templates `cland init` writes describe v0.1.4 as built.
- [ ] C5. The root `package.json` is at 0.1.4 on `dev`, R-577's `## Notes` describe the release by epic, and `cland release --item R-577 --dry-run` shows them with version 0.1.4.
- [ ] C6. A full suite is green on the `dev` tip of the dry run, sharded on droplets as a release run, with a local run on macOS for the macOS-only cases.

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-577` on the answer; QA checks that tag `v0.1.4` is on GitHub `main` and records its verdict on R-577; the retrospective artifact follows and is linked from R-577.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item R-577` is the only push to GitHub in this build.
- **ADRs.** 0004 (Agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (Tracker files are the source of truth): the notes live in R-577's file.
- **Risks.**
  - The demos run this Mac's real harnesses on the human's logins and spend real model calls. The trust step adds the scratch folders to the human's harness configurations, and the accounts question is answered No, so `~/.config/cland/accounts.toml` stays as it is.
  - No demo step pushes to the public repository: its remote is `github`, and only `cland release` pushes there, which never runs in a demo project.
  - A refused release (an open child, a dirty root, a version that differs) is fixed before it is retried, never overridden.
- **Order.** Last: blocked by the six theme epics and by E-424, E-482, E-578 and E-579. These edges stay `blocked_by`, since the release needs every other epic closed, not only merged.

## Links

- Spec: `docs/spec/v0.1.4.md`, §4 (The cut and the definition of done) and §3.8 (Hygiene); `docs/spec/v0.1.md` §4 (D16).
- Items: R-577, the release item; Q-601 (the cut, the lanes and the definition of done); E-426, the v0.1.3 release epic and the model for this one; E-424, E-482, E-578 and E-579, the carried-over epics; T-609 and T-610, R-577's own tasks.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.

## Plan

```yaml
stages:
  - name: release readiness
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-798
      - - T-940
      - - T-941
```

## Comments

### coord · 2026-10-20T05:55:41.133Z

Disposition D75 (stand-in under D24, ask 9b54b5fa, 2026-10-20 ~05:58Z; the stand-in proposed numbering it D74, which E-677 C7 already holds). Applying D71's reasoning, C2 and C3 are demonstrated end to end on fake harnesses:
- C2: a fresh folder → `cland init` → `cland setup` → onboarding of an empty project → the Coordinator takes the first task to a merge on `dev`.
- C3: a clone of a public repository → `cland init` → `cland setup` → onboarding → issue import → a first release filed from "what next".
QA plays the human through the terminal, the CLI and a headless workbench, with the fake Claude, Codex and OpenCode binaries in an isolated HOME. No real model calls; nothing added to the human's own harness configs or trust lists. The live newcomer demos on the human's logins stay the human's choice after the release, offered in the release ask. C1, C4, C5 and C6 are judged as written.
