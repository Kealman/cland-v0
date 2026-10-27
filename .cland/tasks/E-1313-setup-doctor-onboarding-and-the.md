---
id: E-1313
kind: epic
title: Setup, doctor, onboarding and the workbenches
state: open
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1308
topic: null
branch: null
created: 2026-10-25T14:12:00.125Z
updated: 2026-10-27T05:47:05.526Z
---

## Goal

The remotes become part of how a project is set up and watched. `cland setup` offers Telegram and Discord with their pairing and the speech key; doctor names a stopped remote's cause and its fix; both workbenches show a Remotes row and the pairing rows, approved from Neovim; messages carry their source; the onboarding's tour gains a stage on remote control; and the documentation describes it all. Without this epic a human would create the bots, set the secrets, enable the messengers and pair them by hand from the spec.

## Contents

- **The setup step** (spec §3.11). An optional remote step after the hub and before the Aide, which stays last because it opens the workbench. It offers Telegram, then Discord: how to create the bot (BotFather; the Discord application with its Install Link at None, Public Bot off, the Message Content toggle and the invite with permissions 117824), the token through a hidden prompt as `cland secret set` reads it, enabling, then the pairing: the human presses Start or runs `/cland pair`, and setup approves the code on the human's yes. For Discord it checks Public Bot, the Message Content flag and the empty Interactions Endpoint URL, and names what to change. It then offers the speech key with the provider's data-use line. Without a terminal the step reports what is open with its commands; a declined messenger is `skip`; a second run reports `ok`. Demo: with the fake platforms, a terminal run pairs both remotes and stores the speech key, and a run without a terminal lists the open step.
- **Doctor's remote lines** (§3.11). Per messenger: the token's presence with its fingerprint, the connection state and the pairing, and a stopped remote's cause with its fix: a new token for 4004 or 401, the Message Content toggle for 4014, the blocked bot for 403, another consumer for a lasting 409. Doctor reports presence only and makes no platform or paid call; `cland remote test` checks a token. Demo: each cause produced on the fakes gives its line and fix.
- **The Remotes row** (§3.11). In the web's Sessions area and in Neovim's sessions panel: connected or not, paired with whom, mute, outbox depth and last error, red at once on a failure, before General's 3-minute offline line. Demo: a fake outage turns the row red in both workbenches within a second, and recovery clears it.
- **Pairing rows** (§3.2, §3.11). A waiting code shows in both inboxes ("Pair Telegram user 12345 (Name)? code …"). Neovim's card approves it; the web's row says "approve in the terminal or Neovim" and offers no approve. Demo: a waiting code shows in both inboxes, is approved from Neovim's card, and leaves both.
- **Source and voice marks** (§3.1, §3.11). Messages from a remote carry "via Telegram" or "via Discord", voice messages their 🎤 marker, and approvals and ask outcomes answered from a remote say where, in both workbenches. Demo: a message, a voice note and an approval from each remote read with their marks in Neovim and the web.
- **The tour's stage** (§3.11). The onboarding skill's tour gains a stage on remote control, in the tour's form: one round, tied to what is on the human's screen, ending with what to look at now. Demo: the skill's tests read the stage, and its commands match `cland remote` and `cland secret` as built.
- **The documentation pages** (spec §4). The web-and-phone page gains a section on remotes, and a new page covers `cland remote` and `cland secret`, from creating the bots to a paired remote. Demo: QA follows the new page against the fakes to a paired remote.

Not in this epic: the Telegram and Discord clients and the speech seam, which the steps above drive (their epics); the integrated pass and the live run ("Release v0.3.0 from the item").

## Order

1. **Doctor's lines and the Remotes row.** Demo: each cause in doctor; the row red at once in both workbenches.
2. **Pairing rows and the source marks.** Demo: a code approved from Neovim's card, the web pointing to the terminal, marks in both workbenches.
3. **The setup step.** Its Telegram part follows the merges of "The Telegram remote", its Discord part those of "The Discord remote", and its speech key those of "Media, the upload frame and speech". Demo: a terminal run and a run without a terminal.
4. **The tour's stage.** Demo: the stage and its commands.
5. **The documentation pages.** Last, against the built remotes. Demo: the new page followed to a paired remote.

## Definition of done

QA runs the demo below on `dev` with the fake platforms and the fake speech provider in the suite, in a terminal of its own, headless Neovim and headless Chromium, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

In an initialised scratch project with made-up tokens, QA runs `cland setup`, declines Telegram once and reads `skip`, then runs it again, follows the Telegram and Discord guidance, enters the tokens at the hidden prompts, pairs both remotes through the fakes on its yes, and stores a speech key after reading the data-use line; with Public Bot left on in the fake, setup names it. A run without a terminal lists the open step. QA then produces each stopped-remote cause on the fakes and reads doctor's line and fix, makes an outage and watches the Remotes row turn red in both workbenches, approves a waiting code from Neovim's card while the web's row points to the terminal or Neovim, and reads the source and voice marks in both workbenches. Finally it reads the tour's stage and follows the new documentation page to a paired remote.

- [ ] C1. `cland setup` offers an optional remote step after the hub and before the Aide, guides each bot's creation, reads the token through a hidden prompt, enables, pairs on the human's yes, and offers the speech key with its data-use line.
- [ ] C2. Without a terminal the remote step reports what is open with its commands, a declined messenger is `skip`, and a second run reports `ok`.
- [ ] C3. For Discord, setup checks Public Bot, the Message Content flag and the empty Interactions Endpoint URL, and names what to change.
- [ ] C4. Doctor shows, per messenger, the token's presence with its fingerprint, the connection state, the pairing and a stopped remote's cause with its fix, and makes no platform or paid call.
- [ ] C5. Both workbenches show a Remotes row with the connection, the pairing, mute, the outbox depth and the last error, red at once on a failure.
- [ ] C6. Pairing rows show in both inboxes, Neovim's card approves them, and the web's row points to the terminal or Neovim without an approve action.
- [ ] C7. Messages, approvals and ask outcomes from a remote carry their source mark in both workbenches, and voice messages their 🎤 marker.
- [ ] C8. The onboarding's tour has a stage on remote control whose commands match the build.
- [ ] C9. The web-and-phone page has a section on remotes, and a new page covers `cland remote` and `cland secret` as built.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. No new runtime dependency.
- **Setup's shape** (v0.1.4 §3.3). Each step checks first, asks only about what is missing, and prints one line: `ok`, `done`, `skip`, `open` or `fail`. One readline interface per question, so a child never loses its keystrokes. Without a terminal setup never prompts.
- **The workbenches.** The web: no hex colour outside the tokens, keys by physical code, no explanatory prose in the interface (v0.2 §3.2). Neovim stays the host (ADR 0005): pairing is approved there or in the terminal, never in the web.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (`hub/test/harness.ts`), the fake platforms, the fake speech provider and a fake prompter the second, Playwright and headless Neovim the third. No test needs a real platform, token or key, so the suite runs on droplets as it is.
- **Secrets.** Setup reads a token only through a hidden prompt, never argv, and shows only a fingerprint afterwards. A token never appears in a frame, a log line, an error, a journal record or an artifact. Real tokens never go to droplets.
- **The docs.** The pages describe what is built and claim nothing the build lacks.
- **The prototype.** `prototype/telegram-remote` at 33bf2b2e is never merged. The build may read its code and take what fits, but follows the spec (Q-1297).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** Blocked by "Pairing, secrets and configuration"; it runs beside "The Telegram remote", "Remote cards and approvals", "Media, the upload frame and speech" and "The Discord remote", and a slice that drives a messenger waits for that messenger's merges.

## References

- Spec: `docs/spec/v0.3.md` §3.11 (setup, doctor, onboarding and the workbenches), §3.2 (approval in Neovim or the terminal), §3.10 (`cland remote` and `cland secret`) and §4 (the documentation pages); `docs/spec/v0.1.4.md` §3.3 and §3.4 (setup and the onboarding); `docs/spec/v0.2.md` §3.2 and §3.6.
- Items: R-1278; the map M-1286, round-1 decision 17; Q-1294 §10; Q-1295 §6 and §10; Q-1296 §8 and §13; Q-1293 (setup's Discord checks and the invite 117824).
- Prototype, on `prototype/telegram-remote` at 33bf2b2e: `hub/src/remote/discord/README.md` (what setup has to check) and `hub/src/cli/remote.ts`; the sandbox's `/Users/evgeniyivanov/Projects/cland/sandbox-remote/HOW-TO-TRY.md` (the steps the human followed to create the bots).
- Research: `docs/research/discord-remote.md` on `research/discord-remote` (1f59ae25), the application, the invite and the toggles; `docs/research/telegram-remote.md` on `research/telegram-remote` (2a81ecc9), BotFather.
- Code: `hub/src/setup/runner.ts`, `hub/src/setup/prompter.ts`, `hub/src/cli/setup.ts`, `hub/src/cli/doctor.ts`, `hub/src/doctor/web.ts`, `web/src/sessions/`, `web/src/InboxArea.tsx`, `nvim/lua/cland/sessions.lua`, `nvim/lua/cland/inbox.lua`, `.agents/skills/onboarding/TOUR.md`, `hub/test/skills-onboarding.test.ts`, `site/src/content/docs/docs/web-and-phone.mdx`.
- GLOSSARY: Setup (amended for v0.3), Remote, Pairing, Tour.

## Plan

```yaml
stages:
  - name: doctor, Remotes row, pairing rows and Telegram setup
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1361
        - T-1362
        - T-1363
      - - T-1364
      - - T-1365
        - T-1366
  - name: tour and documentation
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1367
      - - T-1368
  - name: speech key and Telegram marks
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1369
      - - T-1370
  - name: Discord
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1371
      - - T-1372
```

## Comments

### coord · 2026-10-27T05:47:05.526Z

Plan and decisions (coord, 2026-10-27 06:0xZ). Tickets T-1361–T-1372 in four stages:
1. Doctor, the Remotes row, pairing rows and Telegram setup. Runs now; T-1362 and T-1368 also wait on T-1348.
2. Tour and documentation.
3. Speech key and the Telegram marks. Waits on E-1311.
4. Discord. Waits on E-1312.
Decisions on the open questions in the draft:
1. Without a terminal, a remote nobody has touched prints `skip` with its setup commands, so setup without a terminal doesn't fail for people who don't want remotes. A half-configured remote prints `open` with the commands still missing. T-1365 C3 and T-1371 C4 are worded this way.
2. A decline isn't remembered: every terminal run offers the remote again, as the DoD demo expects.
3. Doctor reports a stopped remote as `warn`, not `fail`.
4. Pairing rows go in the inbox's "asks and approvals" section.
5. The tour stage may tell the human to type a token at the hidden prompt in their own terminal. This is a narrow exception to the onboarding rule that the human runs no commands.
6. Doctor's speech lines stay in E-1311, and setup reuses E-1311's data-use text.
Crew note: E-1313 items edit setup, doctor, the workbench panels and the inbox, so they overlap little with E-1310's telegram.ts. No E-1313 item enqueues while the E-1309 stage covers run.
