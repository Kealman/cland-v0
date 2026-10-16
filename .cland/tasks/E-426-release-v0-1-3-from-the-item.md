---
id: E-426
kind: epic
title: Release v0.1.3 from the item
state: closed
criterion_seq: 6
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-294
blocked_by:
  - E-425
topic: topic-372
branch: null
created: 2026-10-14T16:43:18.113Z
updated: 2026-10-16T14:31:16.706Z
closed: 2026-10-16T14:31:16.706Z
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

**Amended 2026-10-16 (the human, ask 6085e249, option 1).** C2's first leg, "a rulebook commit during an integrated run keeps the run and its result covers the new head", is T-379's behaviour and moved with it to v0.1.4, E-579 (D3 there); C2 keeps the heartbeat and the shared-budget legs. A failed OpenCode check files a Bug and does not block v0.1.3: this epic's rule governs over `OPENCODE-CHECK.md` for this release.

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it. The human does not run this demo (§4: no human acceptance pass).

With the Coordinator's heartbeat at one minute and a run planted that never reported, the next digest names the run. QA starts a demo lease beside a sharded close run and reads both within `remote_budget` and the daily cap in `cland verify queue` and `cland executor status`. From `cland init` in a fresh scratch project QA follows `hub/README.md` to a recorded rule, a heartbeat and a `follows` edge. In the headless workbench QA reads the rulebook with `␣R`, the heartbeat rows in the events view, and R-294 in the explorer with every other epic closed. On `dev`, `cland task list --under R-294 --state open --json` lists only this epic; QA reads R-294's notes, the OpenCode check's result and `cland release --item R-294 --dry-run` with version 0.1.3, and the latest full suites on that tip, sharded on droplets and local on macOS, are green.

- [ ] C1. Every other epic of R-294 is closed on a clear QA verdict, and no open item other than this epic remains under R-294, Q-384 included.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-24 · 2026-10-16T14:30:48.793Z · commit 098e6f5a54fd1062bceb59b8c8dc710124230181
- [ ] C2. The integrated pass is clear: a heartbeat's digest names a run that never reported, and the demo lease and a sharded close run stay within one remote budget and daily cap.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-24 · 2026-10-16T14:30:48.793Z · commit 098e6f5a54fd1062bceb59b8c8dc710124230181
- [ ] C3. `hub/README.md`, `nvim/README.md`, `docs/agents/tests.md` and the templates `cland init` writes describe v0.1.3 as built, and a fresh `cland init` reaches a recorded rule, a heartbeat and a `follows` edge by following them.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-24 · 2026-10-16T14:30:48.793Z · commit 098e6f5a54fd1062bceb59b8c8dc710124230181
- [ ] C4. The OpenCode check ran against the newest 2.x before the dry run, and the tested range and the notes record what it found.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-24 · 2026-10-16T14:30:48.793Z · commit 098e6f5a54fd1062bceb59b8c8dc710124230181
- [ ] C5. R-294's `## Notes` describe the release by epic, the run's decisions, the rules recorded during the build, the deferred checks and the known issues, and `cland release --item R-294 --dry-run` shows them with version 0.1.3.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-24 · 2026-10-16T14:30:48.793Z · commit 098e6f5a54fd1062bceb59b8c8dc710124230181
- [ ] C6. A full suite is green on the `dev` tip of the dry run, sharded on droplets as a release run, with a local run on macOS for the macOS-only cases.
  - verified: qa-27 [qa] · run qa-2026-10-16-27-24 · 2026-10-16T14:30:48.793Z · commit 098e6f5a54fd1062bceb59b8c8dc710124230181

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

## Comments

### hub · 2026-10-16T12:46:30.162Z

demo 4f5da6d0-60ae-4e43-9bcc-1af390413566 created: droplet cland-v0-4f5da6d0, commit f771167685528a3f9cefa1b1da51f19612e47d7a, deadline 2026-10-16T13:35:29.522Z.

### hub · 2026-10-16T12:48:31.031Z

demo 4f5da6d0-60ae-4e43-9bcc-1af390413566 destroyed: lifetime 166745 ms; cost $0.0116.

### qa-27 · 2026-10-16T14:30:48.793Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-16-27-24
commit: 098e6f5a54fd1062bceb59b8c8dc710124230181

| Case | Surface | Final result | Observation | Evidence |
| --- | --- | --- | --- | --- |
| G0 | hub-api / local | PASS | Clean detached original S; committed brief/cases; Node24; stripped scratch identity/token. | [G0.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/G0.txt) |
| G1 | hub-api / local | PASS | Final children exactly T-590 and T-606, closed; T-606 merged. Six criteria; R-294 version0.1.3. | [G1-amended-children.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/G1-amended-children.json), [G1-T606.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/G1-T606.json) |
| G2 | hub-api / local | PASS | QA hold taken for this run. | [G1-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/G1-epic.json) |
| G3 | hub-api / local | PASS | Machine locks observed only; remote budget6, daily cap$14. | [G3-locks.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/G3-locks.txt), [G3-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/G3-queue.json) |
| T1 | hub-api / local | PASS | Only E-426 open under R-294; Q-384 closed; E-424/E-482 moved to R-577. | [T1-open.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/T1-open.json), [T1-all.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/T1-all.json) |
| T2 | hub-api / local | PASS | Four other epics closed on clear QA; exact runs/commits below. | [T2-verdicts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/T2-verdicts.json) |
| I0 | hub-api / local | PASS | Scratch integrated control92136509 green and reported. | [I-setup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I-setup.txt), [I-hub-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I-hub-status.json) |
| I1 | hub-api / local | PASS | Queued rulebook-only commit cancels f3e54b8c as amended; no C-mark from this leg. | [I1-queued.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I1-queued.txt), [I1-diff.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I1-diff.txt) |
| I2 | hub-api / local | PASS | Heartbeat names live1af168e2 and past-timeout age94s; needsYou0→0. | [I2-started-at.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I2-started-at.txt), [I2-set.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I2-set.txt) |
| I3 | hub-api / local | PASS | Running rulebook-only commit cancels1af168e2 as amended; no C-mark from this leg. | [I3-rule.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I3-rule.json), [I3-heads.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I3-heads.txt) |
| I4 | hub-api / local | PASS | Scratch hub/fake stopped; zero leftovers. | [I4-cleanup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/I4-cleanup.txt) |
| N1 | hub-api / local | PASS | Fresh init and hub start follow README; isolated local lock/executor. | [N1-N5.sh](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N1-N5.sh), [N1-guard.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N1-guard.txt) |
| N2 | hub-api / local | PASS | Generated heartbeat1h, rulebook high-water, tracked RULES, clauses and demo skill. | [N2-release-files.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N2-release-files.txt), [N-doc-lines.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N-doc-lines.txt) |
| N3 | hub-api / local | PASS | Rule1 One suite: active, scopeall, shell origin, reason/text persisted. | [N3-file.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N3-file.txt), [N3-list.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N3-list.json) |
| N4 | hub-api / local | PASS | Fake Coordinator idle; one-minute heartbeat fires; then off. | [N4-before.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N4-before.txt), [N4-heartbeat.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N4-heartbeat.txt) |
| N5 | hub-api / local | PASS | E-2 followsE-1 in frontmatter/list/view, no blocker. | [N5-first.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N5-first.json), [N5-follows.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N5-follows.txt) |
| N6 | hub-api / local | PASS | Fresh-init hub/fake stopped; zero leftovers. | [N6-leftovers.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N6-leftovers.txt), [N6-stop-hub.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N6-stop-hub.txt) |
| N7 | hub-api / local | PASS | All required matrix cells filled; original stale OpenCode bound FAIL fixed3f57140e and reread. | [N7-amended-range.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N7-amended-range.txt), [N7-fix-commit.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N7-fix-commit.txt) |
| X1 | hub-api / local | PASS | Demo/verification share durable lease count and spend admission; source/docs quoted. | [X1-source.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X1-source.txt) |
| X2 | hub-api / local | PASS | demo.test.ts8/8; no skip/fail. | [X2.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X2.log), [X2-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X2-queue.json) |
| X3 | hub-api / local | PASS | suite-remote-budget.test.ts16/16; no skip/fail. | [X3.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X3.log), [X3-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X3-queue.json) |
| X4 | hub-api / local | PASS | executor-safety.test.ts22/22; no skip/fail. | [X4.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X4.log), [X4-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X4-queue.json) |
| X5 | hub-api / local | PASS | suite-close.test.ts7/7; no skip/fail. | [X5.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X5.log), [X5-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X5-queue.json) |
| X6 | hub-api / local | PASS | heartbeat.test.ts9/9 including remote leases; no skip/fail. | [X6.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X6.log), [X6-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X6-queue.json) |
| X7 | hub-api / local | PASS | Corrected peak3≤6; A-3910 confirms demo+two release shards and spend+reserve<$14; T-589 retained. | [X7-overlap-active.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X7-overlap-active.txt), [X7-overlap-amended.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X7-overlap-amended.txt) |
| D0 | hub-api / droplet | PASS | One lease4f5da6d0 active at f7711676; deadline13:35:29.522Z. | [D0-start.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D0-start.json), [D0-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D0-status.json) |
| D1 | hub-api / droplet | PASS | Both74174bd6 release shards beside demo; A-3910 live capture. | [D1-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D1-queue.json), [D1-queue-during-cases.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D1-queue-during-cases.json) |
| D2 | hub-api / droplet | PASS | Clean f7711676, Node24.21.0, Neovim0.12.5, Linuxx86_64; all UI cases pass. | [D2-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D2-build.txt), [D2-exit.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D2-exit.txt) |
| D3 | hub-api / local | PASS | Stop exit0, released;166745ms;$0.0115795139; destroyed comment. | [D3-stop.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D3-stop.json), [D3-after.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/D3-after.json) |
| W1 | headless-grid / droplet | PASS | RULEBOOK-001: rows, unfold/origin, topic navigation; remote PASS. | [rulebook-rows.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/rulebook-rows.screen.txt), [rulebook-rows.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/rulebook-rows.state.json) |
| W2 | headless-grid / droplet | PASS | EVENTS-001: heartbeat key9, rule filter, needs-you unchanged; remote PASS. | [events-all.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/events-all.screen.txt), [events-all.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/events-all.state.json) |
| W3 | headless-grid / droplet | PASS | EXPLORER-003: R-294 outline, closed epic order/colour, direct tasks/other releases; remote PASS. | [release-v013-outline-200.screen.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/release-v013-outline-200.screen.txt), [release-v013-outline-200.state.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/release-v013-outline-200.state.json) |
| O1 | hub-api / local | PASS | A-3883 OpenCode2.0.30 PASS before root dry run. | [O1-check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/O1-check.txt), [O1-artifact-time.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/O1-artifact-time.txt) |
| O2 | hub-api / local | PASS | Range unchanged>=2.0.24<2.0.31; T-590 evidence-only close accepted. | [O2-range.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/O2-range.txt), [T-T-590.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/T-T-590.json) |
| O3 | hub-api / local | PASS | Notes record OpenCode check and unchanged range. | [O3-notes.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/O3-notes.txt), [O1-check.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/O1-check.txt) |
| R1 | hub-api / local | PASS | Notes committed, decisionsD30–D48, all rules/deferred/issues; byte-preserved. | [R1-notes.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R1-notes.md), [R1-committed.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R1-committed.txt) |
| R2 | hub-api / local | PASS | A-3903 root dry run refuses only E-426. | [R2-root-dry-run.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R2-root-dry-run.txt) |
| R3 | hub-api / local | PASS | Scratch v0.1.3 dry run: exact Notes, five ordered epic deliverables, scratch subjects/ref/commit. | [R3-close-exit.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R3-close-exit.txt), [R3-copied-files.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R3-copied-files.txt) |
| R4 | hub-api / local | PASS | 38 known-issue entries and21 deferred entries checked; incidental references distinguished. | [R4-ids.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R4-ids.json), [R4-judgment.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R4-judgment.txt) |
| S1 | hub-api / local | PASS | A-3918: two-shard release green2333pass,8approvedskips,$0.1291,953.50s. | [S1-final-release.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S1-final-release.txt), [S1-final-skips.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S1-final-skips.json) |
| S2 | hub-api / local | PASS | A-3923:2341pass/0fail/skip/cancel; all8Linuxskips pass. Exit1/T-610 explicitly accepted by human. | [S2-rerun-mac.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S2-rerun-mac.txt), [S2-rerun-skip-matches.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S2-rerun-skip-matches.json) |
| S3 | hub-api / local | PASS | Both final receipt heads exactly098e6f5a54fd1062bceb59b8c8dc710124230181. | [S3-heads.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S3-heads.txt), [F1-amended-diff-v5.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/F1-amended-diff-v5.txt) |
| F1 | hub-api / local | PASS | Freshness.current=true; six authorized changed paths; later dev commit tracker-only; Notes unchanged. | [F1-dev.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/F1-dev.txt), [F1-freeze.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/F1-freeze.txt) |
| F2 | hub-api / local | PASS | Zero owned processes; all eight scratch paths removed to Trash. Build worktree removal follows the verdict. | [F2-leftovers.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/F2-leftovers.txt), [F2-cleanup.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/F2-cleanup.txt) |

Conclusion: clear under the amended brief. 44 final checks pass; all 50 recorder rows, including original failures and amended rows, remain in [runs.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/runs.jsonl). Run `qa-2026-10-16-27-24`. Verdict commit `098e6f5a54fd1062bceb59b8c8dc710124230181`. C1–C6 verified in this run.

## Findings ranked by severity

- **Medium, accepted known issue T-610 (v0.1.4): S2.** A-3923, `cland verify all --executor local` receipt c7e3ba4e: all 2341 tests passed, zero failed/skipped/cancelled, all eight Linux-skipped names passed; final exit is **1**, from `reduceCoverage` at `hub/src/suite-coverage.ts:126`, ENOENT renaming coverage receipt76427 into the merge-checkout bucket. Coordinator diagnosis is reused macOS PID causing double ownership. Human ask97b62790, answer25873fb8 at14:24:00Z option1, relayed by d8442d83, explicitly accepts this receipt as C6’s macOS half. This is an acceptance exception, not a green suite exit. Original S2 failures remain. [Exact error](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S2-rerun-failure.txt), [all eight matches](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S2-rerun-skip-matches.json), [T-610](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/T610-known-issue.txt).
- **Medium, fixed before verdict: S1, T-604.** A-3911’s tests passed but shard2 exited1 on truncated V8 JSON at `hub/src/suite-coverage.ts:130`. Fix c7008358 and allowance rename098e6f5a are present in the final build; A-3918 is green. [Error](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S1-shard2-error.txt).
- **Medium, fixed before verdict: original macOS receipt/T-606.** A-3904 sandbox census inherited NODE_V8_COVERAGE and failed EPERM. T-606 fixed both sandbox helper files; follow-up f7711676 fixed its TS2339 typecheck error seen in A-3907 before droplets. A-3923 passes all sandbox cases. [Initial receipt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S2-initial-red.txt), [typecheck attempt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S1-attempt-ac648ae5-note.txt).
- **Medium, fixed before verdict: N7.** `hub/README.md:1056` said OpenCode<2.1.0 while `ranges.ts:18` uses<2.0.31. Coordinator’s one-line fix3f57140e was reread; final build retains it. [Original mismatch](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N7-range-finding.txt), [corrected line](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/N7-amended-range.txt).
- **Low, known T-589: X7.** The original journal-only helper counted peak9 because six old leases lack release events. Read-only durable records prove they were released hours earlier: 2cc79de9 at01:30:37.800Z; a41b7742 at02:00:13.169Z; c3034303 at02:06:26.508Z;384f2513 at02:28:31.964Z;40502454 at02:25:46.293Z;9285839d at02:29:49.532Z. Amendment3745ab00 allows their terminal timestamps. Corrected peak3 matches A-3910. [Original](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X7-overlap-active.txt), [corrected](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X7-overlap-amended.txt), [durable records](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/X7-six-historical-leases.json).
- **Low, known test flakes retained:** A-3916/T-570 tracker-load timer called a closed database (`store.ts:549`, testline43), not a latency assertion; the authorized replacement A-3918 passed. A-3922/T-581 snapshot count3!=2 at `task-worktrees.test.ts:379`; authorized A-3923 passed. A-3904/T-607 fake Codex account windows6!=4; final macOS test phases passed. [T-570 evidence](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/A-3916-failure-summary.txt), [T-581 evidence](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S2-failure-summary.txt), [T-607](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/T607-known-issue.txt).

## Build and amendments

Local checks used clean detached S=`0e2a0aee87771bc8b3d2f0aa1d548ffa1ca8a7f2`. Remote D/W used `f771167685528a3f9cefa1b1da51f19612e47d7a`. Coordinator677a1ea1 explicitly carries D/W/X7 after T-604; no second lease. Final suite receipts and verdict use S′=`098e6f5a54fd1062bceb59b8c8dc710124230181`. The exact authorized S→S′ diff, under F1 exclusions:

```text
hub/README.md                   | 2 +-
 hub/src/suite-coverage.ts       | 9 ++++++++-
 hub/test/durations.json         | 6 +++---
 hub/test/spawn-census.test.ts   | 3 ++-
 hub/test/suite-coverage.test.ts | 4 +++-
 nvim/test/qa.test.ts            | 2 ++
 6 files changed, 19 insertions(+), 7 deletions(-)
```

Final dev is `0c75bf035c4a1e38631a15154d25cacfd0dcdc71`; its later commit touches tracker records only. Code freeze and R-294 Notes diff are empty; `demo status E-426 --commit S′` reports freshness.current=true. The lease status retains its actual f7711676 commit. No source/tracker fixes were made by QA.

All authorizations and message IDs are in [amendments.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/amendments.txt). Key scope changes: C2’s kept-run leg moved to E-579/T-379; cancellation in I1/I3 is expected and marks no criterion. G1 finally requires closed T-590/T-606; T-590 needs no merge. Notes use D30–D48; D49 is post-release direction. Eight Linux skips are allowed only with macOS passes, including two absent-OpenCode skips. One live demo overlaps release74174bd6; final release receipt may be later by explicit carry. Original N7/S1/S2 failures remain alongside final judgments. S2’s final PASS is the human’s explicit acceptance of exit1/T-610.

## Evidence and accounting

Five serial targeted files:8+16+22+7+9=62pass, zero failures/skips/cancellations, no reruns. Scratch integrated control green; heartbeat names still-running unreported run past timeout, needsYou0→0. Fresh init reaches rule, heartbeat and follows using README commands. Scratch identity and token stripped, independent lock paths, fake harnesses; no root suite/crew/hub mutation or provider calls.

Demo lease `4f5da6d0-60ae-4e43-9bcc-1af390413566`, deadline2026-10-16T13:35:29.522Z, confirmed released; lifetime166745ms; cost$0.01157951388888889. A-3910 at12:47:51Z shows this c-8 lon1 plus release74174bd6 shards114aa561/0a92b565:3active,3tagged,budget6; spend$7.413266875 + reserve$0.708217431 <cap$14. Corrected journal peak3. The helper’s $7.309 subtotal covers same-day-start leases; authoritative host spend is A-3910.

REL_LOG **A-3918**, b663c7dd, S′, full release:2333pass/0fail/8skip; both exits0. Shard1 cland-v0-2c7b5d97,c-8lon1,925.82s,$0.0651; shard2 cland-v0-18012b71,c-8lon1,910.82s,$0.0639. Reported total$0.1291 (rounded shards), wall953.50s. MAC_LOG **A-3923**, c7e3ba4e,S′,darwinarm64 27.0.0,Node24.21.0,Neovim0.12.5:38smoke+1910hub+393Neovim=2341pass,0fail/skip/cancel, exit1 accepted only as stated above. [Linux receipt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S1-final-release.txt), [macOS receipt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/S2-rerun-mac.txt).

OpenCode **A-3883**: neweststable2.0.30 PASS,10wire operations/15event names; range unchanged>=2.0.24<2.0.31 under T-590. Before root dry run **A-3903**, which refuses only E-426. R-294 Notes were byte-preserved in the scratch v0.1.3 preview; expected tag ref, exact scratch dev, five epic deliverables then scratch subjects.38known issue entries and21deferred entries checked. [Preview assertions](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R3-assertions.json), [preview](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R3-preview.txt), [deliverables](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/R3-deliverables.txt).

Historical receipts retained: A-3893 red(T-604/T-605); A-3899 original Linux green; A-3904 red(T-606/T-607); A-3907 typecheck red; A-3911 coverage red; A-3915 T-570/duration allowance red; A-3922 T-581 red. They are not represented as green.

## Closed epic checks

| Epic | State | Closing QA run | Commit | Executor recorded |
| --- | --- | --- | --- | --- |
| E-387 | closed / clear | qa-2026-10-16-27-23 | 62a434cd9f180274e08596a1fd12c8a5f01b23c2 | local macOS under partial-rerun brief; no demo lease |
| E-423 | closed / clear | qa-2026-10-16-27-20 | f6045f838f55902c0224473512e82c1ff0121e72 | droplet Part D + local macOS Part L; lease released |
| E-425 | closed / clear | qa-2026-10-16-27-22 | 133ce00862a55cd6abf246a5df248c1da9af2fc4 | droplet Part D + local macOS Part L; authorized startup retry, both leases released |
| E-468 | closed / clear | qa-2026-10-16-27-19 | 544527784826e12803b6b0111b53025faa7c211a | local macOS under brief; no demo lease |

## Criterion marks

| Criterion | Verified by |
| --- | --- |
| C1 | T1,T2,R2,W3 |
| C2 | I0,I2,X1–X7,W1,W2,D0–D2 |
| C3 | N1–N7, corrected OpenCode cell |
| C4 | O1–O3 |
| C5 | R1–R4 |
| C6 | S1-final,S2-final,S3 under human acceptance97b62790/25873fb8 |

All six are verified in runqa-2026-10-16-27-24. Cleanup: I4/N6/R3 hub stops, F2 zero processes, scratch paths moved to Trash; demo released. Final build worktree removal follows the verdict. [Cleanup](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception/F2-cleanup.txt).

README.md is the final report. Earlier working notes and partial tables in this evidence folder are historical snapshots.

Evidence folder: A-3924 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3924-e-426-qa-run24-at-098e6f5a-evidence-and-accepted-macos-coverage-exception

Published verdict note: A-3925 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3925-e-426-qa-verdict-run24-clear-under-amended-acceptance-c1-c6.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
