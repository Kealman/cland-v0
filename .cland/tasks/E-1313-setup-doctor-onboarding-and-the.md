---
id: E-1313
kind: epic
title: Setup, doctor, onboarding and the workbenches
state: closed
criterion_seq: 9
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1308
topic: topic-1180
branch: null
created: 2026-10-25T14:12:00.125Z
updated: 2026-10-29T15:54:09.984Z
closed: 2026-10-29T15:54:09.984Z
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
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.378Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C2. Without a terminal the remote step reports what is open with its commands, a declined messenger is `skip`, and a second run reports `ok`.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.378Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C3. For Discord, setup checks Public Bot, the Message Content flag and the empty Interactions Endpoint URL, and names what to change.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.378Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C4. Doctor shows, per messenger, the token's presence with its fingerprint, the connection state, the pairing and a stopped remote's cause with its fix, and makes no platform or paid call.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.378Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C5. Both workbenches show a Remotes row with the connection, the pairing, mute, the outbox depth and the last error, red at once on a failure.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.378Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C6. Pairing rows show in both inboxes, Neovim's card approves them, and the web's row points to the terminal or Neovim without an approve action.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.378Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C7. Messages, approvals and ask outcomes from a remote carry their source mark in both workbenches, and voice messages their 🎤 marker.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.379Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C8. The onboarding's tour has a stage on remote control whose commands match the build.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.379Z · commit 370fe48234f02558c04b985f887ff6c428a8791e
- [ ] C9. The web-and-phone page has a section on remotes, and a new page covers `cland remote` and `cland secret` as built.
  - verified: qa-677 [qa] · run qa-dod-2026-10-29-677-1313 · 2026-10-29T15:53:46.379Z · commit 370fe48234f02558c04b985f887ff6c428a8791e

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

### hub · 2026-10-29T15:41:18.889Z

demo 185b81c0-51aa-4b1e-b06e-ad95d497aad4 created: droplet cland-v0-185b81c0, commit 370fe48234f02558c04b985f887ff6c428a8791e, deadline 2026-10-29T16:53:54.275Z.

### hub · 2026-10-29T15:47:47.210Z

demo 185b81c0-51aa-4b1e-b06e-ad95d497aad4 destroyed: lifetime 433035 ms; cost $0.0301.

### qa-677 · 2026-10-29T15:53:46.379Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-29-677-1313
commit: 370fe48234f02558c04b985f887ff6c428a8791e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface / executor | result | observation and evidence |
| --- | --- | --- | --- |
| M1 (C1,C2) | hub-api / droplet | PASS | 23 setup-remotes cases passed. Guidance precedes hidden prompt, correct step order, enable/pair-on-yes, speech data-use before key, nonterminal commands and skip/ok. Telegram false/false uses the untouched case at line 65 per Coordinator decision a277e1e2; loop line137 intentionally excludes it. hub/test/setup-remotes.test.ts; brief-amendment.json |
| M2 (C1,C2,C3) | hub-api / droplet | PASS | 7 remote component + 3 pairing component cases passed: native application checks and repair/decline branches, only explicit local approval, frame reload, paired rerun ok, no credential output. hub/test/setup-remote-component.test.ts; hub/test/setup-pairing-component.test.ts |
| M3 (C1,C2) | hub-api / droplet | PASS | 9 prompter + 7 CLI cases passed. Hidden input/raw-mode cancellation and EOF recovery use scripted terminal streams; no claim of a real human terminal echo check. hub/test/setup-prompter.test.ts; hub/test/setup-cli.test.ts |
| M4 (C1,C2) | hub-api / droplet T3 alone | PASS | The native setup scenario passed in 15.081 s. It asserts a live hub PID, running Aide, reused hub, step order and re-offered declined remotes; it did start a real scratch hub process. hub/test/scenarios/setup.test.ts |
| M5 (C4) | hub-api / droplet + local source | PASS | All 16 doctor cases passed, including native Discord fatal-code pairing details and no platform/provider requests. Discord token fingerprint row is separately source-checked in M14. hub/test/doctor-remotes.test.ts; source-checks.json |
| M6 (C4,C5,C6) | hub-api / droplet | PASS | 5 workbench + 23 remote CLI cases passed: pushed connection, pairing, mute/outbox/errors, local approval boundary, structured causes and rotated credentials. hub/test/remote-workbench.test.ts; hub/test/remote-cli.test.ts |
| M7 (C5,C6,C7) | web-terminal / droplet Web | PASS | All 3 real Headless Shell cases passed: Telegram desktop/phone and native Discord outage/recovery, red within one second, bounded phone width, read-only pairing and provenance/voice. web/test/remotes.test.ts |
| M8 (C6) | web-terminal / droplet Web + Neovim | PASS | 4 top-level + 1 nested cleanup test passed. Both platforms' pairing rows are read-only on Web under actual keys; Neovim local approval and expiry ran. Timings desktop4.147<9.2 s, phone3.735<8.2 s, native shared-card1.735<4.7 s. web/test/pairing.test.ts; pairing-allowances.json |
| M9 (C5,C6,C7) | web-terminal / droplet T3 alone | PASS | 2 top-level + 2 nested Neovim receipt tests passed, no skips. Telegram and native Discord outage/recovery, red-to-dim, pairing, text/voice and approval provenance rendered. nvim/test/remotes.test.ts |
| M10 (C7) | hub-api / droplet + Web + Neovim | PASS | Gateway20, Neovim1 and Web2 passed. Both sources appear on messages, asks and approvals; previous outcome shape remains readable. hub/test/gateway.test.ts; nvim/test/remote-via.test.ts; web/test/remote-via.test.ts |
| M11 (C7) | web-terminal / droplet; Neovim T3 alone | PASS | Web1, Neovim1 top-level +1 nested, and3 fixture-drain cases passed. Voice/header markers, six-marker Neovim count, audio/transcript/literal captions and approvals checked; no skips. web/test/telegram-marks.test.ts; nvim/test/telegram-marks.test.ts; hub/test/telegram-marks-setup.test.ts |
| M12 (C8) | hub-api / droplet + local source/CLI | PASS | All15 onboarding cases passed; stage9 read manually. Generated usage/commandProblems validates cland commands; scratch remote/secret --help captures retained, native slash commands compared with help. No unsupported command found. hub/test/skills-onboarding.test.ts; tour-stage.md; remote-help.json; secret-help.json |
| M13 (C9) | hub-api / droplet + local source | PASS | Site10, hub docs1 top-level +10 nested and published pairing1 passed. Web ## Remotes and remote-control.md exist; page commands execute in-order against fakes and finish paired. site/test/remote-docs.test.ts; hub/test/remote-docs.test.ts; hub/test/remote-docs-pairing.test.ts; source-checks.json |
| M14 (C3,C4) | hub-api / local macOS source | PASS | Step order, both-token fingerprint loop, local remote.status-only doctor I/O, Public Bot, endpoint URL and both Message Content bit checks found. Negative source scan has a positive control; runtime no-call assertions remain M5. source-checks.json |
| M15 (C1–C9) | hub-api / local macOS record audit | PASS | 12 closed done children, all clear hub review + same-reviewed-head green verify + reviewed delta landed; 4 closed stages. Both final cover logs green and contain every landing. T-1364 differs only by one blank CHANGES line. C1-final.json; T-1364-landing-reconciliation.json; C2-cover-receipts.json; cover-summary.json; epic.json |

qa clear E-1313. No high, medium or low product findings. C1–C9 proved by run qa-dod-2026-10-29-677-1313 at 370fe48234f02558c04b985f887ff6c428a8791e.

All 22 declared files ran serially: 158 top-level tests plus 14 nested tests, 172 native passes, no failure/cancellation/skip/todo. A supplemental served-page stamp probe passed (1) after the Web build. Required generated names and source hashes were checked independently of exit status; shared results are counted once. The declared T1/T2/T3/Web and site files ran, not a full-suite rerun. M4, M9 and M11's native Neovim file ran alone. No fixture endpoint was repaired or redirected during QA, and no missing-loopback refusal occurred.

Runtime: Linux x64 demo droplet, Node v24.21.0, Neovim v0.12.5, Chrome Headless Shell 156.0.8078.4, Playwright revision 1248. Browser binary: /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell. Fixtures used sealed scratch HOME/XDG/Git through the shared builder, filtered provider/account credentials and loopback fakes. Browser user-data-dir was scratch-owned and browser cleanup censuses ended at zero. Source/records and the two help commands ran locally on macOS in the clean pinned detached worktree. No live doctor, real bot, speech service or human-browser flow was exercised.

Source, Web bundle and served-page digest all match 4a468700a6e84eccb05877ab9f8a1e9f9b482457bfb93e3d94346fa0a9f610c2. Exact commands are in each file's metadata; each native run was node --test <file> through cland demo exec E-1313. The local commands were node hub/bin/cland.ts remote --help and secret --help under the sealed fixture environment.

M8 timing: desktop 4.146687999 s against 9.2 s; phone 3.734866696 against 8.2 s; shared Neovim pairing card 1.734870544 against 4.7 s. Allowances belong to R-1278 and expire 2026-11-03. These are native case durations, excluding provisioning, transport, prior cases and the CPU sample; not whole-demo wall time. The one-second pre-pairing sample was 100% idle (load 1.12/0.50/0.20); the M4 and M9 pre-run samples were also 100% idle. The exclusive demo ran no concurrent suite or targeted file. No timing retry.

M1 brief correction is authorized by Coordinator decision a277e1e2-83de-44bb-9758-fc6309624e19 in topic-1180. The Telegram loop deliberately omits false/false at setup-remotes.test.ts:137. Its other three cases appeared and passed; the fourth state is the separate “untouched nonterminal Telegram is skip with exact setup commands and no writes” case at line 65. This is a brief expansion error, not a product finding. Exact nonterminal fixes: cland secret set telegram.token; cland config set remote.telegram.enabled true; cland hub reload; and the same commands for discord. All generated names are retained via safe display text plus original SHA256 where broad credential redaction masked public boolean labels.

M12's tour was read once and compared with generated usage and the scratch remote/secret help. Commands setup, doctor and hub reload match their generated usage; native /status, /inbox, /mute, /unmute and /cland pair/status/inbox/mute/unmute match remote help. The tour/document guards also ran with their unknown-command/config/secret-name positive controls. M14's Discord token fingerprint is explicitly source evidence, not a runtime fingerprint assertion. M5's no-platform/no-paid-call cases passed their zero-network, unchanged fake request list and speech-provider assertions. Hidden input evidence is the scripted prompter and raw-mode tests, not a real human terminal echo check.

M15: all 12 children closed done, all 4 stages closed. Each child has a clear hub review, a green verify at that same reviewed branch head and the reviewed delta landed on dev with Item/Reviewed-by evidence; this does not equate reviewed branch SHA with integration SHA. T-1364's strict patch-id discrepancy is only one omitted blank line in implement/CHANGES; all nonblank deltas match. Raw audit and reconciliation retained. Latest valid pre-landing receipts are named individually. No waiver required.

Stage cover pair: Linux 32f0edb3/A-13725 and macOS 488fa4ff/A-13729 at 06e2b10ed80a10966e2b4378be303a5bef40146c, tree df71dc68c9c551c19669e95480059bc6dea3899c. All 158 scoped top-level identities passed on both. Aggregate native summaries: Linux 5669 passes/9 skips, macOS 5677 passes/1 skip, zero failures; scoped files had no skips. Static gate and T1–T4 plus Web receipts passed. Linux used host npm run check at the cover tree (not repeated remotely); macOS typecheck was local. Each cover also has 31 separate five-pass load identities (155 repetitions), kept separate from native totals. Duration budgets and Web repetition gate were report-only; 14 T4 files ran base-only with load repetitions explicitly excluded. No excluded repetition is counted as a pass.

Linux cover c-8 nyc1 machine lifetimes 1503.699 s and 1740.237 s cost $0.1044235417 and $0.1208497917 (total $0.2252733334). Their admission-through-remote-finish times 1521.00 s and 1669.00 s are separate observations, not summed wall time. macOS carries no droplet cost. The later pinned commit changes only hub/test/durations.json and implement SKILL.md/CHANGES; actual post-cover file list retained.

Evidence extraction corrections are retained: the first name parser treated two quoted CSS attribute values as titles; the corrected parser classifies them as selectors, without a product rerun. The publication scanner initially recognized public command regex strings as credential literals; only the two exact token-setting command patterns were excluded from that custom value registry. Generic credential scanning and fabricated-value positive controls remained active. No evidence was published before the final scan.

Freshness current:true. Demo lease 185b81c0-51aa-4b1e-b06e-ad95d497aad4, deadline 2026-10-29T16:53:54.275Z, commit 370fe48234f02558c04b985f887ff6c428a8791e; stop initially returned releasing, followed by confirmed released status before verdict. Final lifetime 433035 ms, cost $0.030071875, from demo-released.json. Interim releasing estimates are not final accounting.

Out of scope remains real platforms/credentials, the human's live bot run, E-1312 messenger behavior already demoed, Telegram-only features from E-1311, and separate T-1438/T-1439 work. No product changes were made.

M15 tracker-status note: the brief still calls T-1438 and T-1439 open. Both are now closed done, merged, under R-1278, with passed receipts A-13693 and A-13687. They remain outside E-1313's twelve children. This stale status wording adds no runtime finding; current records are in separate-bugs-status.json.

Evidence: A-13733, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13733-e-1313-dod-qa-clear-at-370fe482-evidence-and-receipts/report.md. All 15 recorder rows are retained. Final publication scan passed across 92 declared output files, with 360 fixture-source dependencies and positive controls.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C9 verified.

### coord · 2026-10-29T15:54:09.984Z

Setup, doctor, onboarding and the workbenches are complete. All four stages closed with green cover pairs; the last was 32f0edb3 (Linux, A-13725) and 488fa4ff (macOS, A-13729) at 06e2b10e. QA DoD clear: qa-dod-2026-10-29-677-1313 at 370fe482, M1–M15 PASS, C1–C9 verified, no product findings (A-13733, brief qa/briefs/E-1313.md). The brief needs two maintenance edits, which follow: M1's generated loop has three pairs plus a separate false/false case, and M15 still calls T-1438 and T-1439 open. The three web pairing allowances are owned by R-1278.
