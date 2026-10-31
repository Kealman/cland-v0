---
id: E-1539
kind: epic
title: Release v0.4.0 from the item
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1531
  - E-1532
  - E-1533
  - E-1534
  - E-1535
  - E-1536
  - E-1537
  - E-1538
topic: null
branch: null
created: 2026-10-31T18:22:04.894Z
updated: 2026-10-31T18:22:56.734Z
---

## Goal

v0.4, cland beyond one machine, ships from its release item. `cland release --item R-1530` publishes version 0.4.0 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective records the run. Before that, QA checks once on the fakes the paths no single epic's demo covers: where hosts, logins, users and the workbenches meet. The human then joins the build's one live run on real hardware: a DigitalOcean pool with two hosts, a Claude Code sign-in from the phone, a Codex sign-in at a moment the human picks, an OpenCode key, a hub restart under load, idle stop and the money in the ledger. The live run also settles the points the prototypes left open (Q-1520 §3, Q-1522 §3).

## Contents

- **The demos** (spec §4). Every other epic of R-1530 closed on its QA demo with a clear verdict, each on the fake host provider and the fake transport in the suite.
- **The integrated pass**, on the fakes: an `agents` pool of two fake hosts with Implementers and Reviewers on it and the Coordinator local; a waiting launch released by a login added from a remote card; a signed-out login signed in again from the web's hosts view while its host's sessions keep running; two users in users mode, one answering an ask from a remote and the other seeing the outcome in the web; a hub restart with both hosts busy; the hosts' sub-cap reached and the live hosts untouched.
- **The live run** (§4), once, before the release, with the human, against a sandbox project on this Mac running the `dev` tip, never this project's hub (assumed in the spec, as in 0.3):
  - a real DigitalOcean `agents` pool with two hosts booted from a prepared pool image, with the boot-to-ready time recorded against the 60 to 90 s target;
  - a Claude Code login added from the phone through a card;
  - a Codex login added at a moment the human picks, with no Codex crew sessions running on the Mac, then a day of watching whether the Mac stays signed in;
  - an OpenCode Go key login on both hosts;
  - sessions of each harness packed onto the hosts, with Codex's weight measured on a host;
  - a hub restart under load with every session surviving;
  - idle stop of the second host, and its logins' volumes detached and re-attached on the next boot;
  - the spend in the ledger under `hosts`, read in `cland host status`.
  It settles the open points: whether a live Claude Code or Codex process picks up re-signed tokens without a relaunch (and sets the relaunch switch of "Logins" accordingly), the reconciliation of login volumes at start after a watchdog deletion, and sessions of a destroyed host becoming exited. QA drives the hub's side and records the verdict while the human uses the terminal and the phone; the human's words go into the verdict and the notes as the human said them.
- **The docs.** The hosts, pools and logins page, the users and sign-in modes page, the web-and-phone page's multi-user section and the price table, checked against the built release; the price table's check date refreshed if the providers' prices changed.
- **The version bump.** An ordinary item sets the root `package.json` and both lockfile version fields to 0.4.0, reviewed and merged before the dry run, since `cland release` refuses a version that differs (the `release` skill).
- **The release** (§4). R-1530's `## Notes` written from the item and its epics, with a "Not verified" section (Codex on a host if the human did not try it; Kubernetes, which ships in 0.4.x; anything the live run skipped); `cland release --item R-1530 --dry-run`, shown with its notes and version 0.4.0 in an ask; `cland release --item R-1530`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective**: an artifact of the run.

Not in this epic: findings of the demos, the live run or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; the deferrals of spec §4 (the Fly provider, shape B as a whole, OIDC and SSO, roles beyond admin, serverless providers, several projects on one host, the tool's ties to this repository), which wait for 0.4.x.

Choices where the spec is silent, as in E-1314:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-1530.
- **The notes** go in R-1530's `## Notes`, written by the Coordinator: the goal; one paragraph per epic on what the human can now do; the run's decisions; the deferrals to 0.4.x; the "Not verified" section; the known issues filed in the categories.
- **The version** is R-1530's recorded 0.4.0. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The suites.** A full suite on the dry run's tip, on droplets with no real host token in the run, and one full local run on macOS for the macOS-only cases.

## Order

1. **The integrated pass.** The paths across the epics on the fakes. Demo: a waiting launch released by a login added from a card, and a restart with two busy hosts.
2. **The live run.** With the human, on this Mac and two real hosts. Demo: every step above clear, or a finding filed with the human's words; every droplet, volume, snapshot and key the run made either kept on purpose (the logins) or confirmed deleted by listing.
3. **The docs, the bump, the notes and the dry run.** Demo: the dry run prints version 0.4.0 and the notes with their "Not verified" section, with every other child of R-1530 closed.
4. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item R-1530`, and QA's check of the tag. Demo: tag `v0.4.0` is on GitHub `main`, R-1530 is closed, and QA's verdict on R-1530 is clear.
5. **The retrospective.** After the release: the artifact of the run.

## Definition of done

QA runs the demo below on `dev`, playing the human's part on the fakes through the `cland` CLI, headless Chromium and a headless Neovim workbench, and joins the human for the live run on this Mac; it records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it.

In a scratch project on the fakes, QA runs the integrated pass above and reads each outcome in both workbenches and on the test messengers. With the human, QA then runs the live walk on two real DigitalOcean hosts against a sandbox project at the `dev` tip, records what the human sees and says, reads `cland host status` and the ledger's `hosts` entries, and lists the provider's droplets, volumes, snapshots and keys at the end. It reads the docs pages against the build. On `dev`, `cland task list --under R-1530 --state open --json` lists only this epic; QA reads the root `package.json` and the lockfile versions, R-1530's notes and `cland release --item R-1530 --dry-run` with version 0.4.0, and the latest full suites on that tip, on droplets and local on macOS, are green.

- [ ] C1. Every other epic of R-1530 is closed on a clear QA verdict, and no open item other than this epic remains under R-1530.
- [ ] C2. The integrated pass is clear on the fakes: a login added from a card releases a waiting launch, a signed-out login is signed in again with its sessions running, two users answer and see each other's outcomes, a restart with two busy hosts loses nothing, and the sub-cap stops new hosts only.
- [ ] C3. The live run on two real DigitalOcean hosts is done with the human, its open points are recorded with their outcomes, its findings are filed, and no provider token reached a host.
- [ ] C4. After the live run the provider lists only the resources kept on purpose, and every other droplet, volume, snapshot and key the run made is confirmed deleted.
- [ ] C5. The hosts, pools and logins page, the users and sign-in modes page, the web-and-phone multi-user section and the dated price table describe the release as built.
- [ ] C6. The root `package.json` and the lockfile are at 0.4.0 on `dev`, R-1530's `## Notes` describe the release by epic with a "Not verified" section, and `cland release --item R-1530 --dry-run` shows them with version 0.4.0.
- [ ] C7. A full suite is green on the `dev` tip of the dry run, on droplets, with a local run on macOS for the macOS-only cases.

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-1530` on the answer; QA checks that tag `v0.4.0` is on GitHub `main` and records its verdict on R-1530; the retrospective artifact follows and is linked from R-1530.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Only `cland release` pushes to GitHub: commit on the task branch in its worktree, push it to `origin`, and reach `dev` only through `cland merge`. Suites run through `cland verify`. Items through `cland task` only.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item R-1530` is the only push to GitHub in this build.
- **The live run.** Only with the human, on this Mac, against a sandbox project (assumed in the spec), never this project's hub. The DigitalOcean token stays in the hub's environment and never reaches a host, a session, argv, a log line, an artifact or a verdict. Only the human signs in Claude Code and Codex; cland never copies or reads their logins. The Codex sign-in waits for the human's moment, with no Codex crew sessions running on the Mac, and its day of watching is recorded. The run's spend stays inside the project's daily cap and the hosts' sub-cap; the run checks the provider listing at the end.
- **ADRs.** 0004 (agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (tracker files are the source of truth): the notes live in R-1530's file.
- **Risks.**
  - A Codex sign-in on a host signs out the same account's other places, the Mac included; the human chooses the account and the moment, and the hint of "Logins" must appear if it happens.
  - A login volume left attached to a destroyed droplet keeps billing until reconciled; the run checks the reconciliation explicitly.
  - DigitalOcean allows one volume snapshot per volume per 10 minutes; the run never waits on one at a host stop.
  - A refused release (an open child, a dirty root, a version that differs) is fixed before it is retried, never overridden.
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Last: blocked by the eight other epics. These edges stay `blocked_by`, since the release needs every other epic closed, not only merged.

## References

- Spec: `docs/spec/v0.4.md` §4 (the cut, QA, the live run, the definition of done, the deferrals), §3.7 (the open points), §3.13 (hygiene); `docs/spec/v0.3.md` §4.
- Items: R-1530, the release item; Q-1522 (the cut and the live run); Q-1520 §3 (the open points); the map M-1511; E-1314, the v0.3.0 release epic and the model for this one.
- Sandbox: `/Users/evgeniyivanov/Projects/cland/sandbox-remote` and its `HOW-TO-TRY.md` ("Try agent hosts", "Try logins"); the prototype `prototype/agent-host` at 7f7ecb0f, never merged.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict, Host, Login.
