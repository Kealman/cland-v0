---
id: E-1314
kind: epic
title: Release v0.3.0 from the item
state: closed
criterion_seq: 6
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
updated: 2026-10-29T22:35:15.544Z
closed: 2026-10-29T22:35:15.544Z
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
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1314 · 2026-10-29T22:33:49.384Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd
- [ ] C2. The integrated pass is clear on the fakes: one gate across both remotes and both workbenches, attachments once per remote with the cross-remote marks, both remotes caught up after a short and a long restart, and one remote stopped while the other serves.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1314 · 2026-10-29T22:33:49.384Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd
- [ ] C3. The live run on the sandbox bots, with the human on the phone, is done on this Mac against a sandbox project, its findings filed, and no real token reached a droplet.
  - verified: qa-677 [qa] · run qa-live-2026-10-29-677-1314 · 2026-10-29T18:36:11.541Z · commit e75612f0fd52910aaf93fa634bd7e1aac8ba14a0
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1314 · 2026-10-29T22:33:49.384Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd
- [ ] C4. The web-and-phone page's section on remotes and the page on `cland remote` and `cland secret` describe the release as built.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1314 · 2026-10-29T22:33:49.384Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd
- [ ] C5. The root `package.json` and the lockfile are at 0.3.0 on `dev`, R-1278's `## Notes` describe the release by epic with a "Not verified" section, and `cland release --item R-1278 --dry-run` shows them with version 0.3.0.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1314 · 2026-10-29T22:33:49.384Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd
- [ ] C6. A full suite is green on the `dev` tip of the dry run, on droplets with no real token, with a local run on macOS for the macOS-only cases.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1314 · 2026-10-29T22:33:49.385Z · commit 3e15caf47526a10c79dff01e4c637e9913f641bd

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

## Comments

### coord · 2026-10-29T18:40:26.251Z

C3 (live run) verified by qa-677, run qa-live-2026-10-29-677-1314. Scope:
- Live walk L0–L7 at 189d5100, plus L9h (hub-only restart) at 78d77a32.
- Findings filed and fixed on dev: T-1446 (Telegram pairing confirmation, L2 FAIL), T-1447 (native replies, L3 FAIL), T-1449 (Telegram media retry feedback, from L6).
- Not verified, by the human's decision (2026-10-29 18:16:15Z, the Mac was busy with other work): L8 real network outage, the L9 phone, card and catch-up steps, and the L2/L3 phone reruns on the fixed build.
- QA's locality audit: no real token reached a droplet (157 sandbox audit rows, no remote execution; 90 captures scanned).
- The sandbox is cleaned up (L10).
These go into R-1278's "Not verified" notes section. The case table is in QA's summary artifact in topic-1195.

### hub · 2026-10-29T22:10:13.683Z

demo be5eff35-7aef-4e51-ba80-ab8a35e375f8 created: droplet cland-v0-be5eff35, commit 3e15caf47526a10c79dff01e4c637e9913f641bd, deadline 2026-10-29T23:23:20.049Z.

### hub · 2026-10-29T22:24:57.725Z

demo be5eff35-7aef-4e51-ba80-ab8a35e375f8 destroyed: lifetime 973769 ms; cost $0.0676.

### qa-677 · 2026-10-29T22:33:49.385Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-29-677-1314
commit: 3e15caf47526a10c79dff01e4c637e9913f641bd
findings: [{"severity":"low","text":"E1314D-19: read R-1278 Notes against A-13972. “Steps L0 to L7 passed” incorrectly includes the retained L2/L3 FAIL rows (T-1446/T-1447). Later fix/not-verified sections are accurate. Correct this summary before publication; brief explicitly makes this low nonblocking.","file":".cland/tasks/R-1278-remote-control-through-telegram-and.md","line":78},{"severity":"low","text":"E1314D-09 evidence limitation: helper log names use basename, so hub/test/remote-docs.test.ts overwrote the first site/test/remote-docs.test.ts raw TAP log. The first file’s full generated ok-name list and 15/15 counters were captured before overwrite in E1314D-09.json; the hub file also imports and passes those 15 checks. Use unique path-derived capture names in a future brief.","file":"qa/briefs/E-1314.md"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Where | Result | Check / evidence |
| --- | --- | --- | --- |
| E1314D-00 | local macOS | PASS | Build and landings · [E1314D-00-build.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-00-build.json), [E1314D-00-clean.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-00-clean.json) |
| E1314D-01 | local macOS | PASS | Hold, plan and child gates · [E1314D-01-epic.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-01-epic.json), [E1314D-01-children.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-01-children.json) |
| E1314D-02 | Linux droplet | PASS | Demo lease · [E1314D-02.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-02.json) |
| E1314D-03 | Linux droplet | PASS | Sealed helpers and tracker seed · [E1314D-03-machine.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-03-machine.json), [E1314D-03-transfer.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-03-transfer.json) |
| E1314D-04 | Linux droplet | PASS | Runtime/build/browser setup · [E1314D-04.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-04.json) |
| E1314D-05 | Linux droplet | PASS | Integrated scenario: 1/1 · [E1314D-05.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-05.json), [E1314D-05-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-05-assessment.json) |
| E1314D-06 | Linux droplet | PASS | Cards/restart support: 139/139 · [E1314D-06.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-06.json), [E1314D-06-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-06-assessment.json) |
| E1314D-07 | Linux droplet | PASS | Web: 5/5, clean census · [E1314D-07.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-07.json), [E1314D-07-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-07-assessment.json) |
| E1314D-08 | Linux droplet | PASS | Neovim: 5/5 · [E1314D-08.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-08.json), [E1314D-08-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-08-assessment.json) |
| E1314D-09 | Linux droplet | PASS | Documentation tests: 32/32 · [E1314D-09.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-09.json), [E1314D-09-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-09-assessment.json) |
| E1314D-10 | Linux droplet | PASS | Release item tests: 9/9 · [E1314D-10.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-10.json), [E1314D-10-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-10-assessment.json) |
| E1314D-11 | Linux droplet | PASS | Scratch release walk: facts + TAP · [E1314D-11.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-11.json), [E1314D-11-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-11-assessment.json) |
| E1314D-12 | Linux droplet | PASS | Capture scan/pull/cleanup · [E1314D-12-scan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-12-scan.json), [E1314D-12-captures.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-12-captures.json) |
| E1314D-13 | local macOS | PASS | Confirmed lease destruction · [E1314D-13.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-13.json), [E1314D-13-status.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-13-status.json) |
| E1314D-14 | local macOS | PASS | Scenario assertion mapping · [E1314D-14.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-14.json) |
| E1314D-15 | local macOS | PASS | Only E-1314 open · [E1314D-15-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-15-assessment.json), [E1314D-15-open.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-15-open.json) |
| E1314D-16 | local macOS | PASS | Eight epic closing QA verdicts · [E1314D-16-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-16-assessment.json), [E1314D-16-E-1307.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-16-E-1307.json) |
| E1314D-17 | local macOS | PASS | C3 live evidence by citation · [E1314D-17-facts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-17-facts.json), [E1314D-17-live-report.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-17-live-report.md) |
| E1314D-18 | local macOS | PASS | Version 0.3.0 · [E1314D-18-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-18-assessment.json), [E1314D-18-version.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-18-version.json) |
| E1314D-19 | local macOS | PASS | Notes: low wording finding · [E1314D-19-facts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-19-facts.json), [E1314D-19-R1278.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-19-R1278.md) |
| E1314D-20 | local macOS | PASS | Coordinator root refusal · [E1314D-20-root-attempt.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-20-root-attempt.md), [E1314D-11-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-11-assessment.json) |
| E1314D-21 | local macOS | PASS | Pages and CLI help · [E1314D-21-facts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-21-facts.json), [E1314D-21-remote-control.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-21-remote-control.md) |
| E1314D-22 | local macOS | PASS | Brief lint · [E1314D-22.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-22.json) |
| E1314D-COVER | local audit of Linux | PASS | Linux full stage cover · [E1314D-cover-linux-facts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-cover-linux-facts.json), [E1314D-cover-linux.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-cover-linux.log) |
| E1314D-MAC | local audit of macOS | PASS | macOS full stage cover · [E1314D-cover-macos-facts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-cover-macos-facts.json), [E1314D-cover-macos.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-cover-macos.log) |
| E1314D-23 | local macOS | PASS | Same-head cover names · [E1314D-cover-linux-facts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-cover-linux-facts.json), [E1314D-cover-macos-facts.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-cover-macos-facts.json) |
| E1314D-24 | local macOS | PASS | Final freeze/freshness · [E1314D-24-assessment.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-24-assessment.json), [E1314D-24.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/E1314D-24.json) |

**QA clear E-1314 — C1–C6 verified in run qa-dod-2026-10-29-677-1314.** Every scoped row passed. Two low findings below do not block under the brief; no high or medium finding. This is the DoD demo up to the dry run, not a release or phone retest.

Tested source **3e15caf47526a10c79dff01e4c637e9913f641bd**. Authorized tracker seed / held dev **8b5ac061064826bcc99648ffbf0b1de376dded62**, a tracker-only descendant. Final dev 8b5ac061064826bcc99648ffbf0b1de376dded62; source freeze intact, R-1278 file exact, freshness.current=true. QA hold and three merged children checked; stage “scenario, docs and bump” closed; plan approval “not required” retained in row01.

Execution: Linux x64 demo, Node v24.21.0, pinned headless Neovim v0.12.5, isolated Chrome Headless Shell rev1248; binary reports Google Chrome for Testing 156.0.8078.4. Rows05–10 ran 13 single files sequentially: **191/191**, no skipped/cancelled/todo/fail tests. Walk11 ran once, TAP1/1 and independently checked facts; no caught step error. Required generated names are retained in the assessment files, separately from exit status. Web’s five browser censuses ended with zero processes. No own full suite or T4 repetition run; local Part L was record/source reading plus version/help/lint, no runtime tests. No real browser or phone was opened.

Demo lease **be5eff35-7aef-4e51-ba80-ab8a35e375f8**, created 2026-10-29T22:08:22.274Z, deadline 2026-10-29T23:23:20.049Z, confirmed **released**. Final hub-recorded lifetime **973769 ms (973.769 s)**, cost **$0.06762284722222223**; includes machine lifetime, not test-only timing. Initial releasing snapshot was not used as final cost. Owned remote scratch removed after all29 declared captures were pulled and scanned with positive controls. Sealed HOME/XDG/Git and shared final-overlay filters fenced providers and production endpoints; no real token was supplied.

C1: every other epic is closed under R-1278, and every latest non-stage QA verdict is hub-sourced by qa-677 [qa]. Open descendants are exactly E-1314.

| Epic | QA run | Full tested SHA |
| --- | --- | --- |
| E-1307 | qa-dod-2026-10-26-677-1307 | a5d678520989ed9fc11ae0ddc211736e5a7f3dd3 |
| E-1308 | qa-dod-2026-10-26-677-1308 | 94b56ad73c091a8da1e30d4d401474645d5688ff |
| E-1309 | qa-dod-2026-10-27-677-1309 | 2832a56d4d0cd27816375b014e72cfd8d278883a |
| E-1310 | qa-dod-2026-10-27-677-1310 | 7ec62be14156a65b4c4b539d42bc95e3eeaa490e |
| E-1311 | qa-dod-2026-10-28-677-1311 | caf0c17bbec0107f8a9d93e2d1beb5b8a8e63607 |
| E-1312 | qa-dod-2026-10-29-677-1312 | 5a4477bd86842c0ab5edf5d8237b68a33baf8b2b |
| E-1313 | qa-dod-2026-10-29-677-1313 | 370fe48234f02558c04b985f887ff6c428a8791e |
| E-1444 | qa-2026-10-29-677-1444 | 3e15caf47526a10c79dff01e4c637e9913f641bd |

C3 is verified **by citation** of A-13972, run qa-live-2026-10-29-677-1314, not rerun. Live source A=189d510062906c90a0b4b0edaec325be366306d4; source B=78d77a329752822646981cbd5bdffc30d3cc9b7b for L9h/cleanup only. The original mark e75612f0fd52910aaf93fa634bd7e1aac8ba14a0 is bookkeeping and current:false. Retain L2 and L3 FAIL, fixes T-1446/T-1447, and L6 recovered-upload warning T-1449; all three items closed, phone fixes not retested. **L8 real outage, L9 phone/cards/catch-up, L2/L3 phone reruns remain not verified by the human’s 2026-10-29 18:16:15Z decision.** L9h proves hub-only pairing persistence, planned stop and Discord Resume. Locality audit:157 sandbox rows, no remote execution actions, all15 recorder rows local,90 sanitized captures with positive controls. Its no-real-token-droplet conclusion applies through that live run. Historical freshness was false; it is not presented as fresh S phone evidence.

C4: both pages read at S; published Telegram pairing steps executed on fakes, all commands matched help. C5: package/lock/CLI 0.3.0; Notes4014 words, nine epic paragraphs,11 decisions,8 deferrals, explicit Not verified section. Known issues T-1433/T-1451/T-373/T-1264/T-1268 exist and are open in their named categories at S. No TODOs.

C5 dry run: Coordinator **A-14141**, at seed8b5ac061, contains expected plain+JSON exit1 refusal naming only E-1314. QA never ran root release. Walk11 copied149 subtree files, closed only E-1314 in scratch, then produced both v0.3.0 previews at scratch SHA4e87f8e3fd46f83b058f5accca905d1e1718873c: exact Notes, nine goal-derived deliverables and two declared scratch commits, unchanged github refs, empty status/tags and no release.tmp. Its synthetic T3 receipt is explicitly not real release-gate evidence.

C6 covers were independently reread from their primary logs; both heads equal S, both admissions reused:false. **Occasion stage** accepted by Coordinator decision21ee2a36 because C6 requires full suites; original release|epic brief wording was too narrow.

| Run / artifact | Executor and platform | Completed | Results | Time and cost |
| --- | --- | --- | --- | --- |
| c6e2b28b-2ac5-467c-8627-3b972e5f9443 / A-14131 | 2 Linux x64 droplets, kernel6.8.0-142-generic | T0–T4 + Web | 5794 tests,5785 pass,9 platform/binary skips,0 fail/cancel/todo | overall1496.75s admission→collection; $0.2003 |
| d3c6e739-0dd0-439b-9e2d-441246e751af / A-14135 | local darwin arm64 27.0.0 | T0–T4 + Web | 5794 tests,5793 pass,1 Linux-only skip,0 fail/cancel/todo | overall wall not stamped; no inference from phase/projection; cost N/A |

Both Node24.21.0/Nvim0.12.5. Linux Headless Shell156.0.8078.4 rev1248; local historical receipt names isolated Headless Shell but does not stamp its version. Each9Linux skip has a same-generated-name passing macOS counterpart; the1macOS skip passes on Linux (full case/reason table in cover facts). Linux shard1 cland-v0-c321f683 c-8 lon1: lifetime1438s, $0.0999, admission→remote finish1466.40s, collection21.69s. Shard2 cland-v0-45daafe6 c-8 lon1: lifetime1447s, $0.1005, admission→remote finish1465.40s, collection30.95s. Rounded shard costs need not sum to rounded total. Linux Web cases all ran on shard1; shard2’s empty Web phase adds no coverage. T4 base phase ran; extra repetitions did not. Budgets, duration ratchet and test lint are report-only; projections are not wall measurements. All three named scenario/docs/release-preview checks appear once on passed result lines in both logs.

Explicit brief gaps and substitutes:

- GAP-1 / C1,C5: root release belongs to Coordinator/human and open E-1314 blocks preview. Read A-14141; scratch walk supplies the preview.
- GAP-2 / C5,C6: scratch T3 receipt is synthetic; actual same-S covers and Coordinator’s later post-close dry run supply the real gate.
- GAP-3 / C2: no simultaneous rendering of the same Discord modal answer in both workbenches. Scenario proves one stored answer, Telegram outcome and hub-side Inbox; separate Web/Nvim render files and reverse-direction first-answer tests are the accepted substitute. One-second answer folding is not asserted/not judged.
- GAP-4 / C2:30s/240s are injected FakeClock downtime, not wall-time outages. Graceful-restart tests supplement them; historical L9h was hub-only, phone L9 remains unverified.
- GAP-5 / C4: Telegram published pairing blocks execute; Discord instructions are read against help, not executed.
- GAP-6 / C2,C4: isolated Headless Shell and pinned headless Nvim; the only human-phone evidence is the cited C3 live walk.

Findings (high:none; medium:none):

1. **Low — E1314D-19**, .cland/tasks/R-1278-remote-control-through-telegram-and.md:78. E1314D-19: read R-1278 Notes against A-13972. “Steps L0 to L7 passed” incorrectly includes the retained L2/L3 FAIL rows (T-1446/T-1447). Later fix/not-verified sections are accurate. Correct this summary before publication; brief explicitly makes this low nonblocking.
2. **Low — E1314D-09**, capture helper. E1314D-09 evidence limitation: helper log names use basename, so hub/test/remote-docs.test.ts overwrote the first site/test/remote-docs.test.ts raw TAP log. The first file’s full generated ok-name list and 15/15 counters were captured before overwrite in E1314D-09.json; the hub file also imports and passes those 15 checks. Use unique path-derived capture names in a future brief.

Evidence plumbing and amendments: Coordinator21ee2a36 authorized shared fixtureEnvironment then scratchGitEnvironment after final overlays, shared streaming redaction, and tracker seed8b5ac061. Coordinator6c826137 authorized exactly one comment-line redaction in scratch seed `.cland/tasks/T-1363-the-web-s-sessions-area-shows-the.md:75`: prose false positive, no secret value present. Original SHA25692ede9cabbc426f0f7beb8ae39fa4626b4efc7ab5dd2578515c621ebb56331f3; redacted SHA25657fc36701129180975dd96998f61d03e38690ff4d79134c8e47ca7857309a764. All frontmatter/criteria and R-1278’s entire file stayed exact; root tracker untouched. Helper delta and originals retained. Initial tar sidecars were removed from owned scratch; declared157file hashes matched. Initial cover parser omitted shard prefixes (false FAIL); raw logs retained and parser corrected, no test rerun. An early recorder preflight referenced a not-yet-pulled fact path and appended no row; corrected to existing setup receipt. Version helper double-parsed JSON once, then consumed the existing structured receipt; no product failure.

All source assertions and generated names were checked at S, not inferred from the earlier draft. Recorders carry full S and explicit executor. The artifact contains only declared QA captures, source/seed evidence and helpers, no HOME, environment dump, cookie or credential file. Final positive-controlled scan and SHA256 manifest accompany this report. Project-rule proposal for provenance footers was sent to the Coordinator and logged in the pending rule batch.


Evidence artifact A-14142: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14142-e-1314-dod-at-3e15caf4-clear-c1-c6-limits-and-evidence/report.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-29T22:35:15.544Z

QA clear qa-dod-2026-10-29-677-1314 at S = 3e15caf4, tracker seed 8b5ac061 (A-14142). C1–C6 are verified. Droplet tests passed 191/191, and walk 3 reproduced the R-1278 preview with version 0.3.0. C3 cites the live run A-13972. C6 rests on the stage covers c6e2b28b (Linux) and d3c6e739 (macOS). Two low findings are handled: the Notes summary of the live run is corrected before the dry run, and the brief capture-name collision goes into the brief guidance.
