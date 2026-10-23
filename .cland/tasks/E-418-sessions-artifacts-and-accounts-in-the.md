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
topic: topic-867
branch: null
created: 2026-10-14T15:59:25.029Z
updated: 2026-10-23T13:05:37.768Z
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
        - T-1155
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
      - - T-1160
```

## Comments

### qa-676 · 2026-10-22T23:07:36.436Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s1-2026-10-23-1
commit: 4411dcc99173b864850ac0988a11334d87262614
stage: seams and the session list
stage_hash: 9d1793d1f77049cfbe6c5a4de58921a8376ba7d60f6842ba8267f1328b8fc6ff
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-418 stage QA — clear

Run `qa-s1-2026-10-23-1`; commit `4411dcc99173b864850ac0988a11334d87262614`. Every scoped case passed.

| Case | Result | Observation |
|---|---|---|
| E418S1-00 | PASS | Clean S=dev, five members merged including T-1155, 37 env names removed / zero credential prefixes; helper parse pass. |
| E418S1-01 | PASS | Web bundle built from S; clean tree. |
| E418S1-02 | PASS | T1 state/authority/keymap 15/15. |
| E418S1-03 | PASS | T2 authority 39/39; all five named session cases present. |
| E418S1-04 | PASS | Snapshot 13/13 and workload 8/8 including verifier burst bound. |
| E418S1-05 | PASS | Sessions 5/5, five clean browser censuses. |
| E418S1-06 | PASS | Area slots 4/4, clean browser census. |
| E418S1-07 | PASS | Key context/palette/folds/connection/shell 33/33, all clean browser censuses; Sessions help assertion 17. |
| E418S1-08 | PASS | Items/card 14/14, clean censuses. |
| E418S1-09 | PASS | Typecheck, wire conformance, colours/contrast/hooks and tiers pass. |
| E418S1-10 | PASS | Single keyboard listener, allowed storage only, no browser merge/hex colours/new dependencies. |
| E418S1-11 | PASS | All 22 positive docs probes and absent obsolete text match; five key rows, surrounding docs consistent with observed behavior. |
| E418S1-12 | PASS | Seeding succeeds; 21 archived; correct live/stopped rows and compatibility keys. |
| E418S1-13 | PASS | Five groups/counts/order correct; latest 20 stopped; no Attach; screenshot inspected. |
| E418S1-14 | PASS | Row glyphs/roles/holds/request colours/usage correct; age 13s to 16s. Unknown model/account/usage facts render dash; Aide unknown state is allowed. |
| E418S1-15 | PASS | Full waiting command visible through END-OF-QA-COMMAND; j/down/k/up and Cyrillic physical J correct; screenshot inspected. |
| E418S1-16 | PASS | 17 help entries, required names only, last row contained. |
| E418S1-17 | PASS | Idle fold persisted across reload; no frames sent; restored. |
| E418S1-18 | PASS | All three pane/page/drawer modules correct; all four Sessions slots present. |
| E418S1-19 | PASS | Queue/account/artifact/row pushes observed; artifact row 1, Busy 0/Idle 4; no inventory list request. |
| E418S1-20 | PASS | Archive read once for 21 rows, refresh second read for 22, hides cleanly. |
| E418S1-21 | PASS | Default/clamped 50, whole-message 254688-byte page, older pages ordered, all 36 big messages gapless; older role and request notices retained as allowed. |
| E418S1-22 | PASS | Cookie/Unix/spoke history IDs equal, 50 messages, last h52; no secret/cookie leakage. |
| E418S1-23 | PASS | Only three own timestamps; fixed 30 days; selector ignored; local list/revoke boundary enforced; CLI listing matches four IDs. |
| E418S1-24 | PASS | Web cwd/string/empty/null refused, root launch correct; CLI scratch cwd retained. |
| E418S1-25 | PASS | 22 archived merged rows match Unix/web/CLI, legacy keys and snapshot equality unchanged. |
| E418S1-26 | PASS | 28 rows retained offline; new snapshot only qa-new and new account; zero reloads. |
| E418S1-27 | PASS | Linux A-9478/A-9479/A-9480 and macOS A-9485 green at S; plan cover complete. |
| E418S1-28 | PASS | Committed brief lint passes. |
| E418S1-29 | PASS | Rig 1/1; browser group before 4 after 0; all 12 fixture PIDs absent; scratch removed; final S=dev clean. |

## Findings

No product or probe findings.

## Shared stage cover receipts

Both Coordinator-owned full stage runs tested commit `4411dcc99173b864850ac0988a11334d87262614`, verification tree `95303fe6e1ec65315487e5c6c1231ae0f4fa8cd6`.

- Linux droplet run `4786647f-b5e0-4c6e-921c-d716fb816ce3`: exit 0; 3823 passed, 8 skipped, zero failures. Merged log A-9478; shard logs A-9479/A-9480. T1–T4 plus Web ran, Web 17 files/47 top-level tests. Two c-8 lon1 machines: cland-v0-c72db40c, admission-to-remote-finish 1100.90 s, collection 35.06 s, lifetime 1086 s, $0.0754; cland-v0-a263d360, 982.90 s, collection 20.44 s, lifetime 966 s, $0.0671. Actual overall admission-through-collection wall 1136.23 s, total $0.1425. T-1155 T4 100-frame verifier case passed with 201/200/100 pending reads (A-9480); its earlier targeted receipt A-9469 is supporting evidence only.
- macOS local run `c6c2ee05-f2b4-444e-b6a4-9e8bfefb6d27`, A-9485: exit 0; 3831/3831 passed, zero failures or skips. Darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5, two workers. T1–T4 plus Web ran (17 Web files/47 top-level tests, 93 including nested cases). Actual runner phase walls T1 30.71 s, T2 178.75 s, T3 915.61 s, T4 46.45 s, Web 33.68 s. Job queued 22:44:42.036Z, finished 23:05:12.908Z: 1230.872 s queued-to-finish, including admission/host-gate overhead, not pure test wall. Local monetary cost not reported; no droplet lifetime applies.

T4 base phase ran on both; T4 repetitions were explicitly skipped. Duration budgets and ratchet diagnostics are report-only, not enforced budget passes; projections are not measured walls. No QA full suite was submitted. Fresh plan reads show the applicable stage cover complete on both platforms. No epic criterion marks.

All fixture cleanup and earlier detailed observations remain in report-before-covers.md and original captures. Final HEAD/dev still equal S; detached tree clean apart from the allowed node_modules symlink. Stage verdict only; no criterion marks.

Evidence A-9489: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9489-e-418-stage-qa-clear-at-4411dcc9-final-cases-and-both-stage-covers/report.md

### qa-676 · 2026-10-23T02:19:50.641Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s2-2026-10-23-1
commit: d32c6a8ff74d2052596f68c77d38dccaad879163
stage: acting, the queue, accounts and artifacts
stage_hash: 903a3531f1d145867765a1a9c44f0a863bf6b93a17329818625c730f87753574
findings: [{"severity":"low","text":"E418S2-12 lines 220–221 still describe Artifacts ID/title details. Prescribed documentation counts pass; current viewer is proven. Coordinator 96456659 accepts low finding, fix T-1160 in stage 3.","file":"web/README.md","line":220},{"severity":"low","text":"E418S2-14 screenshot expectation: rig captures after strip() clicks Accounts. Structured cells/colours/meters/tooltips/link facts pass; screenshot retained as Accounts-link evidence under Coordinator a081aa37. No rerun. Prescribed E418S2-20 screenshot also shows strip above verify.","file":"qa/briefs/E-418-stage-2.md"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| E418S2-00 | hub-api | PASS | E418S2-00-output.txt, E418S2-00-plan.json, E418S2-00-stage.txt |
| E418S2-01 | hub-api | PASS | E418S2-01-output.txt, E418S2-01.log |
| E418S2-02 | hub-api | PASS | E418S2-02-output.txt, E418S2-02.log |
| E418S2-03 | hub-api | PASS | E418S2-03-output.txt, E418S2-03.log |
| E418S2-04 | hub-api | PASS | E418S2-04-output.txt, E418S2-04.log |
| E418S2-05 | hub-api | PASS | E418S2-05-output.txt, E418S2-05.log |
| E418S2-06 | hub-api | PASS | E418S2-06-output.txt, E418S2-06.log |
| E418S2-07 | hub-api | PASS | E418S2-07-output.txt, E418S2-07.log |
| E418S2-08 | hub-api | PASS | E418S2-08-output.txt, E418S2-08.log |
| E418S2-09 | hub-api | PASS | E418S2-09-output.txt, E418S2-09-test-names.txt, E418S2-09a.log, E418S2-09b.log, E418S2-09c.log, E418S2-09d.log, E418S2-09e.log |
| E418S2-10 | hub-api | PASS | E418S2-10-output.txt, E418S2-10-tiers.log, E418S2-10.log |
| E418S2-11 | hub-api | PASS | E418S2-11-output.txt, E418S2-11.txt |
| E418S2-12 | hub-api | PASS | E418S2-12-disposition.txt, E418S2-12-docs-context.txt, E418S2-12-output.txt, E418S2-12-stale-lines.txt, E418S2-12.txt |
| E418S2-13 | hub-api | PASS | E418S2-13-list.json, E418S2-13-output.txt, E418S2-13-ready.json |
| E418S2-14 | hub-api | PASS | E418S2-14-disposition.txt, E418S2-14-output.txt, E418S2-14.json, E418S2-14.png, E418S2-14.txt |
| E418S2-15 | hub-api | PASS | E418S2-15-output.txt, E418S2-15.json, E418S2-15.png, E418S2-15.txt |
| E418S2-16 | hub-api | PASS | E418S2-16-output.txt, E418S2-16.json, E418S2-16.png, E418S2-16.txt |
| E418S2-17 | hub-api | PASS | E418S2-17-output.txt, E418S2-17.json, E418S2-17.png, E418S2-17.txt |
| E418S2-18 | hub-api | PASS | E418S2-18-output.txt, E418S2-18.json, E418S2-18.png, E418S2-18.txt |
| E418S2-19 | hub-api | PASS | E418S2-19-output.txt, E418S2-19.json, E418S2-19.png, E418S2-19.txt |
| E418S2-20 | hub-api | PASS | E418S2-20-output.txt, E418S2-20.json, E418S2-20.png, E418S2-20.txt |
| E418S2-21 | hub-api | PASS | E418S2-21-output.txt, E418S2-21.json, E418S2-21.png, E418S2-21.txt |
| E418S2-22 | hub-api | PASS | E418S2-22-output.txt, E418S2-22.json, E418S2-22.png, E418S2-22.txt |
| E418S2-23 | hub-api | PASS | E418S2-23-plan-final.json, E418S2-23-cover-receipt.txt |
| E418S2-24 | hub-api | PASS | E418S2-24-output.txt, E418S2-24.txt |
| E418S2-25 | hub-api | PASS | E418S2-25-output.txt |

Build: d32c6a8ff74d2052596f68c77d38dccaad879163, clean detached tree before and after. Run qa-s2-2026-10-23-1. Local macOS arm64, Node24.21.0, isolated Chrome Headless Shell. Web bundle built from S. 89 named tests plus the one walkthrough rig passed, zero failures/skips; typecheck, lint tiers, colour/contrast/hooks guards and brief lint passed. Every named Web fixture census clean; walkthrough browser before4/after0, scratch hub stopped, owned two-PID census empty, scratch root removed. No real browser, live-edge mutation or full suite run by QA. All scoped cases PASS.

Low findings:
- E418S2-12, web/README.md:220–221 still says Artifacts page/drawer retain ID/title details. Current capability viewer proven by tests and walkthrough; all prescribed documentation counts pass. Coordinator disposition 96456659 accepts low finding; fix T-1160 (XS, stage 3). See retained docs context and disposition.
- E418S2-14 brief screenshot expectation: strip() navigates to Accounts before the rig captures its screenshot, so E418S2-14.png is Accounts-link evidence. All structured strip measurements pass. Coordinator a081aa37 authorized PASS with this low brief finding and no rerun. E418S2-20.png independently shows the strip above verify, plus aide-1 under Yours, as part of that prescribed step.

All page steps ran once on the same sealed scratch hub. Account profile remains isolated across contexts; queue ages without frames and resets on a replacement frame; session actions preserve identity and require confirmations; launch has no cwd field and honors defaults/limited account refusal; capability iframe sandbox is exactly allow-scripts and all three document/cookie probes return SecurityError. Text remains literal, binary bytes match, raw Mermaid remains text and SVG stays sandboxed. Help final rows are visible.

Queue sample none/waiters0; sampled CPU idle92.97%. Test duration diagnostics are report-only and are not stage speed claims. No stage criterion marks.

Stage covers at d32c6a8ff74d2052596f68c77d38dccaad879163, verification tree f3ac7b4d73c8e68f127bceb4ced633ac27e3e6f0: final plan missing=[]; all stage members merged. Detached HEAD and dev both equal S, clean detached status.
- Linux droplet 83a773e8-7ec5-43fb-b117-d4d2e0f60b2a: green, 3923 pass, 0 fail, 8 skip. Merged A-9755; shard logs A-9756 and A-9757. linux x64, 2 workers, T1–T4 and Web. Shard 1 cland-v0-75f6311a (c-8 lon1): 1095.56 s admission through remote finish, lifetime 1086 s, $0.0754; collection 25.39 s. Shard 2 cland-v0-afc1850f (c-8 lon1): 954.56 s, lifetime 938 s, $0.0652; collection 19.07 s. Overall wall 1121.20 s; total $0.1406.
- macOS local bd2aafa5-9fec-4161-8d87-3a4de930cac3: green, 3931 pass, 0 fail, 0 skip; A-9764. darwin arm64, 2 workers, T1–T4 and Web. Overall macOS wall/cost not stated in the receipt; no projection substituted.
- Both covers ran T4 base files only; T4 repetitions skipped. Timing budgets and lint report-only; projected tier walls are not observed overall walls.
- Original failed Linux 10fcb1d8 retained as A-9739, shard logs A-9740/A-9741. Exact failure: `AssertionError [ERR_ASSERTION]: first hub.status took 10424.6 ms; T-1081 budget 10000 ms` (startup-replies-scale.test.ts:81). Coordinator classified known flake T-1094 and authorized same-head retry. Original incomplete run is not counted as passing coverage: overall wall 996.20 s, total $0.1273. Original and retry Linux billed total $0.2679; summed observed run walls 2117.40 s, not an end-to-end elapsed-time claim.

Durable evidence A-9767: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9767-e-418-stage-acting-queue-accounts-and-artifacts-26-pass-at-d32c6a8f-both-covers-/report.md

### qa-676 · 2026-10-23T13:05:37.768Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s3-2026-10-23-1
commit: d64dad5ad82fedb6773499ba38673c98a09f4c92
stage: on E-417's thread, composer and notifications
stage_hash: 205475cf595e2da6b40d02fd77703f57aceb9015f6b7bf38da25ecd069f5bea8
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface | Result | Command and observation |
| --- | --- | --- | --- |
| E418S3-00 | hub-api | PASS | [QA shell] clean S=dev; plan4/4 merged; landing paths correct; sealed counts37/0; probe parses; system TMPDIR |
| E418S3-01 | hub-api | PASS | [macOS] brief row01 at S; observed exact stated counts and exit0 where applicable |
| E418S3-02 | hub-api | PASS | [macOS] brief row02 at S; observed exact stated counts and exit0 where applicable |
| E418S3-03 | hub-api | PASS | [macOS] brief row03 at S; observed exact stated counts and exit0 where applicable |
| E418S3-04 | hub-api | PASS | [docs] required strings/headings present,6 stale absent; full named sections match static/tests/probe; old h/Esc candidate fixed Return to list; no low contradictions |
| E418S3-05 | hub-api | PASS | [macOS] brief row05 at S; observed exact stated counts and exit0 where applicable |
| E418S3-06 | hub-api | PASS | [test macOS] session-drawer.test.ts 7/7 all required names, no skips/failures; 7 clean censuses |
| E418S3-07 | hub-api | PASS | [test macOS] named file 23/23 pass, no failure/skip; required names and 23 clean censuses |
| E418S3-08 | hub-api | PASS | [test macOS] named file 8/8 pass, no failure/skip; required names and 8 clean censuses |
| E418S3-09 | hub-api | PASS | [test macOS] artifacts11/11 and thread-artifacts5/5, required names all pass;16 clean censuses |
| E418S3-10 | hub-api | PASS | [test macOS] topics9/9 and five prescribed deterministic Retry repetitions each1/1, all first-attempt no skip/fail and14 clean censuses |
| E418S3-11 | hub-api | PASS | [test macOS] 11 serial regression files71/71 pass no skips/failures; names match S,49 clean Web censuses,T1 no browser |
| E418S3-12 | hub-api | PASS | [sealed macOS HeadlessShell] independent probe1/1; all10 fact groups exactly match including history32, fake approval/injections, isolation, attachment;0 step errors and1 clean census |
| E418S3-13 | hub-api | PASS | [sealed macOS] full typecheck0 and4guards; tiers lint0 and four Web classifications |
| E418S3-14 | hub-api | PASS | [cited Coordinator stage covers] S Linux400490b3 A10031/shardsA10032,A10033 and macOSffdf195d A10035 green T1-T4+Web; plan complete |
| E418S3-15 | hub-api | PASS | [QA shell] 118 fixture censuses all after0; T1 no browser; scratch removed; detached HEAD and dev remain S and clean |

No findings. All 16 scoped checks PASS at d64dad5ad82fedb6773499ba38673c98a09f4c92. Run qa-s3-2026-10-23-1; stage **on E-417's thread, composer and notifications**. Stage verdict carries no criterion marks.

Four printed plan members T-1141, T-1142, T-1143, T-1160 all landed. The tested tree is clean and dev stayed at S. Node v24.21.0, macOS arm64; isolated Chrome Headless Shell, sealed HOME/XDG/Git and credential filter after overlays (37 inherited keys removed; credential-prefix count 0). System TMPDIR retained. No real browser, live sign-in, real harness, provider call, or OS-notification claim.

139 named tests/repetitions plus the independent probe passed (140 total), zero failures/skips/cancellations. All 118 Web fixture censuses end after 0 with scratch hub stopped; T1 keymap has no browser. The five standalone Retry runs are prescribed deterministic checks, not retries of failures. The independent probe retained all ten fact groups: 32 ordered cross-topic messages, exact fake approval and injection receipts, focus, per-browser switches, Markdown source/rendering and attachment receipt. Scratch root removed. Setup/probe sources, full TAP logs, docs, case records and command outputs are retained.

Docs: required strings/headings pass; six stale strings absent. Read full required sections and compared them with static and behavioral observations. The brief's old h/Esc candidate is dismissed: web/README.md:215 says Return to list at S. No contradictory prose found.

Cited stage covers at the same full SHA (not rerun by QA):
- Linux droplet 400490b3-bfbb-499e-b05a-20dac173d88a, merged A-10031, shard logs A-10032/A-10033; 4016 passed, 8 platform skips, 0 failed. Linux x64 6.8.0-142-generic; Node24.21.0/Neovim0.12.5. Host check plus T1,T2,T3,T4 and Web completed; every shard exit0. T4 base phase only; extra load repetitions skipped. Overall admission-through-collection wall1238.85s, cost$0.1494. Shard1 cland-v0-37dcbd14 duration1218.47s, lifetime1198s,$0.0832; collection19.52s. Shard2 cland-v0-829b3f9c duration970.47s,lifetime954s,$0.0663;collection67.11s. Rounded shard costs do not sum exactly to rounded group cost.
- macOS local ffdf195d-cfab-4e48-ac6f-4a95e0c15972, A-10035; 4024/4024 passed, no skips/failures; darwin arm64 27.0.0 Node24.21.0/Neovim0.12.5. Host check plus T1,T2,T3,T4 and Web exit0, base-phase T4 only. Reported phase wall: T1 31.46s,T2 183.10s,T3 940.79s,T4 46.84s,Web89.50s. Overall execution wall is not separately reported; queued12:38:01.484Z to result13:00:06.478Z is1324.994s queue-to-report elapsed, not isolated execution wall. Droplet cost not applicable.
- Budget, test-lint and ratchet observations are report-only, including132 lint findings/59files and projected T3/Web overages. Projections are not measured wall times. Plan explicitly reads stage cover complete (Linux droplet, macOS), tree bcde3ae36d1cd4aa057139fc73f5883e79fbd05e.

Coordinator decision61439049 authorized running this stage during E-417's epic-cover wait, with E-417 local13 first after the Mac freed. Holds and evidence stayed separate. No source/brief correction or test rerun was needed. Rule proposal sent in topic-867: distinguish parameterized passing names and fixture census expectations from drafting-time TAP counts.

Durable evidence: A-10037 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10037-e-418-stage-3-at-d64dad5a-16-pass-140-tests-and-probes-both-covers-green/report.md
