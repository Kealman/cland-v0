---
id: E-1536
kind: epic
title: Users and sign-in modes
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1294
branch: null
created: 2026-10-31T18:22:04.289Z
updated: 2026-11-03T07:37:11.624Z
---

## Goal

A project chooses how the web admits people. The single mode is today's: one human, one-time links, one cookie identity. The new users mode gives each person a user with a passkey or a password, created by invitation. Everything a person does through cland records who did it: messages, ask answers, approvals, pairings, web sessions and artifacts. Agents see the author's name, so the Coordinator can tell people apart. The users mode has one role, admin, and the permission checks live in one table so that more roles later are rows, not a refactor. This epic is independent of hosts and runs in parallel from the start of the build. Shape B needs it, because a web behind an Ingress must admit more than one person, while shape A can live without it (Q-1527).

## Contents

- **The sign-in mode** (spec §3.8). `[auth] mode = "single" | "users"` in `.cland/config.toml`, default `single`, written by `cland init` and added by `cland update`. Single mode is unchanged. Switching to users creates the first user from the current identity, named from git's `user.name`; the way back is only `cland auth reset`. Demo: a project switched to users keeps its history, now attributed to the first user, and `cland auth reset` returns it to single.
- **Users and roles in `hub.db`** (§3.8). A `users` table (id, name, display name, role, state, created) and a `roles` table holding `admin` only. Demo: `cland user add` creates a row with the admin role.
- **`user_id` on everything human** (§3.8). The human's messages, ask answers and approvals (outcomes record who answered), Telegram and Discord pairings, web sessions (a cookie maps to a user) and artifacts a human created; the hub journal records the `user_id` of every human action. Deliveries to agents carry the author's name. Demo: two users write in General and answer one ask each; the Coordinator's deliveries name them, the outcomes name who answered, and the journal holds both ids.
- **Invites, passkeys and passwords** (§3.8). An admin creates a user with `cland user add <name>` or from the web and gets a one-time invite link (24 hours, assumed in the spec); the invite page registers a passkey (WebAuthn) as the primary method, or a password as the fallback; sign-in by either. Built on `node:crypto` with no new dependency (scrypt for passwords; WebAuthn's attestation-free registration and assertion checked by hand, assumed in the spec). Demo: in headless Chromium with a virtual authenticator, an invited user registers a passkey and signs in; another sets a password and signs in; a used or expired invite is refused.
- **The web in users mode** (§3.8). The sign-in page in place of the link-only flow, the cookie bound to the user, sign-out, the admin's users list with invite creation, and the user shown on the human's messages, answers and approvals in both workbenches. Single mode keeps today's link flow. Demo: two browsers as two users see each other's messages attributed.
- **The authority seam** (§3.8). The web edge's authority table (`hub/src/hub/web-authority.ts`) gains a user-role column; every check reads the user's role from one place; all requests are open to `admin`. Demo: a test role with one request removed is refused that request through the same table, and the refusal names the role (a test-only row; no second role ships).
- **Neovim and the CLI** (§3.8). Local trust through the hub socket; in users mode the CLI acts as the first user, and an admin may pass `--as <user>`. `cland topic answer` and `topic create` already take `--as <stand-in name>`; in users mode that value must name a user, and in single mode it keeps today's meaning (assumed). Demo: `cland topic answer <ask> 1 --as <user>` records that user as the answerer.
- **Remotes in users mode** (§3.8). A pairing belongs to one user: the code from `/start` or `/cland pair`, approved by an admin from Neovim or the CLI as today; one chat is one user. General is mirrored to every paired user; asks reach everyone; the first answer wins and shows who answered. In one Discord channel, people are told apart by Discord user id; unpaired members are ignored. Demo: on the test messengers, two users paired, an ask answered by one folds the other's card with the answerer's name.

Not in this epic: roles other than admin, per-user notifications and inboxes, personal settings, OIDC and SSO, deleting a user with a transfer of pairings, user management from Telegram (deferred, spec §3.8); setup's sign-in step, doctor's lines and the docs pages ("Workbenches, doctor, setup and docs for hosts", its users stage).

## Order

1. **The mode and the first user.** Config, the tables, the switch and the reset. Demo: a switched project attributes its history to the first user.
2. **`user_id` everywhere.** Messages, answers, approvals, artifacts, the journal, deliveries with names. Demo: two users in General, as above.
3. **Invites and sign-in on the web.** Invite links, passkey and password, the sign-in page, cookies per user. Demo: the virtual authenticator registration and sign-in.
4. **The authority seam and the CLI.** The user-role column, `--as`. Demo: the test role's refusal; a CLI answer as another user.
5. **Remotes per user.** Pairings per user, mirror to all, first answer wins with the answerer shown. Demo: two paired users on the test messengers.

## Definition of done

QA runs the demo below on `dev` through the hub's frame protocol, the `cland` CLI, headless Chromium and a headless Neovim workbench, with the test messengers of the v0.3 suite, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

In a scratch project in single mode QA checks the web link flow is unchanged. It switches to users and reads the first user named from git's `user.name`, with earlier messages attributed to it. It creates a second user with `cland user add`, opens the invite in headless Chromium with a virtual authenticator and registers a passkey, creates a third user who sets a password, and reuses an invite to read the refusal. Two browser contexts as two users write in General and answer one ask each; QA reads the attribution in both workbenches, the names in the Coordinator's deliveries, the answerer in each outcome and the user ids in the journal. It pairs two users on the test messengers, has the Coordinator ask, answers from one remote and reads the other's card fold with the answerer's name. It answers an ask from the CLI with `--as` and reads the attribution. It reads the authority table's user-role column and the test role's refusal. Finally it runs `cland auth reset` and reads single mode back.

- [ ] C1. `[auth] mode` is `single` by default with today's behaviour unchanged, switching to `users` creates the first user from the current identity, and `cland auth reset` is the only way back.
- [ ] C2. Users and the `admin` role live in `hub.db`, and an admin creates a user with `cland user add` or from the web and gets a one-time invite link.
- [ ] C3. An invited user registers a passkey or a password and signs in with it, and a used or expired invite is refused.
- [ ] C4. Messages, ask answers, approvals, pairings, web sessions and artifacts from a person carry their user, outcomes show who answered, deliveries to agents name the author, and the journal records the user of every human action.
- [ ] C5. The web edge's authority table has a user-role column through which every check passes.
- [ ] C6. In users mode the CLI acts as the first user and an admin may act `--as` another.
- [ ] C7. Each remote pairing belongs to one user, General reaches every paired user, and the first answer to an ask wins with the answerer shown on every copy.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch, push to `origin`, reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items through `cland task` only.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig. No new runtime dependency without the human's approval: WebAuthn and password hashing on `node:crypto`. If a hand-written WebAuthn check proves unsafe, the Coordinator asks the human about a dependency rather than weakening the check.
- **The web.** `web/` rules hold: CSS Modules and `var(--token)` from `web/src/tokens.css`, structure copied from `web/src/Shell.tsx`, secondary text at 4.5:1, no UI library, key bindings only through `web/src/keymap.ts`. Names and counts in the interface, explanations in tooltips and docs.
- **Single mode unchanged.** No migration changes what a single-mode project's human sees or does; every existing web, CLI and remote test passes untouched in single mode.
- **Secrets.** Passwords are stored only as scrypt hashes, passkeys as public keys; invite links and cookies only as digests, as `web.link` does today. None appears in a log, a frame or the journal.
- **ADRs.** 0003 (the web edge and its admission, the gateway's narrow authority, which does not grow); 0001 (the identity `human` becomes a user, never a role of a session).
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** Parallel from the start: no blocking edge. The users stage of "Workbenches, doctor, setup and docs for hosts" waits for this epic.

## References

- Spec: `docs/spec/v0.4.md` §3.8 (users and sign-in modes), §3.12 and §4; `docs/spec/v0.3.md` §3.1 and §3.2 (the gateway's authority, pairing); `docs/spec/v0.2.md` §3.7 (the web edge).
- Items: R-1530; the map M-1511; Q-1527 §1 to §7; Q-1521 (why shape B needs it).
- Code: `hub/src/hub/web-auth.ts`, `web-authority.ts`, `web-edge.ts`, `hub/src/hub/store.ts`, `asks.ts`, `inbox.ts`, `journal.ts`, `topics.ts`, `artifacts.ts`, `hub/src/remote/`, `hub/src/cli/web.ts`, `hub/src/init/config.ts`; `web/src/`; `docs/adr/0003-*.md` (the 2026-10-20 and 2026-10-21 amendments).
- GLOSSARY: User, Sign-in mode (added for v0.4); Pairing, Remote, General (amended); Ask, Approval, Web workbench.

## Plan

```yaml
stages:
  - name: mode and identity
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1558
        - T-1560
      - - T-1559
  - name: attribution and invites
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1561
        - T-1564
      - - T-1562
        - T-1571
      - - T-1563
      - - T-1570
      - - T-1565
        - T-1569
  - name: sign-in and pairing
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1566
        - T-1567
        - T-1568
      - - T-1572
      - - T-1584
  - name: remotes for every user
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-1573
      - - T-1574
```

## Comments

### qa-678 · 2026-11-01T07:19:22.163Z

verdict: qa
result: not clear
by: qa-678 [qa]
run: qa-s1-2026-11-01-qa678-1
commit: cbe02fc648f6418622cd9a31207e0dde25297dee
stage: mode and identity
stage_hash: ece23045aee4b9f5e2186f5b979a5aec3c501497354804b421512643e459ab48
findings: [{"severity":"medium","text":"E1536S1-03/-05/-07/-10 INCONCLUSIVE: brief expects web welcome/audit client `web`; actual `human` follows dispatch.ts:1537 normalization. Coordinator confirmed brief error; no product defect observed.","file":"qa/briefs/E-1536-stage-1.md"}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Result | Evidence |
| --- | --- | --- |
| S0 | PASS | S0.txt |
| E1536S1-00 | PASS | E1536S1-00.txt |
| E1536S1-01 | PASS | E1536S1-01.txt |
| E1536S1-02 | PASS | E1536S1-02.txt |
| E1536S1-03 | INCONCLUSIVE | E1536S1-03.txt |
| E1536S1-04 | PASS | E1536S1-04.txt |
| E1536S1-05 | INCONCLUSIVE | E1536S1-05.txt |
| E1536S1-06 | PASS | E1536S1-06.txt |
| E1536S1-07 | INCONCLUSIVE | E1536S1-07.txt |
| E1536S1-08 | PASS | E1536S1-08.txt |
| E1536S1-09 | PASS | E1536S1-09.txt |
| E1536S1-10 | INCONCLUSIVE | E1536S1-10.txt |
| E1536S1-11 | PASS | E1536S1-11.log |
| E1536S1-12 | PASS | E1536S1-12.log |
| E1536S1-13 | PASS | E1536S1-13.log |
| E1536S1-14 | PASS | E1536S1-14.log |
| E1536S1-15 | PASS | E1536S1-15.log |
| E1536S1-16 | PASS | E1536S1-16.log |
| E1536S1-17 | PASS | E1536S1-17.txt |
| E1536S1-18 | PASS | E1536S1-18.txt |
| SHELL-001 | PASS | SHELL-001.screen.txt, SHELL-001.state.json |

Verdict: not clear. Stage: mode and identity. Epic: E-1536.
Tested HEAD and final dev: cbe02fc648f6418622cd9a31207e0dde25297dee. Run: qa-s1-2026-11-01-qa678-1. Detached build clean before and after; all three stage members have landing receipts. No epic criterion marks.

Medium — brief expectation error, qa/briefs/E-1536-stage-1.md, cases E1536S1-03, -05, -07, -10. Commands: committed functions m03, m05, m07 and m10. The actual single-mode web welcome is `human`; web audit client is `human`. The brief expects `web`. hub/src/hub/dispatch.ts:1537 normalizes the web connection to HUMAN_SESSION, and line 1540 emits humanUser()?.name ?? client. All other checked facts in these rows match: cookie-derived identity, user ids in users mode, absence in single mode, impersonation refusal, session/link revocation and retained user. The Coordinator confirmed the expectation error in message 36510c18-0c8e-469e-b870-d09ce5bbcedd and requested INCONCLUSIVE plus a not-clear verdict. No product defect found; no code fixed.

All 179 tests across the six brief groups passed, with zero failures, cancellations, skips or todos: 11=21, 12=7, 13=10, 14=7, 15=123, 16=11. Required literal and generated case names were checked in TAP, including both WebAuthn algorithms and auth reset/failed-transition permutations. Full T0–T4 suites and stage covers were not run by this QA pass; the Coordinator supplied the separate stage cover receipts. SHELL-001 passed and its capture shows the typed message queued. Its recorder session reads `rescue` because the brief explicitly seals away CLAND session identity; execution was performed by qa-678 in this session.

Platform: local macOS, Darwin arm64, Node 24.21.0. Browser: pinned Chrome Headless Shell 156.0.8078.4, Playwright revision 1248; exact binary in platform.txt. No GUI or real browser. Web prerequisite gate reports only. Served and built bundle source stamps both 1d2a126853ca42545b5be161a00a50b3c42b54c88018a07c66015756fe8c08e7, HTTP 200. Profile screenshot E1536S1-08.png shows Jane Q. Doe. All seven Accounts test browser censuses end after 0; scratch hub stopped. Manual browser group after 0. The fixture-owned census found no surviving processes after m18.

Quiet admission temporarily timed out before case 16, then recovered under the brief retry loop. Cases 16 and SHELL-001 started only after quiet admission. This is not a product failure or a performance measurement. No timing claim, no droplet lifetime or cost for this local pass.

Evidence contains only declared outputs, with no environment export, cookies, one-time links or HOME. Publication scan uses the shared assertPublishable policy with a successful positive control, plus visual inspection of the Profile screenshot. Source/provenance reads and served/built stamps retained. Commands followed the brief; the independent source-boundary and scratch cleanup checks ran while the regression group finished, without altering its fixtures.

Evidence: A-15215 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15215-e-1536-stage-mode-and-identity-qa-evidence-cbe02fc6/report.md

### qa-678 · 2026-11-01T19:53:16.220Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-s1-2026-11-01-qa678-2
commit: 88fd418100cfd99d3908c054ae17ee349fba8b41
stage: mode and identity
stage_hash: ece23045aee4b9f5e2186f5b979a5aec3c501497354804b421512643e459ab48
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Result | Evidence |
| --- | --- | --- |
| S0 | PASS | S0.txt |
| E1536S1-00 | PASS | E1536S1-00.txt |
| E1536S1-01 | PASS | E1536S1-01.txt |
| E1536S1-02 | PASS | E1536S1-02.txt |
| E1536S1-03 | PASS | E1536S1-03.txt |
| E1536S1-04 | PASS | E1536S1-04.txt |
| E1536S1-05 | PASS | E1536S1-05.txt |
| E1536S1-06 | PASS | E1536S1-06.txt |
| E1536S1-07 | PASS | E1536S1-07.txt |
| E1536S1-08 | PASS | E1536S1-08.txt, E1536S1-08.png |
| E1536S1-09 | PASS | E1536S1-09.txt |
| E1536S1-10 | PASS | E1536S1-10.txt |
| E1536S1-11 | PASS | E1536S1-11.log |
| E1536S1-12 | PASS | E1536S1-12.log |
| E1536S1-13 | PASS | E1536S1-13.log |
| E1536S1-14 | PASS | E1536S1-14.log |
| E1536S1-15 | PASS | E1536S1-15.log |
| E1536S1-16 | PASS | E1536S1-16.log |
| E1536S1-17 | PASS | E1536S1-17.txt |
| E1536S1-18 | PASS | E1536S1-18.txt |
| SHELL-001 | PASS | SHELL-001.screen.txt, SHELL-001.state.json |

Clear — E-1536 stage "mode and identity". Run qa-s1-2026-11-01-qa678-2 at 88fd418100cfd99d3908c054ae17ee349fba8b41. HEAD and dev matched before and after; detached worktree remained clean. All three stage tasks have exactly one landing receipt. No findings. No epic criterion marks.

The whole corrected brief ran afresh. The previous brief errors are resolved: E1536S1-03/-05/-07/-10 now pass with the documented `human` welcome/audit client normalization (current dispatch.ts:1538). Cookie-derived users-mode identity, forged-field refusal, audit attribution, first-admin uniqueness across reload/restart, hand-edit guards, reset/session/link revocation and retained user rows all matched the brief. The Profile screenshot displays Jane Q. Doe.

179 targeted tests passed, none failed, cancelled, skipped or todo. Group counts: 11=21, 12=7, 13=10, 14=7, 15=123, 16=11. Required literal and generated test names were checked against TAP/source, including both COSE algorithms, reset active/expired owners and failed single/users transitions. SHELL-001 passed; its screen capture shows the typed message queued. Recorder session `rescue` on that line results from the brief's sealed environment stripping CLAND identity; QA qa-678 executed the case in this session.

Local macOS arm64, Node 24.21.0. Pinned Chrome Headless Shell 156.0.8078.4, Playwright revision 1248, with its own scratch profile; exact binary is in platform.json. No real browser/GUI. Web prerequisite gate was report-only. Served and built bundle source stamps both 1d2a126853ca42545b5be161a00a50b3c42b54c88018a07c66015756fe8c08e7, HTTP 200. All tests ran sequentially after quiet admission. No timing, benchmark or droplet-cost claim.

Full T0–T4 suites and stage covers were out of this brief's scope and were not rerun by this QA pass. The Coordinator supplied green Linux 559a77e5 (A-15361) and macOS 141a9187 (A-15365) cover receipts at the build's tree fe38e2c2. This report's 179-test count covers only the named targeted files, not a full suite.

Manual browser process group ended at zero; all seven Accounts fixture census lines ended `after 0; scratch hub stopped`. The manual scratch hub stopped and the census of its 27 registered pids found no survivor. All evidence is retained under this artifact. Shared assertPublishable publication scan passed with a successful positive control; screenshot visually inspected. No HOME, environment exports, cookies or sign-in links included. Source, selector, generated-name provenance and the brief correction diff retained.

Evidence A-15369: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15369-e-1536-stage-mode-and-identity-qa-clear-88fd4181/report.md

### qa-678 · 2026-11-02T05:28:34.042Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-users2-2026-11-02-qa678-1
commit: c14994a248fee18f1affcc4e49e2c67288f91dfe
stage: attribution and invites
stage_hash: 22cffcfcedc08f67bffebb96e7bad7e519b94a1e91745a2232401c909758f780
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-1536 stage attribution and invites — QA clear

Run `qa-users2-2026-11-02-qa678-1`, tested source and served bundle `c14994a248fee18f1affcc4e49e2c67288f91dfe`. Clean detached HEAD and root dev matched before and after. macOS 27.0.1 (26A434), Darwin arm64, local executor; Node 24.21.0, Neovim 0.11.2. Isolated Chrome Headless Shell 156.0.8078.4, Playwright revision 1248; exact executable in final-build.txt. No GUI browser.

All 27 setup/check rows pass. Named test files: 227 tests in 29 files, zero failures/skips. Generated case names were checked against source loops and retained in test-summary.json and generated-test-source.txt. Web build and typecheck pass. Full suites were not run here; separately supplied stage covers: Linux 801d32a7/A-15573 and macOS 11f9a8be/A-15577 at cover tree f605d08ac83205d3bbda879f82faf516e174dc46. No wall-time or remote cost claim. Quiet queue/load admission enforced for named test files; web readiness is report-only, actual browser cases ran.

| Case | Result | Command and observations |
| --- | --- | --- |
| S0 | PASS | brief setup: fixtureEnvironment then scratchGitEnvironment; zero credential-prefix names; no session credentials inherited; probes syntax checked |
| E1536S2-00 | PASS | brief m00: all preconditions and expected facts checked |
| E1536S2-01 | PASS | brief m01: all preconditions and expected facts checked |
| E1536S2-02 | PASS | brief m02: all preconditions and expected facts checked |
| E1536S2-11 | PASS | brief m11: all preconditions and expected facts checked |
| E1536S2-03 | PASS | brief test group 03, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-04 | PASS | brief test group 04, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-05 | PASS | brief test group 05, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-06 | PASS | brief test group 06, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-07 | PASS | brief test group 07, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-08 | PASS | brief test group 08, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-09 | PASS | brief test group 09, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-10 | PASS | brief test group 10, serial named files after load <=10 and quiet; TAP counts, generated names and no skips checked |
| E1536S2-12 | PASS | isolated Headless Shell single-mode labels; both you; browser group after 0; screenshot inspected |
| E1536S2-13 | PASS | probe correction (brief facts() order), coord-authorised; original setup retained; corrected inbox observation confirms the same five saved asks |
| E1536S2-14 | PASS | brief m14; preconditions and all expected facts checked; invite tokens kept outside evidence |
| E1536S2-15 | PASS | brief m15; preconditions and all expected facts checked; invite tokens kept outside evidence |
| E1536S2-16 | PASS | brief m16; preconditions and all expected facts checked; invite tokens kept outside evidence |
| E1536S2-17 | PASS | m17; fixture correction (driver lifetime), coord-authorised; original retained, same name/session/role connected then two sends and matching deliveries |
| E1536S2-18 | PASS | m18; probe correction (brief facts() order), coord-authorised; persistent driver confirmed; ask first-wins, identity, topics/artifacts, journal/audit pass |
| E1536S2-19 | PASS | m19; probe correction (brief facts() order), coord-authorised; approval first-wins and identity facts match |
| E1536S2-20 | PASS | m20; brief correction (expected outcome), coord-authorised: ignored --as, session-scope refusal, qa-oc/null userId audit, no QA shell note artifact; other checks pass |
| E1536S2-21 | PASS | m21; isolated Headless Shell desktop/phone labels and live messages, screenshots inspected, browser groups zero |
| E1536S2-22 | PASS | m22; users/counts/create invite/dismiss/reload, screenshot inspected after dismissal, browser group zero |
| E1536S2-23 | PASS | m23; probe correction (brief facts() order), coord-authorised; persistent driver survives reset; revocation, single stand-in and audit facts pass |
| E1536S2-24 | PASS | m24; isolated Headless Shell labels all you after reset; screenshot inspected; browser group zero |
| E1536S2-25 | PASS | m25; driver closed, fake OpenCode stopped, hub stopped, fixture census empty; final HEAD/dev unchanged and clean |

## Corrections, separate from product results

No product findings. These are Coordinator-authorised brief/fixture corrections, with original captures retained:

- **Probe correction (brief facts() order), coord-authorised**, decision 2e7f08e8-41b1-4564-a3e9-88b9b78fa44e. Row13 original inbox facts lost approvals/asks/archive because messages returned first. Added only the supplied combined branch before messages. Corrected observation confirms the same five ask IDs; applied to later inbox observations (18–20,23). No asks recreated.
- **Fixture correction (driver lifetime), coord-authorised**, decision 4d5d4d9e-05b2-424d-9ecb-52f54a55f0df. Row17 initially had no deliveries; background driver/spoke had exited, empty stderr. Restarted its remaining steps in persistent exec, same qa-coord/coordinator/session qa-qa-coord confirmed in session-list presence. Repeated two sends, one matching delivery each. Rows18/23 and agent artifact then passed; driver remained through reset and closed normally. Original driver/row17 captures preserved. The shell CLI has no who command and human wire who is unknown; equivalent session-list presence provided the required identity evidence.
- **Brief correction (expected outcome), coord-authorised**, decision 796f3bb1-5d40-4099-b4c1-11033acc856b. Row20 originally expected an Implementer with no item/request to create an artifact in General. Actual exit1: `cland: forbidden: artifact.create (artifacts require your own item topic or a delivered request in this topic; General and Agents are the Coordinator’s)`. Ignored --as warning, qa-oc/null userId audit, and absence of the attempted QA shell note prove session identity. No retry after refusal. Existing Alex artifacts are the successful row18 artifacts, not this refused call.

## Evidence and limits

Every case has a recorder receipt with evidence paths. Screenshots inspected: single, desktop/phone live attribution, Accounts after invite dismissal, reset labels. No browser-group leftovers. Driver, fake OpenCode and scratch hub stopped; scratch-root process census zero.

Exact-token scan positive controls detected the four stored invite tokens; final scans found none in scratch .cland or exported evidence. Carol's browser-created token is deliberately not stored in a private invite file: the optional exact-token extension reported ENOENT; original partial capture retained and corrected scan explicitly covers only the four available tokens. Generic publication scan with positive control checks all text captures, including Carol's URL syntax; screenshots contain no invite links. No secret files, HOME, cookie files, or raw databases exported.

Stage verdict only; no epic criterion marks. Findings by severity: none. No product edits.

Artifact A-15579: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15579-e-1536-stage-2-qa-27-checks-pass-authorised-brief-corrections/report.md

### qa-678 · 2026-11-02T16:50:16.606Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-users3-2026-11-02-qa678-2
commit: ad295a54c672ed08937a7c62c5655e89f9da5e38
stage: sign-in and pairing
stage_hash: c206fe3a2a0afa8325172f8c0f0abfa7439db00815bd059efe3160d6603cac8f
findings: [{"severity":"low","text":"Aside, S Follow-up (Coordinator filing): row E1536S3-15 malformed pairing code 000000 is rejected as unknown request type pairing.approve. The authorized well-formed absent-code check passes; this diagnostic wording is outside the stage's pairing behavior.","file":"hub/src/hub/dispatch.ts","line":1743}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Result | Command / observation | Evidence |
|---|---|---|---|
| S0 | PASS | Replacement run: clean pinned detached build, shared sealed environment and probe; zero credential-prefix names, five fixture CLAND names | [S0.txt](S0.txt) |
| E1536S3-00 | PASS | m00: replacement HEAD/dev/request equal ad295a54; all five stage members merged once; clean tree | [E1536S3-00.txt](E1536S3-00.txt); [E1536S3-00-plan.json](E1536S3-00-plan.json) |
| E1536S3-01 | PASS | m01 at replacement build: all source checks match; seven T-1572 migration deletions reviewed; preserved/additive files and packages unchanged | [E1536S3-01.txt](E1536S3-01.txt); [E1536S3-01-migrations.diff](E1536S3-01-migrations.diff); [T-1568-landing.txt](T-1568-landing.txt) |
| E1536S3-02 | PASS | m02 at replacement build: sealed web build and full typecheck exit 0, clean HEAD; Node24.21.0, Neovim0.11.2 | [E1536S3-02.txt](E1536S3-02.txt); [E1536S3-02-build.log](E1536S3-02-build.log); [E1536S3-02-typecheck.log](E1536S3-02-typecheck.log) |
| E1536S3-03 | PASS | nt: 91 tests across five auth/password/WebAuthn files pass at ad295a54; required names, zero skips and failures checked | [E1536S3-03.log](E1536S3-03.log); [test-summary.json](test-summary.json); [required-tests.json](required-tests.json) |
| E1536S3-04 | PASS | nt: 11 tests across four Web sign-in/passkey/connection files; required names, zero skips and all fixture census after0/hubstopped checked | [E1536S3-04.log](E1536S3-04.log); [test-summary.json](test-summary.json); [platform.json](platform.json) |
| E1536S3-05 | PASS | nt: four withdrawal/authority/message-user files pass; all required names, no skips, and Web fixture census clean | [E1536S3-05.log](E1536S3-05.log); [test-summary.json](test-summary.json) |
| E1536S3-06 | PASS | nt: 199 tests in eleven pairing/native/CLI/Neovim files pass; all51 generated names match source loops; no skips or failures | [E1536S3-06.log](E1536S3-06.log); [test-summary.json](test-summary.json); [generated-required.json](generated-required.json); [generated-match.json](generated-match.json); [generated-test-source.txt](generated-test-source.txt) |
| E1536S3-07 | PASS | m07: single-mode endpoints/link/cookies/ownership and two visible Withdraw buttons pass; history-derived IDs, isolated profile and zero browser group after | [E1536S3-07.txt](E1536S3-07.txt); [E1536S3-07-single.png](E1536S3-07-single.png) |
| E1536S3-08 | PASS | m08: brief correction (precondition), coord-authorised; single-mode user list intended refusal; all switch/invite/Origin/Host/method/expiry facts pass, no rerun | [E1536S3-08.txt](E1536S3-08.txt); [E1536S3-08-correction.txt](E1536S3-08-correction.txt); [E1536S3-08-precondition-source.txt](E1536S3-08-precondition-source.txt) |
| E1536S3-09 | PASS | m09: password invite activates Jane, shows Profile, user-bound strict HttpOnly cookie, scrypt storage and used-invite refusals; isolated browser/no frame secret hits | [E1536S3-09.txt](E1536S3-09.txt); [E1536S3-09-admission.txt](E1536S3-09-admission.txt); [E1536S3-09-invite.png](E1536S3-09-invite.png) |
| E1536S3-10 | PASS | m10: CDP passkey registration/fresh-context login; replay/reuse/wrong-user and125001ms expiry refused; fresh positive control200, counter5, no frame secrets/browser leftovers | [E1536S3-10.txt](E1536S3-10.txt); [E1536S3-10-admission.txt](E1536S3-10-admission.txt); [E1536S3-10-passkey.png](E1536S3-10-passkey.png) |
| E1536S3-11 | PASS | m11: WebAuthn unavailable hides passkey button and shows exact tooltip; dana password registration and distinct scrypt salts pass; no frame secrets/browser leftovers | [E1536S3-11.txt](E1536S3-11.txt); [E1536S3-11-admission.txt](E1536S3-11-admission.txt); [E1536S3-11-nowebauthn.png](E1536S3-11-nowebauthn.png) |
| E1536S3-12 | PASS | m12: desktop/phone sign-in fits viewport; three identical401 credential refusals; correct login, shared-cookie sibling signout, other browser survives; no frame secrets | [E1536S3-12.txt](E1536S3-12.txt); [E1536S3-12-admission.txt](E1536S3-12-admission.txt); [E1536S3-12-signin-desktop.png](E1536S3-12-signin-desktop.png); [E1536S3-12-signin-phone.png](E1536S3-12-signin-phone.png); [E1536S3-12-signed-out.png](E1536S3-12-signed-out.png) |
| E1536S3-13 | PASS | m13: cookie flags equal across issuers; signout closes only its socket with1006 and rejects reuse401; other session stays open; foreign-origin403 | [E1536S3-13.txt](E1536S3-13.txt) |
| E1536S3-14 | PASS | m14: trusted identities, ownership and non-admin refusals, desktop/phone Withdraw controls, own and legacy withdrawal; screenshots inspected | [E1536S3-14.txt](E1536S3-14.txt); [E1536S3-14-admission.txt](E1536S3-14-admission.txt); [E1536S3-14-dana-desktop.png](E1536S3-14-dana-desktop.png); [E1536S3-14-dana-phone.png](E1536S3-14-dana-phone.png); [E1536S3-14-jane-desktop.png](E1536S3-14-jane-desktop.png) |
| E1536S3-15 | PASS | m15 plus brief correction (pairing code format), coord-authorised: original malformed code retained; ABCDEFGH absent-code refusal captured after reset, lookup precedes mode branch; users-mode selectors and unpair passed | [E1536S3-15.txt](E1536S3-15.txt); [E1536S3-15-correction.txt](E1536S3-15-correction.txt); [E1536S3-15-source.txt](E1536S3-15-source.txt) |
| E1536S3-16 | PASS | m16: reset retains users and first pairing, revokes sessions/invites, restores single-mode routes/link and withdrawal; screenshot inspected | [E1536S3-16.txt](E1536S3-16.txt); [E1536S3-16-admission.txt](E1536S3-16-admission.txt); [E1536S3-16-single.png](E1536S3-16-single.png) |
| E1536S3-17 | PASS | m17: scan 107 files while hub up; positive control detected and removed; passwords/cookies/passkey responses/challenges/invite tokens each nonempty sentinel sets, zero hits | [E1536S3-17.txt](E1536S3-17.txt) |
| E1536S3-18 | PASS | m18: hub stopped exit 0; census 57 owned PIDs with no survivors, scratch process count zero; checkpointed secret scan 106 files positive control detected/removed and five secret classes zero hits; HEAD/dev unchanged and worktree clean | [E1536S3-18.txt](E1536S3-18.txt); [E1536S3-18-hubstop.txt](E1536S3-18-hubstop.txt); [final-build.txt](final-build.txt) |

Severity-ranked findings: no in-scope product findings. One diagnostic follow-up (low, proposed size S): E1536S3-15, `remote approve telegram 000000 --user alex` exits 1 with `cland: unknown request type "pairing.approve"`. This is malformed-code validation, not an absent pairing handler: `hub/src/protocol.ts:1118–1119` accepts eight pairing-alphabet characters; `hub/src/hub/dispatch.ts:1743` gives the generic error before the handler at 1957. Coordinator classified the diagnostic as a separate follow-up and is filing it. It does not fail this stage's pairing behavior.

Verdict: clear, E-1536 stage **sign-in and pairing**, affected / after-stage. Full tested and final dev SHA: `ad295a54c672ed08937a7c62c5655e89f9da5e38`. Run: `qa-users3-2026-11-02-qa678-2`. Committed brief `qa/briefs/E-1536-stage-3.md` (last changed at 7a41d85c), replacement request `f7d03552-688a-447f-8bde-886ac8e01bf5`. All five stage members had landing receipts. Detached worktree clean and HEAD/dev equal at completion. No epic criterion marks: this closes only the stage; epic Definition of done is separate.

20 recorder checks passed: S0 plus 00–18. Build and typecheck passed. Targeted files ran serially: row 03 91 tests / 5 files, row 04 11 / 4, row 05 24 / 4, row 06 199 / 11: **325 tests across 24 files**, no failed or skipped tests. [test-summary.json](test-summary.json) retains every executed TAP name; [required-tests.json](required-tests.json) and [generated-required.json](generated-required.json) retain required names, including all 51 generated cases matched in [generated-match.json](generated-match.json). Exit status alone was not the judgment: manual response facts, case preconditions, negative results, browser counts and screenshot visibility were checked.

Runtime: local macOS darwin arm64, OS release 27.0.0, Node v24.21.0, Neovim 0.11.2. Headless Shell reports Google Chrome for Testing 156.0.8078.4, binary `/Users/evgeniyivanov/Projects/cland/v0/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`. Every browser profile was in the sealed scratch fixture; no GUI or human browser ran. All 11 screenshots were visually inspected. Served `/signin` index SHA256 and built index SHA256 both `c0582b0ab8d50327a47bfd9587233abc50a646328cf14e55405b25bc1b4de6ab` ([served-stamp.json](served-stamp.json)).

Two runtime brief corrections are separate from product results, with original captures retained:

- **Row 08 — brief correction (precondition), coord-authorised**, decision `71497fa5-8167-480f-9bbd-f4f754eef490`. Correct single-mode precondition is hub up and `cland user list` refused with `cland: use cland auth mode users before cland user commands` (daemon.ts:374/381/389). The switch was not rerun. Remaining captured facts passed. See [correction](E1536S3-08-correction.txt) and [source](E1536S3-08-precondition-source.txt).
- **Row 15 — brief correction (pairing code format), coord-authorised**, decision `909035a3-9517-40b4-804b-a1b60f8a7dc5`. Original `000000` is invalid. One supplemental `remote approve telegram ABCDEFGH --user alex` returned exit 1, `cland: no live pairing code for this messenger`. Row 16's reset had completed before that authorization arrived, so the supplemental capture explicitly records mode single. The absent-code lookup is before the mode branch at dispatch.ts:1964–1968; original users-mode selector/unpair captures are unchanged. See [correction](E1536S3-15-correction.txt) and [source](E1536S3-15-source.txt).

Inferred fixture assumptions were checked against observed behavior: expiry writes took effect; passkey credential transfer to a fresh browser context worked and final stored counter was 5; non-admin role change affected the next frame; planted user pairings were listed, selectively removed and reset to Jane's first pairing. No activation was planted. The 125001 ms passkey expiry wait was real elapsed waiting, not a full-run performance measurement. Passwords used distinct scrypt salts. Sign-out closed only the matching cookie's sockets; other sessions stayed usable. Reset revoked user sessions and restored single-mode admission and withdrawal fences.

Admission: rows 03–06 waited for cover-quiet and enforced one-minute load ≤10 before each file; later browser rows 09,10,11,12,14,16 also captured and enforced load ≤10. Row 07 began just before the Coordinator's later per-browser-row load instruction; its post-row load 3.06 is diagnostic, not a retrospective admission sample. See [admission-notes.txt](admission-notes.txt). Web prerequisite messages are report-only; load and quiet admission are enforced. No suite wall time or load benchmark is claimed.

Both scans had a planted positive control detected exactly once and removed, nonempty secret sentinel sets, and zero secret hits: while running 107 files; after hub shutdown/checkpoint 106 files. Each checked passwords (4), cookies (15), passkey responses (14), challenges (6), invite tokens (6). No secrets, cookie files, environment, raw databases or one-use links are exported. Hub stopped exit 0; 57 owned PIDs had no surviving fixture process; zero processes named the scratch root. Evidence was separately scanned with a positive control before recording and publication.

Scope limits: this run completed the brief's targeted tests and scratch HTTP/WebSocket/browser/CLI checks. It did not run a full suite, T4 soak, real Telegram/Discord, hardware passkeys, configured HTTPS/Secure-cookie behavior, or GUI computer use. Pairing round trips and the Neovim pairing card use the named tests' fake messengers; planted row 15–16 pairings prove selector/reset behavior only. Coordinator-owned stage covers are outside this brief; no green cover result is claimed here (Coordinator reported the earlier macOS cover failed on T-1636). This local run has no droplet lifetime/cost.

Superseded ae344430 run is preserved separately as A-15902 and contributes no passes to this run. Preparatory brief defects were corrected in the committed build before this run; this report uses the final extracted probe.


Durable evidence: A-15908, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15908-e-1536-stage-sign-in-and-pairing-qa-clear-at-ad295a54/report.md

### qa-678 · 2026-11-02T23:49:01.711Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-users3-2026-11-03-qa678-1
commit: 986afe46b587899bcf9ebb3f51781d3491a904ca
stage: sign-in and pairing
stage_hash: c206fe3a2a0afa8325172f8c0f0abfa7439db00815bd059efe3160d6603cac8f
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Result | Command and observation | Evidence |
|---|---|---|---|
| S0 | PASS | Fresh sealed scratch: credential-prefix count zero, only synthesized CLAND names, Node v24.21.0 supported; probe extracted unchanged from pinned brief and syntax checked | [S0.txt](S0.txt), [S0-env.txt](S0-env.txt), [S0-probe.txt](S0-probe.txt) |
| E1536S3-00 | PASS | m00: clean detached HEAD/dev match request, all five stage members merged with exactly one landing each | [E1536S3-00.txt](E1536S3-00.txt), [E1536S3-00-plan.json](E1536S3-00-plan.json) |
| E1536S3-01 | PASS | m01: preserved/additive tests unchanged, seven reviewed migration deletions inspected; no dependency/color/key changes; shared cookie helper and expected strings present | [E1536S3-01.txt](E1536S3-01.txt), [E1536S3-01-migrations.diff](E1536S3-01-migrations.diff), [T-1568-landing.txt](T-1568-landing.txt) |
| E1536S3-02 | PASS | m02: pinned build and typecheck exit 0, supported Node/Neovim, worktree stays clean | [E1536S3-02.txt](E1536S3-02.txt), [E1536S3-02-build.log](E1536S3-02-build.log), [E1536S3-02-typecheck.log](E1536S3-02-typecheck.log) |
| E1536S3-03 | PASS | nt row 03: five full files; exact required TAP names, zero failure/skip, per-file load gate passed | [E1536S3-03.log](E1536S3-03.log), [required-tests.json](required-tests.json) |
| E1536S3-04 | PASS | nt row 04: four Web files, required names and every nested case passed; no skips, all browser census after zero and hubs stopped | [E1536S3-04.log](E1536S3-04.log), [required-tests.json](required-tests.json) |
| E1536S3-05 | PASS | nt row 05: four ownership/withdrawal files passed required names and clean census; no failures/skips | [E1536S3-05.log](E1536S3-05.log), [required-tests.json](required-tests.json) |
| E1536S3-06 | PASS | nt row 06: 11 full files passed with native Neovim keys; required literal and generated names matched, no failures/skips | [E1536S3-06.log](E1536S3-06.log), [test-summary.json](test-summary.json), [generated-required.json](generated-required.json), [generated-match.json](generated-match.json) |
| E1536S3-07 | PASS | m07: single-mode 404 gates, one-use cookie/link, human authorship and withdrawal; UI screenshot inspected; browser group zero | [E1536S3-07.txt](E1536S3-07.txt), [E1536S3-07-admission.txt](E1536S3-07-admission.txt), [E1536S3-07-single.png](E1536S3-07-single.png) |
| E1536S3-08 | PASS | m08: committed single-mode precondition holds; switch, five users/six invites, Host/Origin/method gates, redirects and unknown/revoked/short/expired refusal facts pass | [E1536S3-08.txt](E1536S3-08.txt), [served-stamp.json](served-stamp.json) |
| E1536S3-09 | PASS | m09: password invite registers once, localhost redirect, exact cookie flags, scrypt stored, replay refused; profile screenshot inspected and frame secret hits zero | [E1536S3-09.txt](E1536S3-09.txt), [E1536S3-09-admission.txt](E1536S3-09-admission.txt), [E1536S3-09-invite.png](E1536S3-09-invite.png) |
| E1536S3-10 | PASS | m10: CDP passkey registration/fresh-context login passed, five negative assertions refused, real expiry wait 125002 ms and fresh positive control passed; stored public-key counter 5, frame hits zero; screenshot inspected | [E1536S3-10.txt](E1536S3-10.txt), [E1536S3-10-admission.txt](E1536S3-10-admission.txt), [E1536S3-10-passkey.png](E1536S3-10-passkey.png), [timing-diagnostic.txt](timing-diagnostic.txt), [timing-queue.json](timing-queue.json) |
| E1536S3-11 | PASS | m11: unavailable WebAuthn removes passkey button, exact password tooltip and password activation passed; distinct scrypt salts and no frame secret hits; screenshot inspected | [E1536S3-11.txt](E1536S3-11.txt), [E1536S3-11-admission.txt](E1536S3-11-admission.txt), [E1536S3-11-nowebauthn.png](E1536S3-11-nowebauthn.png) |
| E1536S3-12 | PASS | m12: desktop/phone form visibly reachable without overflow, uniform three 401s, login/sign-out revokes shared tabs while independent browser stays signed in; all three screenshots inspected | [E1536S3-12.txt](E1536S3-12.txt), [E1536S3-12-admission.txt](E1536S3-12-admission.txt), [E1536S3-12-signin-desktop.png](E1536S3-12-signin-desktop.png), [E1536S3-12-signin-phone.png](E1536S3-12-signin-phone.png), [E1536S3-12-signed-out.png](E1536S3-12-signed-out.png) |
| E1536S3-13 | PASS | m13: equal cookie flags, users-mode link welcome, foreign/no-cookie signout refused, only matching socket revoked and cookie reuse refused; independent socket remains valid | [E1536S3-13.txt](E1536S3-13.txt) |
| E1536S3-14 | PASS | m14: trusted cookie authors, equal-name ownership refusals, non-admin forbidden then admin restore; own/legacy controls on desktop/phone and final withdrawals passed; three screenshots inspected | [E1536S3-14.txt](E1536S3-14.txt), [E1536S3-14-admission.txt](E1536S3-14-admission.txt), [E1536S3-14-dana-desktop.png](E1536S3-14-dana-desktop.png), [E1536S3-14-dana-phone.png](E1536S3-14-dana-phone.png), [E1536S3-14-jane-desktop.png](E1536S3-14-jane-desktop.png) |
| E1536S3-15 | PASS | m15: committed well-formed absent code refused as expected; selectors list three planted users, unknown user refused, unpair alex leaves Jane/Dana only | [E1536S3-15.txt](E1536S3-15.txt) |
| E1536S3-16 | PASS | m16: reset retains users/first pairing, revokes invites and sessions; single-mode routes/link/ownership fence restored, screenshot inspected | [E1536S3-16.txt](E1536S3-16.txt), [E1536S3-16-admission.txt](E1536S3-16-admission.txt), [E1536S3-16-single.png](E1536S3-16-single.png) |
| E1536S3-17 | PASS | m17: 105 files, positive control detected/removed; nonempty password/cookie/passkey-response/challenge/invite sentinel sets each zero secret hits | [E1536S3-17.txt](E1536S3-17.txt) |
| E1536S3-18 | PASS | m18: hub stop 0, 57 owned PIDs with no survivors, scratch process count zero; checkpointed scan 104 files positive control and zero secrets; final HEAD/dev match and worktree clean | [E1536S3-18.txt](E1536S3-18.txt), [E1536S3-18-hubstop.txt](E1536S3-18-hubstop.txt), [final-build.txt](final-build.txt) |

Severity-ranked findings: none.

**Clear: E-1536 stage sign-in and pairing**, affected/after-stage. Run `qa-users3-2026-11-03-qa678-1`, full tested SHA `986afe46b587899bcf9ebb3f51781d3491a904ca`. Fresh execution of committed `qa/briefs/E-1536-stage-3.md`, including b3821a52's row 08 and row 15 corrections. No runtime corrections and no earlier case passes reused. HEAD/dev match at start and finish; detached worktree clean; all five members have one landing each. Stage verdict only: no epic criterion marks.

All 20 recorder checks passed (S0 and 00–18). Build/typecheck passed. Targeted serial files: row 03 91 tests/5 files, row 04 11/4, row 05 24/4, row 06 199/11: **325 tests in 24 files**, with zero failures/skips. Required literal titles and all 51 generated titles matched executed TAP names. See [test-summary.json](test-summary.json), [required-tests.json](required-tests.json), [generated-required.json](generated-required.json), and [generated-match.json](generated-match.json). Each manual row was judged on its facts, including negative replies and preconditions, not probe exit alone.

Platform/executor: local macOS darwin arm64, release 27.0.0; Node v24.21.0, Neovim 0.11.2. Browser: Google Chrome for Testing 156.0.8078.4 Headless Shell, binary `/Users/evgeniyivanov/Projects/cland/v0/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`. Own scratch profiles; no GUI. All 11 screenshots visually inspected. Served `/signin` and built index SHA256 both `c0582b0ab8d50327a47bfd9587233abc50a646328cf14e55405b25bc1b4de6ab` ([served stamp](served-stamp.json)).

The browser flows exercised single-mode links, password invites, CDP virtual passkeys in a fresh context, replay/cross-user/expired challenges, password fallback, uniform sign-in refusals, phone reachability, browser/socket-specific sign-out, equal-display-name ownership, non-admin refusal and reset. Inferred credential transfer, role writes, invite expiry and pairing writes all produced the required facts. Passkey expiry used a measured real wait of 125002 ms and a fresh successful control; final stored public-key counter was 5. Pairing row 15 used the committed well-formed absent code in users mode and returned the expected no-live-code refusal. Reset kept the first user's planted pairing only.

Admission: enforced quiet/load gate for targeted rows and load ≤10 before every browser row; Web prerequisite messages were report-only. [Timing sample](timing-diagnostic.txt) and [queue](timing-queue.json) were captured during row 10's expiry wait, not as an initial admission reading. No full-run performance timing is claimed.

Secret scans while running (105 files) and after stop/checkpoint (104 files) each detected and removed the planted control exactly once. Password 4, cookie 15, passkey-response 14, challenge 6 and invite-token 6 sentinels had zero hits and zero short sentinels. Evidence separately passed the publication scanner with a positive control. No secret files, HOME, cookies, raw database or one-use links are exported. Hub stop exit 0; 57 owned PIDs had no fixture survivor; zero processes named the scratch root.

Scope limits: no QA full suite, T4 soak, real Telegram/Discord, physical passkey device, configured HTTPS/Secure-cookie check, or GUI computer use. Fake-messenger tests prove pairing round trips and native Neovim keys; planted pairings prove selector/reset only. Coordinator reports green covers Linux 7953ccfc and macOS f124d237 at cover tree 74864003; those are separate from this local targeted run. No droplet lifetime/cost for this run. Prior ad295a54 evidence remains historical only.


Evidence: A-15999, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15999-e-1536-sign-in-and-pairing-qa-clear-at-cover-build-986afe46/report.md

### qa-678 · 2026-11-03T07:37:11.624Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-users4-2026-11-03-qa678-1
commit: 722f1ce57917ac800aa365088f3050776b60490c
stage: remotes for every user
stage_hash: 0222d5cb12823a4019695481eacd9875e143ade2648233f02a2bc97ebf8be575
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface / executor | Result | Evidence |
| --- | --- | --- | --- |
| S0 | hub-api / local macOS | PASS | [S0-env.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/S0-env.txt), [S0-probe.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/S0-probe.txt), [S0-extraction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/S0-extraction.txt), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/corrections.md) |
| E1536S4-00 | hub-api / local macOS | PASS | [E1536S4-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-00.txt), [E1536S4-00-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-00-plan.json), [T-1574-landing.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/T-1574-landing.txt) |
| E1536S4-01 | hub-api / local macOS | PASS | [E1536S4-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-01.txt), [E1536S4-01-T-1573-test-edits.diff](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-01-T-1573-test-edits.diff), [E1536S4-01-T-1574-test-edits.diff](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-01-T-1574-test-edits.diff) |
| E1536S4-02 | hub-api / local macOS | PASS | [E1536S4-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-02.txt), [E1536S4-02-build.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-02-build.log), [E1536S4-02-typecheck.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-02-typecheck.log), [E1536S4-02-nvim-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-02-nvim-correction.txt) |
| E1536S4-03 | hub-api / local macOS | PASS | [E1536S4-03.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-03.log) |
| E1536S4-04 | hub-api / local macOS | PASS | [E1536S4-04.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-04.log), [discord-assertion-source.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/discord-assertion-source.txt), [source-test-names.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/source-test-names.json) |
| E1536S4-05 | hub-api / local macOS | PASS | [E1536S4-05.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-05.txt) |
| E1536S4-06 | hub-api / local macOS | PASS | [E1536S4-06.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-06.log), [source-test-names.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/source-test-names.json) |
| E1536S4-07 | hub-api / local macOS | PASS | [E1536S4-07.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-07.log), [source-test-names.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/source-test-names.json) |
| E1536S4-08 | hub-api / local macOS | PASS | [E1536S4-08.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-08.log), [runtime-build-stamps.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/runtime-build-stamps.txt) |
| E1536S4-09 | hub-api / local macOS | PASS | [E1536S4-09.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-09.log), [source-test-names.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/source-test-names.json) |
| E1536S4-10 | hub-api / local macOS | PASS | [E1536S4-10.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-10.log), [source-test-names.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/source-test-names.json) |
| E1536S4-11 | hub-api / local macOS | PASS | [E1536S4-11.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-11.log), [source-test-names.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/source-test-names.json) |
| E1536S4-12 | hub-api / local macOS | PASS | [E1536S4-12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-12.txt), [E1536S4-12-migrations.diff](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-12-migrations.diff) |
| E1536S4-13 | hub-api / local macOS | PASS | [E1536S4-13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-13.txt), [E1536S3-07-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-07-init.txt), [E1536S3-07-single.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-07-single.png), [served-build-stamp.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/served-build-stamp.txt) |
| E1536S4-14 | hub-api / local macOS | PASS | [E1536S4-14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-14.txt), [E1536S3-08-switch.err](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-08-switch.err) |
| E1536S4-15 | web-terminal / local macOS | PASS | [E1536S4-15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-15.txt), [E1536S3-09-invite.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-09-invite.png) |
| E1536S4-16 | web-terminal / local macOS | PASS | [E1536S4-16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-16.txt), [E1536S3-10-passkey.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-10-passkey.png) |
| E1536S4-17 | web-terminal / local macOS | PASS | [E1536S4-17.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-17.txt), [E1536S3-11-nowebauthn.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-11-nowebauthn.png) |
| E1536S4-18 | web-terminal / local macOS | PASS | [E1536S4-18.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-18.txt), [E1536S3-12-signin-desktop.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-12-signin-desktop.png), [E1536S3-12-signin-phone.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-12-signin-phone.png), [E1536S3-12-signed-out.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-12-signed-out.png) |
| E1536S4-19 | hub-api / local macOS | PASS | [E1536S4-19.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-19.txt) |
| E1536S4-20 | web-terminal / local macOS | PASS | [E1536S4-20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-20.txt), [E1536S3-14-dana-desktop.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-14-dana-desktop.png), [E1536S3-14-dana-phone.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-14-dana-phone.png), [E1536S3-14-jane-desktop.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-14-jane-desktop.png) |
| E1536S4-21 | hub-api / local macOS | PASS | [E1536S4-21.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-21.txt) |
| E1536S4-22 | web-terminal / local macOS | PASS | [E1536S4-22.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-22.txt), [E1536S3-16-single.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-16-single.png) |
| E1536S4-23 | web-terminal / local macOS | PASS | [E1536S4-23.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-23.txt) |
| E1536S4-24 | web-terminal / local macOS | PASS | [E1536S4-24.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-24.txt), [E1536S3-18-hubstop.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S3-18-hubstop.txt) |
| E1536S4-25 | web-terminal / local macOS | PASS | [E1536S4-25.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/E1536S4-25.txt) |

Clear: every scoped case passes. No in-scope product findings.

Stage **remotes for every user**, E-1536, full/after-stage. Build `722f1ce57917ac800aa365088f3050776b60490c`, run `qa-users4-2026-11-03-qa678-1`. HEAD and dev matched before/after; detached tree clean. The prior three stages were current clear and all eighteen members landed. This stage verdict carries no epic criterion marks.

Platform macOS 27 arm64; Node v24.21.0; pinned Neovim v0.12.5; Chrome Headless Shell revision1248 (156.0.8078.4), with isolated scratch profiles. Browser binary and web build source stamp are in [runtime/build stamps](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/runtime-build-stamps.txt) and [served stamp](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/served-build-stamp.txt). No GUI, real browser, real SSH, real messenger or real harness launched. Production Telegram/Discord adapters ran against loopback fakes. Pure header/fold checks supplement the adapter tests. Stage1–3 scratch regression is freshly run from the pinned stage3 brief (digest in S0); stage3-named screenshots/captures belong to this run.

Build and workspace typecheck passed. 1064 passing test executions across 93 targeted file executions. Every required literal/generated test name was checked against source and TAP; [source names](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/source-test-names.json), [summary](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/test-summary.json). No skips, failures or cancellations in the completed named files. Targeted file invocations by tier: T1=17, T2=60, T3=5, Web=11. These are targeted files, not completed full tiers/suites; no T0/T4/soak or separate Web phase was submitted. Local cost/lifetime not applicable. No overall wall-time claim. Fake clock diagnostics are not speed measurements. The passkey expiry observation waited 125002 ms; this is an expiry precondition, not a performance measurement.

The Node Web prerequisite check reports readiness only; it is not an enforced build gate. This run separately built the bundle and checked its stamp. Quiet admission/load<=10 gated named files and scratch browser rows; no stress run. All eleven screenshots were visually inspected. Before and after normal hub shutdown, five secret classes had zero hits and the scanner found and removed its positive control. The 57-PID fixture census and supplemental worktree/scratch process census were empty after shutdown. See [final checks](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/final-checks.txt).

Coordinator-owned stage covers at tree3430949b: Linux droplet34e1ffe9 (A-16196), macOS4d7cdfe8 (A-16200), both green per request/plan. Those are external receipts, not QA-measured lifetimes/costs. No remote lifetime or cost was collected here.

Corrections and setup observations: [full details](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/corrections.md). Shared environment composition for hubstart/bprobe (a54f9472); pinned Neovim precondition (76c6412f); presentation-only omissions in exported static code/prose (76c6412f), with exact private originals retained and execution/assertions unchanged. Scanner unchanged and positive control required before publication. Initial controller bootstrap error happened before any fixture launch and was corrected before S0. The supplemental census initially counted its own Python process; its preserved original and exact self-PID exclusion are documented in corrections.md. Root harness-local settings exclusion is authorised by the request; the file is unchanged.

Findings found aside: none in this run. Scope exclusions remain those of the brief, including real messengers, concurrent remote answers across chats, named uncovered Discord slash paths, configured HTTPS origin, earlier-stage rows deliberately replaced by test coverage, and full suite/soak.

Evidence artifact A-16213: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16213-e-1536-remotes-for-every-user-qa-at-722f1ce5/report.md
