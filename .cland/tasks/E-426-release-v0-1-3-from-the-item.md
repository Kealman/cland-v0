---
id: E-426
kind: epic
title: Release v0.1.3 from the item
state: open
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by:
  - E-425
topic: null
branch: null
created: 2026-10-14T16:43:18.113Z
updated: 2026-10-16T11:07:35.220Z
---

## Summary

v0.1.3 ships from its release item R-294 once every other epic has closed on its QA demo: an integrated pass across the two lanes, the docs, the notes, the OpenCode check and the dry run close this epic, and the release, its check and the retrospective follow. The release is the build's only push to GitHub.

## Goal

v0.1.3, "Rhythm and rules", ships from its release item: `cland release --item R-294` publishes version 0.1.3 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective artifact records the run, with what the heartbeat, the lane flow and the faster suite changed in it. The paths where the two lanes meet are checked once on the integrated build before the release. The build of v0.2, the web workbench, starts after it.

## Contents

- **The demos** (§4, Definition of done): every other epic of R-294 closed on its QA demo with a clear verdict, run on a droplet through the demo lease where no macOS is needed (§3.4).
- **The integrated pass:** a rulebook commit during an integrated run, which keeps the run; a heartbeat's digest naming a run that never reported on a droplet; the demo lease and the sharded close runs within one remote budget and one daily cap.
- **The docs:** `hub/README.md`, `nvim/README.md`, `docs/agents/tests.md` and the templates `cland init` writes describe v0.1.3 as built: the rulebook, the heartbeat, `follows`, demos on a droplet, the OpenCode database and its check, the suite inputs and the typecheck.
- **The release** (§4): R-294's `## Notes` written from the item and its epics; the OpenCode check of "OpenCode v2 hygiene" run by the `release` skill before the dry run; `cland release --item R-294 --dry-run`, with its notes and version 0.1.3 shown in an ask; `cland release --item R-294`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective:** an artifact of the run.

Not in this epic: findings of the demos or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; T-248, which stays in Tech debt (§4); the build of v0.2, which starts after the release.

Choices where the spec is silent:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-294, as they followed E-273 for v0.1.2.
- **No other open child.** Q-384, the test-speed research question, closes with E-387 or before the dry run, so that no open item other than this epic remains under R-294.
- **The notes** go in R-294's `## Notes`, replacing the backlog note there, written by the Coordinator: the goal; one paragraph per epic on what the human can now do; the run's decisions; the rules recorded during the build; the checks deferred; the known issues filed in the categories.
- **The version** is R-294's recorded 0.1.3. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The OpenCode check.** The `release` skill runs the check against the newest OpenCode 2.x before the dry run. A pass moves the tested range in a commit before the dry run; a failure keeps the range and files a Bug; the notes say which, and neither blocks the release.
- **The suites.** A full suite on the dry run's tip, sharded on droplets as a release run (E-387's release occasion), and one full local run on macOS for the macOS-only cases.
- **The retrospective** is a folder artifact: the report and the script that made it, adapted from v0.1.2's, with the sessions, rounds and cost per epic and per role that the records allow. It adds this release's own numbers: the crew's idle time between epics against v0.1.2's gaps (T-335), the heartbeats fired and what they repaired, the rules recorded during the build, and the suite's wall time and the per-task wait against Q-384's baseline of about 39 minutes per task.
- **Order inside the epic.** The integrated pass, the docs and the notes may start while the last demos run; the dry run waits for every other epic to close.

## Tracer-bullet order

1. **The integrated pass.** The paths across the lanes on `dev`: a rulebook commit during an integrated run, a heartbeat's digest with a run that never reported on a droplet, and the demo lease beside a sharded close run under one budget and cap. Demo: on a scratch `dev`, `cland rule add` while an integrated run is queued leaves the run in place, and its result covers the new head.
2. **The docs.** The READMEs, `docs/agents/tests.md` and `cland init`'s templates checked against the build. Demo: QA follows `hub/README.md` from `cland init` in a fresh scratch project to a recorded rule, a heartbeat at one minute and a `follows` edge, without other help.
3. **The notes, the OpenCode check and the dry run.** R-294's notes, the check against the newest 2.x, the green suites, and `cland release --item R-294 --dry-run` with 0.1.3. Demo: the dry run prints version 0.1.3 and the notes, with every other child of R-294 closed.
4. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item R-294`, and QA's check of the tag. Demo: tag `v0.1.3` is on GitHub `main`, R-294 is closed, and QA's verdict on R-294 is clear.
5. **The retrospective.** After the release: the folder artifact of the run. Demo: the artifact shows the sessions, rounds and cost per epic and per role, the idle time between epics against v0.1.2's, the heartbeats and their repairs, the rules recorded, and the suite's numbers against Q-384's baseline.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it. The human does not run this demo (§4: no human acceptance pass).

In a scratch project, QA queues an integrated run on `dev`, records a rule with `cland rule add`, and reads the run kept and its result covering the new head. With the Coordinator's heartbeat at one minute and a run planted that never reported, the next digest names the run. QA starts a demo lease beside a sharded close run and reads both within `remote_budget` and the daily cap in `cland verify queue` and `cland executor status`. From `cland init` in a fresh scratch project QA follows `hub/README.md` to a recorded rule, a heartbeat and a `follows` edge. In the headless workbench QA reads the rulebook with `␣R`, the heartbeat rows in the events view, and R-294 in the explorer with every other epic closed. On `dev`, `cland task list --under R-294 --state open --json` lists only this epic; QA reads R-294's notes, the OpenCode check's result and `cland release --item R-294 --dry-run` with version 0.1.3, and the latest full suites on that tip, sharded on droplets and local on macOS, are green.

- [ ] C1. Every other epic of R-294 is closed on a clear QA verdict, and no open item other than this epic remains under R-294, Q-384 included.
- [ ] C2. The integrated pass is clear: a rulebook commit during an integrated run keeps the run and its result covers the new head, a heartbeat's digest names a run that never reported, and the demo lease and a sharded close run stay within one remote budget and daily cap.
- [ ] C3. `hub/README.md`, `nvim/README.md`, `docs/agents/tests.md` and the templates `cland init` writes describe v0.1.3 as built, and a fresh `cland init` reaches a recorded rule, a heartbeat and a `follows` edge by following them.
- [ ] C4. The OpenCode check ran against the newest 2.x before the dry run, and the tested range and the notes record what it found.
- [ ] C5. R-294's `## Notes` describe the release by epic, the run's decisions, the rules recorded during the build, the deferred checks and the known issues, and `cland release --item R-294 --dry-run` shows them with version 0.1.3.
- [ ] C6. A full suite is green on the `dev` tip of the dry run, sharded on droplets as a release run, with a local run on macOS for the macOS-only cases.

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-294` on the answer; QA checks that tag `v0.1.3` is on GitHub `main` and records its verdict on R-294; the retrospective artifact follows and is linked from R-294.

## Dogfooding

The release runs on what the build shipped: the release run shards on droplets, the demos run off `dev` on droplets, the Coordinator's heartbeat watches the release steps, the rulebook shapes every clause of the crew, and the human follows the release in the inbox and the events view.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The `opencode` CLI never runs inside a session until T-296 lands. The DigitalOcean token is never stored.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item R-294` is the only push to GitHub in this build.
- **ADRs.** 0004 (Agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (Tracker files are the source of truth): the notes live in R-294's file.
- **Risks.** A refused release (an open child, a dirty root) is fixed before it is retried, never overridden. The OpenCode check reaches the network; its failure keeps the range and never blocks the release.
- **Size.** About two sessions on the v0 scale.
- **Order.** Last: it waits for "OpenCode v2 hygiene" and "Hub hygiene", the ends of the two lanes. These edges stay `blocked_by` after `follows` exists, since the release needs every other epic closed, not only merged.

## Links

- Spec: `docs/spec/v0.1.3.md` on `dev`, §4 (the scope, the definition of done) and §3.4 (demos off `dev`); `docs/spec/v0.1.md` §4 (D16, D19); `docs/spec/v0.1.2.md` §4.
- Tickets: R-294, the release item (T-294 in the spec); Q-384, the test-speed research question; E-273, the v0.1.2 release epic and the model for this one; T-248, in Tech debt.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.
