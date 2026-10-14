---
id: E-420
kind: epic
title: Release v0.2.0 from the item
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-414
  - E-418
  - E-419
topic: null
branch: null
created: 2026-10-14T15:59:26.349Z
updated: 2026-10-14T16:00:04.202Z
---

## Summary

v0.2.0 ships from its release item R-377 once every other epic has closed on its QA demo: an integrated pass over the paths that cross the two lanes, the docs, the notes and the dry run close this epic, and the release, its check and the retrospective follow. The release is the build's only push to GitHub.

## Goal

v0.2, the web workbench, ships from its release item: `cland release --item R-377` publishes version 0.2.0 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective artifact records the run. The paths that no single epic's demo covers, where the hub lane meets the web lane, are checked once on the integrated build before the release.

## Contents

- **The demos** (§4, Definition of done): every other epic of R-377 closed on its QA demo with a clear verdict, the web phase included in headless Chromium.
- **The integrated pass:** a relayed approval answered from the web's inbox and from a session's drawer; one gate across a desktop context, a phone context and Neovim; the read marks agreeing between Neovim and two browsers; a phone context resuming after a hub restart.
- **The docs:** the tunnel guide, written with E-419, checked against the built release; the web workbench's README (`web/README.md`, as `nvim/README.md` is Neovim's); and the web edge's section in `hub/README.md`.
- **The release** (§4): R-377's `## Notes` written from the item and its epics; `cland release --item R-377 --dry-run`, with its notes and version 0.2.0 shown in an ask; `cland release --item R-377`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective:** an artifact of the run.

Not in this epic: findings of the demos or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; the deferrals of §4 (a terminal in the browser, mouse edits, a home page over several projects, push with the page closed, Neovim adopting the snapshot and the deltas, a read-only view for another person), which wait for 0.2.x.

Choices where the spec is silent:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-377, as they followed E-273 for v0.1.2.
- **The notes** go in R-377's `## Notes`, written by the Coordinator: the goal; one paragraph per epic on what the human can now do in the browser; the run's decisions; the deferrals to 0.2.x; the checks deferred; the known issues filed in the categories.
- **The version** is R-377's recorded 0.2.0. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The suites.** A full suite with the web phase on the dry run's tip, on droplets, and one full local run on macOS for the macOS-only cases.
- **The retrospective** is a folder artifact: the report and the script that made it, adapted from v0.1.2's, with the sessions, rounds and cost per epic and per role that the records allow, and the web's own numbers: the web phase's time on a full run, the bundle's size, the snapshot's size and the first full tree's time on the live tracker, against the prototype's. What the human reported from the phone goes in as the human said it.

## Tracer-bullet order

1. **The integrated pass.** The paths across the lanes on `dev`: the relayed approval in the web, one gate across a desktop context, a phone context and Neovim, the read marks, and the phone's resume. Demo: a fake Codex approval answered in a phone context folds in a desktop context's inbox and in Neovim's within a second.
2. **The docs.** The tunnel guide and the web README checked against the build, and the web edge in `hub/README.md`. Demo: QA follows `web/README.md` from a fresh clone to a signed-in browser without other help.
3. **The notes and the dry run.** R-377's notes, the green suites, and `cland release --item R-377 --dry-run` with 0.2.0. Demo: the dry run prints version 0.2.0 and the notes, with every other epic of R-377 closed.
4. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item R-377`, and QA's check of the tag. Demo: tag `v0.2.0` is on GitHub `main`, R-377 is closed, and QA's verdict on R-377 is clear.
5. **The retrospective.** After the release: the folder artifact of the run. Demo: the artifact shows the sessions, rounds and cost per epic and per role, and the web's own numbers against the prototype's.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, headless Chromium and a headless Neovim workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project with the fake harnesses, QA opens a desktop context at 1440x900 and a phone context at 390x844 beside the headless Neovim workbench. A fake Codex session's approval is answered in the phone context and folds in the desktop context's inbox and in Neovim's; another fake Codex approval is approved from the session's drawer; two contexts answer one ask at once and both read one outcome; a topic read in Neovim reads as read in both contexts; the phone context resumes after a hub restart. From a fresh clone QA follows `web/README.md` to a signed-in browser. On `dev`, `cland task list --under R-377 --state open --json` lists only this epic; QA reads R-377's notes and `cland release --item R-377 --dry-run` with version 0.2.0, and the latest full suites on that tip, the web phase included and a local run on macOS, are green.

- [ ] C1. Every other epic of R-377 is closed on a clear QA verdict, and no open item other than this epic remains under R-377.
- [ ] C2. The integrated pass is clear: a relayed approval answered from the web, one gate across two browser contexts and Neovim, read marks agreeing across the clients, and a phone context resuming after a hub restart.
- [ ] C3. `web/README.md` with the tunnel guide and `hub/README.md` describe the web workbench as built, and a fresh clone reaches a signed-in browser by following them.
- [ ] C4. R-377's `## Notes` describe the release by epic, the run's decisions, the deferrals to 0.2.x and the known issues, and `cland release --item R-377 --dry-run` shows them with version 0.2.0.
- [ ] C5. A full suite with the web phase is green on the `dev` tip of the dry run, with a local run on macOS for the macOS-only cases.

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-377` on the answer; QA checks that tag `v0.2.0` is on GitHub `main` and records its verdict on R-377; the retrospective artifact follows and is linked from R-377.

## Dogfooding

The release runs on what the build shipped: the human follows it from the web's inbox and events view, answers the release ask in the browser or on the phone, and the notes come from the item and its epics as the Items area shows them.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it. Releasing stays out of the web (§3.7), and `cland release --item R-377` is the only push to GitHub in this build.
- **ADRs.** 0004 (Agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (Tracker files are the source of truth): the notes live in R-377's file.
- **Risks.** A refused release (an open child, a dirty root) is fixed before it is retried, never overridden.
- **Size.** About three sessions on the v0 scale.
- **Order.** Last: it waits for E-414, E-418 and E-419, the ends of the two lanes.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §4 (the scope, the deferrals, the definition of done); `docs/spec/v0.1.md` §4 (D16, D19); `docs/spec/v0.1.2.md` §4.
- Tickets: R-377, the release item; Q-409, the cut; the map M-399; E-273, the v0.1.2 release epic and the model for this one.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.
