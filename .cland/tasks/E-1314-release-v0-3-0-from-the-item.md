---
id: E-1314
kind: epic
title: Release v0.3.0 from the item
state: open
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1307
  - E-1308
  - E-1309
  - E-1310
  - E-1311
  - E-1312
  - E-1313
topic: topic-1195
branch: null
created: 2026-10-25T14:12:00.243Z
updated: 2026-10-29T16:36:37.724Z
---

## Goal

v0.3, remote control through Telegram and Discord, ships from its release item: `cland release --item R-1278` publishes version 0.3.0 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective records the run. Before it, QA checks once on the fakes the paths no single epic's demo covers, where both remotes and both workbenches meet, and the human joins the build's one live run: the sandbox bots on Telegram and Discord, from the phone, on this Mac.

## Contents

- **The demos** (spec §4). Every other epic of R-1278 closed on its QA demo with a clear verdict, each on the fake platforms in the suite.
- **The integrated pass**, on the fakes, as E-420 had for v0.2: both remotes paired at once; an ask answered from Discord turns its Telegram copy and the inbox rows of Neovim and the web into the outcome; a photo and a voice note from each remote reach the other once, marked "you (Telegram)" or "you (Discord)"; a hub restart under 90 seconds and one over 3 minutes caught up on both remotes; a revoked token stopping one remote while the other serves.
- **The live run** (§4, §3.12), once, before the release, with the human on the phone: the human's sandbox bots on Telegram and Discord, against a sandbox project on this Mac running the `dev` tip, never this project's hub. It walks the pairing of both remotes, the mirror both ways, an ask and a Codex approval answered from cards, a photo, a file and a voice note each way, the commands, and a restart, and it tries what the prototypes left untried on real Discord: a Codex approval card, a restart over 2 minutes, an outage while the hub runs, and the bot's presence after a stop. QA drives the hub's side and records the verdict while the human uses the phone. The human's words go into the verdict and the notes as the human said them.
- **The docs.** The web-and-phone page's section on remotes and the page on `cland remote` and `cland secret`, written in "Setup, doctor, onboarding and the workbenches", checked against the built release.
- **The version bump.** An ordinary item sets the root `package.json` and both lockfile version fields to 0.3.0, reviewed and merged before the dry run, since `cland release` refuses a version that differs (the `release` skill).
- **The release** (§4). R-1278's `## Notes` written from the item and its epics, with a "Not verified" section; `cland release --item R-1278 --dry-run`, with its notes and version 0.3.0 shown in an ask; `cland release --item R-1278`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective**: an artifact of the run.

Not in this epic: findings of the demos, the live run or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; the deferrals of spec §4 (Telegram groups and forum topics, Discord Components V2, a thread per item, following a thread started from the chat, several humans, webhooks, transcription cost accounting, Web Push), which wait for 0.3.x.

Choices where the spec is silent, as in E-420:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-1278.
- **The notes** go in R-1278's `## Notes`, written by the Coordinator: the goal; one paragraph per epic on what the human can now do from the phone; the run's decisions; the deferrals to 0.3.x; the "Not verified" section, naming what neither the fakes nor the live run covered; the known issues filed in the categories.
- **The version** is R-1278's recorded 0.3.0. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The suites.** A full suite on the dry run's tip, on droplets with no real token, and one full local run on macOS for the macOS-only cases.

## Order

1. **The integrated pass.** The paths across the epics on the fakes. Demo: an ask answered from Discord folds its Telegram card and both workbenches' rows within a second, and both remotes catch up after a long restart.
2. **The live run.** With the human, on this Mac, on the sandbox bots. Demo: every step of the run above clear on the human's phone, or a finding filed with the human's words.
3. **The docs, the bump, the notes and the dry run.** Demo: the dry run prints version 0.3.0 and the notes with their "Not verified" section, with every other child of R-1278 closed.
4. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item R-1278`, and QA's check of the tag. Demo: tag `v0.3.0` is on GitHub `main`, R-1278 is closed, and QA's verdict on R-1278 is clear.
5. **The retrospective.** After the release: the artifact of the run.

## Definition of done

QA runs the demo below on `dev`, playing the human's part on the fakes through the `cland` CLI, headless Chromium and a headless Neovim workbench, and joins the human for the live run on this Mac; it records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it.

In a scratch project with both remotes paired on the fakes, QA answers an ask from a Discord modal and reads the Telegram card and both workbenches' rows, sends a photo and a voice note from each remote and reads the other, restarts the hub for 30 seconds and for four minutes and reads both remotes' catch-up, and revokes the Telegram token on the fake while Discord serves on. With the human on the phone, QA then runs the live walk on the sandbox bots against a sandbox project at the `dev` tip and records what the human sees and says. From a fresh reading of the web-and-phone page and the new page, QA pairs a fake remote. On `dev`, `cland task list --under R-1278 --state open --json` lists only this epic; QA reads the root `package.json` and the lockfile versions, R-1278's notes and `cland release --item R-1278 --dry-run` with version 0.3.0, and the latest full suites on that tip, on droplets and local on macOS, are green.

- [ ] C1. Every other epic of R-1278 is closed on a clear QA verdict, and no open item other than this epic remains under R-1278.
- [ ] C2. The integrated pass is clear on the fakes: one gate across both remotes and both workbenches, attachments once per remote with the cross-remote marks, both remotes caught up after a short and a long restart, and one remote stopped while the other serves.
- [ ] C3. The live run on the sandbox bots, with the human on the phone, is done on this Mac against a sandbox project, its findings filed, and no real token reached a droplet.
- [ ] C4. The web-and-phone page's section on remotes and the page on `cland remote` and `cland secret` describe the release as built.
- [ ] C5. The root `package.json` and the lockfile are at 0.3.0 on `dev`, R-1278's `## Notes` describe the release by epic with a "Not verified" section, and `cland release --item R-1278 --dry-run` shows them with version 0.3.0.
- [ ] C6. A full suite is green on the `dev` tip of the dry run, on droplets with no real token, with a local run on macOS for the macOS-only cases.

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-1278` on the answer; QA checks that tag `v0.3.0` is on GitHub `main` and records its verdict on R-1278; the retrospective artifact follows and is linked from R-1278.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item R-1278` is the only push to GitHub in this build.
- **The live run.** Only on this Mac, with the human's sandbox bots against a sandbox project, never this project's hub. Only the human creates bots and places tokens (T-1291): the human sets the sandbox tokens and the speech key in the sandbox project with `cland secret set`, and the sandbox secrets file `~/.config/cland/sandbox-remote.secrets.toml` is read by path only, never printed, copied or deleted. A token never appears in argv, a log line, an artifact or a verdict. Real tokens never go to droplets.
- **ADRs.** 0004 (agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (tracker files are the source of truth): the notes live in R-1278's file.
- **Risks.**
  - The live run spends the human's ElevenLabs credits and the bots' identify budget, shared by every session of a bot (the prototype used 13 of 1000 in a day); the run identifies no more than it needs.
  - A Discord click made while the sandbox hub restarts is lost by design; the run expects the re-sent card.
  - A refused release (an open child, a dirty root, a version that differs) is fixed before it is retried, never overridden.
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Last: blocked by the seven other epics. These edges stay `blocked_by`, since the release needs every other epic closed, not only merged.

## References

- Spec: `docs/spec/v0.3.md` §4 (the cut, QA, the definition of done, the deferrals) and §3.12 (hygiene); `docs/spec/v0.2.md` §4.
- Items: R-1278, the release item; Q-1297 (the cut, the corrected crew and QA rules); the map M-1286; E-420, the v0.2.0 release epic and the model for this one; E-617; Q-1292 and Q-1293 (the prototypes' trials, and what they left untried on real Discord); T-1291 (the sandbox bots).
- Sandbox: `/Users/evgeniyivanov/Projects/cland/sandbox-remote` and its `HOW-TO-TRY.md`; the prototype `prototype/telegram-remote` at 33bf2b2e, never merged.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.

## Plan

```yaml
stages:
  - name: scenario, docs and bump
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1442
      - - T-1443
      - - T-1441
```
