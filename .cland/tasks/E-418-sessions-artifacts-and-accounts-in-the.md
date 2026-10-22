---
id: E-418
kind: epic
title: Sessions, artifacts and accounts in the web
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-416
topic: null
branch: null
created: 2026-10-14T15:59:25.029Z
updated: 2026-10-22T16:51:45.867Z
---

## Summary

The Sessions, Accounts and Artifacts areas come to the browser: the crew in its groups with the verify line and the queue view, the accounts strip, the Accounts area with the registry and the limits, and the artifacts tree with its notes, pages and files. Sessions are launched, stopped, resumed and archived from the web with confirmations, and there is no Attach in 0.2.0.

## Goal

The human watches the crew, the verification queue and the accounts' limits from the browser and acts on a session without opening Neovim: who waits and on what, who is busy, which droplets run and what they cost, which account is limited and until when. Today the web has none of it beyond the prototype's read-only Sessions area, which met an empty account registry and never exercised the meters with real data.

## Contents

- **§3.2 The Sessions area** (P20 to P23; v0.1 §3.11; v0.1.2 §3.4 to §3.6):
  - **The header:** the counts, Launch a session, New Aide and the archive toggle, as the Sessions board draws them.
  - **The accounts strip** (P20): one cell per account in the registry's order, with its worst window as a meter and its reset; amber from 75 percent and red from 90; a limited account in red with its reset and the session that hit it; a dash without data, never 0 percent; the other windows, the reading's age and its source in the tooltip; a link to the Accounts area.
  - **The verify line** (v0.1.2 §3.6) as a one-line summary that opens in place into the queue view (P21): the local slot, the remote slots with their droplets, the waiters in order with the executor each asked for, their wait and their ETA, and the metrics of the last 20 runs.
  - **The groups** Yours, Waiting, Busy, Idle and Stopped (the latest 20, with the archived count), each folding, its state remembered per client.
  - **Session rows** (P22): the glyph, the name, the role, the harness, the model and the account, the item with a verifier's hold and +N or a requested item dimmed (v0.1.2 §3.4), the state with its age, and the usage. The selected row unfolds in place with what it waits on and Open thread, Capabilities, Stop, Resume and Archive. No Attach in 0.2.0.
  - **The drawer** (P23): the session's recent thread, its pending approval as a card, and a composer to the session.
- **§3.6 The session's page and the two-line row.** The page holds the session's model, account, usage and capabilities, with Stop, Resume, Archive and Capabilities; Stop and Archive ask for a confirmation. The two-line row of P27 (the glyph, the name and the role with the state and its age; then the harness and the item, a waiting row adding its command) is built here for narrow widths, where the list has no row actions; E-419 places both on the phone.
- **§3.2 The Accounts area** (v0.1.2 §3.13): the registry (names, harness and directory or database path, never a secret) and, per account, the windows its source sent (5-hour, weekly, per-model weekly) with the used share, the reset time, the reading's age and its source, and the limited mark.
- **§3.6 Beside the profile:** the notification switches ("needs you", "finished") and this browser's sign-in, in the Accounts area on the desktop.
- **The Artifacts area** (v0.1 §3.6): the tree with its sections (mine, this topic, kept, by role folded, archived folded), opening notes, pages and files.

Not in this epic: the thread, the composer and the approval card that the drawer reuses (E-417); the phone's layouts (E-419); a terminal or Attach (0.2.x); creating artifacts from paths of the machine, which stays in the CLI and Neovim (§3.7).

Choices where the spec is silent:

- **Launching.** Launch a session (`l`) and New Aide (`a`) open a small form with the role's defaults from `roles.toml` (harness, model, account), the item and the brief, as Neovim's launcher does. The directory is always the project's, never one typed in the page.
- **Confirmations.** Stop and Archive ask once, in place; Resume and Capabilities do not.
- **Capabilities** shows the adapter's capability table for the session (history, usage, model change, approval relay, terminal), read-only.
- **The queue view** ages its times from the frame's receipt, since the hub pushes the queue only when it changes.
- **The Accounts area is read-only.** Opening it asks the hub to poll the idle accounts, as Neovim's sessions panel does; clearing a limited mark stays in the CLI.
- **The profile** is the human's own block in the Accounts area, not an account: this browser's sign-in (when it was made and when the cookie expires) and the two switches, which move here from the palette.
- **Narrow widths.** Below 640 px, the phone width of E-419, the Sessions area draws the two-line rows without row actions and opens the session's page on a tap or Enter.
- **Artifacts.** Enter opens a note as rendered Markdown in the drawer, a page in a sandboxed iframe at full height, and a file as text when it is text or as a download otherwise, all through the capability URLs of E-412. `s` attaches the artifact to the composer, `k` keeps it and `d` archives it, as in Neovim. Creating, moving, promoting, deleting and editing in place stay in Neovim and the CLI in 0.2.0.

## Tracer-bullet order

1. **The Sessions area.** The groups with their folds and counts, the rows of P22 from the hub's merged sessions, and the selected row unfolded with what it waits on. Demo: with fake sessions in every state, each group shows its count, and Idle folded stays folded after a reload.
2. **The verify line and the accounts strip.** The summary opening into the queue view, and the strip of cells from the snapshot's accounts. Demo: with a run holding the queue and one waiting, the queue view shows the holder and the waiter with its executor and ETA, and a limited fake account shows red with its reset.
3. **Acting on a session.** Stop, Resume, Archive and Capabilities on the selected row and on the session's page, Stop and Archive confirmed, the two-line row, and Launch a session and New Aide. Demo: Stop on a busy fake session asks for a confirmation and stops it, Resume brings it back with its name and role, and a new Aide appears under Yours.
4. **The session's drawer.** The session's recent thread, its pending approval card and a composer to the session, on the thread and the card of E-417. Demo: selecting a fake Codex session waiting for approval shows its command in the drawer's card, and Approve once there folds the card.
5. **The Accounts area and the profile.** The registry with every window, reset, age and source, the limited mark, this browser's sign-in and the two switches. Demo: the Accounts area lists the fake registry's three accounts with their windows, and the "finished" switch turned off stays off after a reload.
6. **The Artifacts area.** The tree, opening a note, a page and a file, and `s`, `k` and `d`. Demo: an HTML page artifact opens in a sandboxed iframe without `allow-same-origin`, and `k` on an agent's artifact moves it to the kept section.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and headless Chromium (Chrome Headless Shell through `playwright-core`, keys sent with their physical codes, the screen read from the DOM), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project with the fake harnesses, a registry of three fake accounts with limit readings (one of them limited), fake sessions in every state (an Aide, one waiting for an approval, busy, idle and stopped ones) and a fake run holding the verification queue with one waiter, QA opens the web at 1440x900 on the Sessions area. QA reads the groups with their counts, folds Idle and finds it folded after a reload; reads the accounts strip with the limited account in red; opens the verify line into the queue view and reads the holder, the waiter, its executor, its wait and its ETA. QA selects the waiting session and reads its command in the row and in the drawer's card; launches a new Aide from the header and reads it under Yours; stops a busy session after the confirmation, resumes it, and archives a stopped one after the confirmation, reading each change with `cland session list`; opens Capabilities. QA opens the Accounts area, reads every window with its reset, age and source, turns "finished" off and finds it off after a reload. In the Artifacts area QA opens a note, an HTML page (its iframe's `sandbox` is `allow-scripts` alone) and a file, attaches one to the composer with `s` and keeps one with `k`. At 600 px wide the session rows are two lines with no row actions, and a tap opens the session's page.

- [ ] C1. The Sessions area shows Yours, Waiting, Busy, Idle and Stopped with their counts and folds remembered per client, and rows with the facts of P22 from the hub's merged sessions; there is no Attach.
- [ ] C2. The verify line summarizes the queue and opens the queue view with the slots, the waiters with their executor, wait and ETA, and the metrics of the last 20 runs.
- [ ] C3. The accounts strip shows each account's worst window, a limited account in red with its reset and a dash without data; the Accounts area lists the registry with every window, its reset, the reading's age and its source.
- [ ] C4. Stop, Resume, Archive and Capabilities work from the selected row and from the session's page, Stop and Archive after a confirmation; Launch a session and New Aide work from the header, in the project's directory only.
- [ ] C5. The session's drawer shows its recent thread, its pending approval as a card and a composer to the session.
- [ ] C6. The notification switches and this browser's sign-in sit beside the profile in the Accounts area.
- [ ] C7. The Artifacts area shows the tree of v0.1 §3.6 and opens notes, pages and files, HTML in a sandboxed iframe never given `allow-same-origin`; `s`, `k` and `d` work as in Neovim.
- [ ] C8. `web/README.md` and `?` describe the Sessions, Accounts and Artifacts areas and their keys.

## Dogfooding

The human watches the crew and the verification queue from the browser: who waits and on what, the droplets and their spend, and the accounts' limits. A stuck session is stopped or resumed from its page, and the Coordinator's launches show up in their groups as they happen.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the prototype's Sessions area (`web/src/sessions.ts` and `sessions/SessionsArea.tsx` on `prototype/web-shell`); then the boards Sessions (canvas version 9, with the strip of cells) and PhoneSessions. Neovim's sessions panel, launcher, accounts block and artifacts browser (`nvim/lua/cland/sessions.lua`, `launcher.lua`, `accounts.lua`, `artifact_browser.lua`) define the behaviour where the web copies it.
- **Risks.** A launch from a page acts on the machine, so the form never takes a directory and the cookie's refused actions stay refused. An account without data must never read 0 percent.
- **Size.** About five sessions on the v0 scale.
- **Order.** In the web lane after E-416, in parallel with E-417; E-420 waits for it. Its drawer slice reuses the thread, the composer and the approval card of E-417 without an edge, so the Coordinator orders that slice after them; its approval card answers through E-414.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.2, §3.6 and §3.8 (no terminal); `docs/spec/v0.1.2.md` §3.4, §3.5, §3.6 and §3.13; `docs/spec/v0.1.md` §3.6 and §3.11.
- Map M-399 and the tickets this epic absorbs: Q-404 (the Sessions board, P20 to P23, and the folds remembered), Q-406 (the session row, the page and the confirmations, P27 to P30; the switches beside the profile).
- Research: `research/web-client-surface` (`docs/research/web-client-surface.md` §3.2, the rows for Sessions, Artifacts and Accounts).
- Prototype: `prototype/web-shell` (`web/src/sessions.ts`, `web/src/sessions/SessionsArea.tsx`).
- Mockups: `docs/design/web/Sessions.dc.html` (P20 to P23), `PhoneSessions.dc.html` (P27 to P30); `screens/v02-sessions.png`, `screens/v02-phone-sessions.png`.
- GLOSSARY: Session, Role, Aide, Account, Limited account, Artifact, Executor.

## Plan

```yaml
stages:
  - name: seams and the session list
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1130
        - T-1132
      - - T-1131
        - T-1147
  - name: acting, the queue, accounts and artifacts
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1136
        - T-1137
        - T-1138
      - - T-1133
      - - T-1134
        - T-1135
      - - T-1139
        - T-1140
  - name: on E-417's thread, composer and notifications
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1141
      - - T-1142
      - - T-1143
```
