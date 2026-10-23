---
id: E-419
kind: epic
title: The phone and notifications
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-417
topic: topic-896
branch: null
created: 2026-10-14T15:59:25.308Z
updated: 2026-10-23T16:51:23.007Z
---

## Summary

The web workbench works on a phone: a bottom bar in place of the rail, the inbox as home, asks answered in a bottom sheet, threads with a touch composer, two-line session rows and a clear disconnected state. The page installs as an app, signs in from a QR code, and notifies through a service worker over HTTPS through the human's own tunnel.

## Goal

Away from the desk the human sees what needs them and answers it on the phone (an ask, a reply, a stuck session), while planning stays on the desktop. Today the web has no phone layout. A phone on the local network over plain HTTP gets no service worker, no notifications and no install, and iOS gives notifications only to an app installed on the Home Screen.

## Contents

- **§3.6 The phone layouts** (the phone boards, P24 to P42):
  - **The bottom bar** replaces the rail: Inbox, Topics, Sessions, Events and More, with their counts. More opens a small sheet above the bar, without a scrim, with Items, Artifacts and Accounts, each read-only; search stays in the header (P26). The planning views stay desktop first.
  - **The inbox is home** (P40): the four sections in order, each header a 44 px fold button with its count, an empty section kept with 0, "Nothing needs you" when every section is at 0, and the events line and the archive line closing the list. Tapping a message row unfolds it with a reply whose draft survives a disconnection and a reload (P42).
  - **The ask sheet** (P25, P36 to P38): an ask opens as a bottom sheet with the question, the options as full-width buttons with their numbers, and a free answer. When the field takes focus, the sheet rides on the keyboard with 44 px options. Decline sits on the field's label row and turns the field into a reason and Send into a red Decline, disabled until a reason is typed; never on a swipe, the scrim or Escape. An answered row folds in place to its outcome until the human leaves the inbox.
  - **A topic opens full screen** with a back control, the title, the id and the status, and a button to the card (P31). A folded run is two lines from the hub's facts and unfolds in place (P32).
  - **The touch composer** (P33 to P35): docked above the bar in two rows, the kind chip opening a sheet of Message, Decision and Question; return breaks the line and only Send sends; a queued message shows a 44 px Withdraw.
  - **Sessions** (P27 to P30): two-line rows with no row or swipe actions, the accounts strip of cells, the queue view as a full-height sheet, and the session's page with Stop, Resume, Archive and Capabilities, Stop and Archive confirmed.
  - **The disconnected strip** (P41): when the socket drops, a strip says since when and when the next retry runs, with Retry; the last snapshot stays on screen with its time; answers, approvals and Send are disabled and nothing is queued; on reconnect the client resumes from its sequence number.
  - **What stays on the desktop:** a waiting plan shows as a row and notifies, and its approval needs the desktop's Plan view; an approval that stays in a harness's TUI shows marked and notifies, never answerable on the phone; an inline HTML artifact is a chip that opens full screen.
- **§3.6 and §3.7 Installing and signing in.** A PWA manifest and its icons, so the page installs on a phone; the installed app opens on the inbox (P39) and, installed over HTTPS through the tunnel, its badge carries the needs-you count. `cland web --qr` signs a phone in with the 30-day cookie. On iOS the installed app keeps its cookies apart from Safari, so the link opens in the installed app or the sign-in is repeated there.
- **§3.6 Notifications on the phone:** the rules of E-417 through a service worker, which needs HTTPS through the human's tunnel; the notification switches and the subscription button, which iOS requires on a tap, live in More.
- **A short guide** to reaching the hub over HTTPS through the human's own tunnel.

Not in this epic: push with the page closed and Web Push subscriptions (0.2.x); planning on the phone; a terminal (0.2.x).

Choices where the spec is silent:

- **The phone width** is below 640 CSS px: the bottom bar and the phone's screens take over. Between 640 and 1280 px the desktop shell runs with the rail collapsed.
- **Touch.** Every control at phone width is at least 44 px. The ask sheet's options are 48 px tall (P25), and 44 px while the sheet rides on the keyboard (P36).
- **The subscription button.** Push with the page closed is deferred (§4), so in 0.2.0 the button asks for the notification permission and registers the service worker on a tap, as iOS requires, and creates no Web Push subscription.
- **The service worker** has no fetch handler, because the page is useless without its hub and a caching worker could serve a stale shell after an update. It shows notifications and focuses the app on a click.
- **The manifest** names the project, starts at the inbox, uses `display: standalone` and the panel colour from the tokens, with icons of 192 and 512 px and a maskable one, and `apple-touch-icon` for iOS. The Badging API carries the needs-you count where the platform has it.
- **The guide** lives in `web/README.md`, with Tailscale Serve as the worked example: the hub stays on loopback, `[web] origin` names the tailnet's HTTPS origin, and `cland web --qr` prints it. Any HTTPS reverse proxy of the human's own works the same way; never a cloud service.
- **Tests.** The phone screens run in headless Chromium at 390x844 with touch and the mobile flag. The phase stubs `Notification` and the service worker's `showNotification`; the installability check and one real notification run in QA's demo with the full Chromium build, kept out of the suite.

## Tracer-bullet order

1. **The bottom bar and the inbox as home.** The phone layout below 640 px with the bottom bar, the More sheet, the inbox with its 44 px fold buttons, "Nothing needs you", the events and archive lines, and message rows with their reply drafts. Demo: at 390x844 the inbox opens as home with the bar's counts, and More opens Items read-only.
2. **The ask sheet.** The bottom sheet riding on the keyboard, 44 px options, Decline on the label row with its reason, and the answered row folded until the human leaves the inbox. Demo: an ask declined with a reason on the phone reaches the asker as `declined` with the reason, and Escape or a tap on the scrim closes the sheet without answering.
3. **Threads and the touch composer.** A topic full screen, folded runs in two lines, the composer in two rows where return breaks the line, the kind sheet, Withdraw, and HTML artifacts as chips. Demo: return in the composer breaks the line and only Send sends, and a queued message withdrawn returns to the composer.
4. **Sessions on the phone.** Two-line rows, the accounts strip, the queue sheet, and the session's page with its confirmations. Demo: a tap on a waiting session opens its page with the command it waits on, and Stop asks for a confirmation.
5. **Disconnected.** The strip, the last snapshot with its time, every answer and Send disabled with nothing queued, and the resume on reconnect. Demo: with the hub stopped the strip shows and Send is disabled; after the restart the page takes a fresh snapshot and the strip goes.
6. **Install, sign in and notify.** The manifest and icons, the badge, `cland web --qr` for a phone, the service worker, the switches and the subscription button in More, and the tunnel guide. Demo: the full Chromium build reports the page installable on loopback through the DevTools protocol, and with the permission granted a new ask raises a notification through the service worker.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and headless Chromium at 390x844 with touch and the mobile flag (Chrome Headless Shell through `playwright-core`, and the full Chromium build where a check needs the real API), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass); trying the phone through the tunnel is the human's dogfooding.

In a scratch project with the fake harnesses, QA opens the web at 390x844: the inbox is home, with the bottom bar's five slots and their counts, and More opens Items, Artifacts and Accounts read-only. A fake Implementer's ask opens as a sheet; focusing the free answer brings the sheet onto the keyboard with 44 px options; Escape and a tap on the scrim close it unanswered; Decline on the label row stays disabled until QA types a reason, and the fake receives `declined` with it; the answered row stays folded until QA leaves the inbox. QA opens a topic full screen, unfolds a run, types a return in the composer and reads two lines, sends with Send, and queues a message to a busy fake session and withdraws it. QA opens a waiting session's page, reads its command, and stops a busy session after the confirmation. QA stops the hub and reads the strip with its times and Send and the answers disabled; it restarts the hub and reads the strip gone and the page current. A waiting plan shows as a row without an approve control, a fake Claude Code approval shows marked "answer in Neovim", and an HTML artifact is a chip that opens full screen. `cland web --qr` prints a QR code whose link signs a fresh context in. With the full Chromium build QA reads the page installable on loopback, with only the automation's own error, and with the permission granted a new ask raises a notification through the service worker. With `[web] origin` set as the guide says, the edge accepts that origin and `cland web --qr` prints it.

- [ ] C1. Below 640 px the bottom bar of Inbox, Topics, Sessions, Events and More replaces the rail; the inbox is home with 44 px fold buttons and "Nothing needs you" when every section is empty; More opens Items, Artifacts and Accounts read-only.
- [ ] C2. An ask opens as a bottom sheet that rides on the keyboard with 44 px options; Decline sits on the label row and needs a reason; nothing answers on a swipe, the scrim or Escape; an answered row stays folded until the human leaves the inbox.
- [ ] C3. A topic opens full screen with a back control; folded runs show the hub's two lines; the touch composer breaks the line on return and sends only on Send; queued messages have a 44 px Withdraw; drafts survive a reload.
- [ ] C4. Session rows are two lines with no row or swipe actions; the session's page holds Stop, Resume, Archive and Capabilities, with Stop and Archive confirmed; the queue view opens as a full-height sheet.
- [ ] C5. When the socket drops, the strip says since when and when the next retry runs, the last snapshot stays with its time, answers, approvals and Send are disabled and nothing is queued, and on reconnect the client resumes.
- [ ] C6. A waiting plan shows as a row and an approval bound to a TUI shows marked, neither answerable on the phone, and an HTML artifact is a chip that opens full screen.
- [ ] C7. The manifest and icons make the page installable, opening on the inbox; `cland web --qr` signs a phone in; notifications on the phone go through a service worker, with the switches and the subscription button in More.
- [ ] C8. `web/README.md` holds the tunnel guide, from a tunnel of the human's own to an installed app with notifications.

## Dogfooding

The phone layouts are tried on the human's phone through their tunnel (spec §4): the human installs the app from `cland web --qr`, answers the crew's asks away from the desk, and reports in General what does not work on a real phone.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the phone boards PhoneHome, PhoneAsk, PhoneThread and PhoneSessions (canvas version 9). `Phone.dc.html` predates Q-406 and yields to them.
- **Prior art.** On a phone the needs-you list is home and nobody plans; never assume a phone on plain HTTP can notify or install; never queue an answer while disconnected, since another client may answer first (`docs/research/web-prior-art.md` §6 and §7.3).
- **Risks.** iOS gives notifications and badges only to an installed app and asks for the permission only on a tap, and the installed app keeps its own cookies. The headless shell never grants notifications, so the suite stubs them and QA checks the real path with the full build.
- **Size.** About five sessions on the v0 scale.
- **Order.** In the web lane after E-417; E-420 waits for it. Its session screens reuse the two-line row and the session's page of E-418 without an edge, so the Coordinator orders that slice after them.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.6, §3.7 and §4 (the deferrals); `docs/spec/v0.1.2.md` §3.6 and §3.7.
- Map M-399 and the tickets this epic absorbs: Q-406 (the phone boards, P26 to P42), Q-404 (P24 and P25), Q-402 (the PWA and notifications), Q-401 (the phone in prior art).
- Research: `research/web-stack` (`docs/research/web-stack.md` §2.7 and §4: the secure context, Tailscale Serve, the manifest, the service worker and the measured notifications); `research/web-prior-art` (`docs/research/web-prior-art.md` §6 and §7.3).
- Mockups: `docs/design/web/PhoneHome.dc.html` (P26, P39 to P42), `PhoneAsk.dc.html` (P36 to P38), `PhoneThread.dc.html` (P31 to P35), `PhoneSessions.dc.html` (P27 to P30), `Phone.dc.html` (P24, P25); `screens/v02-phone-home.png`, `v02-phone-ask.png`, `v02-phone-thread.png`, `v02-phone-sessions.png`.
- GLOSSARY: Web workbench, Snapshot, Ask.

## Plan

```yaml
stages:
  - name: bottom bar and inbox home
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1165
        - T-1166
        - T-1167
      - - T-1182
  - name: asks, threads, the composer and install
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1168
        - T-1169
      - - T-1170
        - T-1171
      - - T-1174
  - name: sessions and disconnected
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1172
      - - T-1173
  - name: notifications and the guide
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1175
        - T-1176
```

## Comments

### coord · 2026-10-23T07:00:15.723Z

Coordinator decisions at the cut (2026-10-23 ~07:00Z, tickets T-1165–T-1176, plan set), where the spec is silent:
1. Events on the phone is read-only and unfiltered (newest first) in 0.2.0; tap filters are a follow-up (T-1177).
2. The disconnected strip (P41) is phone-only; the desktop keeps its hub dot.
3. The phone composer has no attach in 0.2.0 (DoD C3 does not require it).
4. A thread's ask card on the phone opens the ask sheet rather than answering inline, so phone asks have one answering surface.
5. T-1174 (install) runs as its own lane in stage 2, since it depends only on T-1165.
6. The web lane may make the small hub change in hub/src/hub/web-edge.ts that serves the project-named manifest, with a hub test (T-1174).
External prerequisites outside the lanes: T-1129 gates T-1169; T-1128 and T-1142 gate T-1175. The epic itself waits for E-417 to close.

### qa-676 · 2026-10-23T16:06:13.936Z

verdict: qa
result: not clear
by: qa-676 [qa]
run: qa-s1-2026-10-23-1
commit: e53bc5a323c98352f206f3b1d2387ca68e94a8b3
stage: bottom bar and inbox home
stage_hash: d0c6e061cdab2915e28259a2244f2fef4e15ef6928ddda19967ce357d4500ea3
findings: [{"severity":"medium","text":"E419S1-11: sealed local node --test web/test/sessions.test.ts failed “P27 row is 52 px tall”: 88 !== 52 after resize to600px (narrow line105, call line118). File4pass/1fail; trace retained, no rerun. MatchMedia/render race is Coordinator's hypothesis, not proven diagnosis.","file":"web/test/sessions.test.ts","line":105}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Surface / executor | Result | Command and evidence |
| --- | --- | --- | --- |
| E419S1-00 | hub-api / local macOS | PASS | [local macOS; sealed where required] committed brief row E419S1-00; captured command outputs; E419S1-00.txt |
| E419S1-01 | hub-api / local macOS | PASS | [local macOS; sealed where required] committed brief row E419S1-01; captured command outputs; E419S1-01.txt |
| E419S1-02 | hub-api / local macOS | PASS | [local macOS; sealed where required] committed brief row E419S1-02; captured command outputs; E419S1-02.txt |
| E419S1-03 | hub-api / local macOS | PASS | [local macOS; sealed where required] committed brief row E419S1-03; captured command outputs; E419S1-03.txt |
| E419S1-04 | hub-api / local macOS | PASS | [docs at S] k04 and full specified section reads; 4 candidates dismissed; E419S1-04.txt, E419S1-04-read.txt, E419S1-04-assessment.txt |
| E419S1-05 | hub-api / local macOS | PASS | [local macOS; sealed where required] committed brief row E419S1-05; captured command outputs; E419S1-05.txt |
| E419S1-06 | hub-api / local macOS | PASS | [test macOS arm64; sealed] nt, oks, census per committed brief; clean TAP and all required names; E419S1-06.txt, E419S1-06.log |
| E419S1-07 | hub-api / local macOS | PASS | [test macOS arm64; sealed] nt, oks, census per committed brief; clean TAP and all required names; E419S1-07.txt, E419S1-07.log |
| E419S1-08 | hub-api / local macOS | PASS | [test macOS arm64; sealed] phone-inbox.test.ts 3/3, C1–C5 assertion-body mapping and passing names, clean census; E419S1-08-phone-inbox.txt, E419S1-08-phone-inbox.log, E419S1-08-map.txt |
| E419S1-09 | hub-api / local macOS | PASS | [test macOS arm64; sealed] Inbox 23/23, folds 6/6, Events 11/11, all required names, clean censuses; E419S1-09.txt, E419S1-09a.log, E419S1-09b.log, E419S1-09c.log |
| E419S1-10 | hub-api / local macOS | PASS | [test macOS arm64; sealed] 8 desktop regression files, all clean and every required passing name; E419S1-10.txt, test-summary.json |
| E419S1-11 | hub-api / local macOS | FAIL | [test macOS arm64; sealed] 8 regression files; sessions.test.ts failed P27 row height 88 !== 52 at line105 after resize600; others clean; E419S1-11.txt, E419S1-11e.log, E419S1-11e-trace.zip, test-summary.json |
| E419S1-12 | hub-api / local macOS | PASS | [sealed macOS; Headless Shell] k12 independent probe; TAP1/1 and every fact separately matched; no step errors; E419S1-12.txt, E419S1-12.log, E419S1-12.jsonl, E419S1-12-assessment.txt |
| E419S1-13 | hub-api / local macOS | PASS | [local macOS] committed brief row13; typecheck/tier guards or green same-S stage covers; E419S1-13.txt |
| E419S1-14 | hub-api / local macOS | PASS | [local macOS] committed brief row14; typecheck/tier guards or green same-S stage covers; E419S1-14.txt |
| E419S1-15 | hub-api / local macOS | PASS | [QA shell] k15:120 clean fixture censuses, T1 0/0, clean tree, unchanged HEAD/dev S, scratch removed; E419S1-15.txt, E419S1-15-final-build.txt |

**Not clear — E419S1-11 FAIL.** Stage `bottom bar and inbox home`, run `qa-s1-2026-10-23-1`, full tested commit `e53bc5a323c98352f206f3b1d2387ca68e94a8b3`. All 16 rows completed: 15 PASS, 1 FAIL. Stage verdict carries no item or epic criterion marks.

Findings, by severity:

- **Medium — E419S1-11, web/test/sessions.test.ts:105.** Command (sealed macOS arm64, Node v24.21.0): `node --test --test-concurrency=1 --test-reporter=tap web/test/sessions.test.ts`. The test “Sessions rows render merged facts, holds, waiting detail and physical selection keys” failed with `P27 row is 52 px tall` and `88 !== 52` (expected 52, actual 88), at narrow() line105, called line118 after `setViewportSize({width:600,height:900})`. File exit1, 4 pass / 1 fail / 0 skipped. E419S1-11e.log and E419S1-11e-trace.zip retain the original output and Playwright trace. No rerun or product change. Coordinator message bac60232 notes that the same test passed in both covers and proposes a matchMedia re-render/measurement race; this run establishes the assertion failure, not that root cause. The brief requires this regression file to pass, so green covers do not override it.

No high or low findings. The other 21 named files and independent probe passed; total local TAP counts: 160 tests, 159 pass, 1 fail, 0 skipped/cancelled/todo. Every required test name passed except the failing Sessions test. Required-name source checks and T-1167's criterion-to-test mapping are retained. The three new phone-Inbox tests cover all C1–C5 of T-1167, each with `{phone:true}`; this stage verdict makes no separate criterion marks.

Independent probe E419S1-12: TAP1/1 and every fact separately matched the brief, zero step-error lines. Verified the 390×844 touch/mobile frame, four ordered 44 px fold headers/zero counts/empty green-check title, live ask count, two-line row/no overflow, inline message and request replies, exact sender/topic/reply_to delivery, per-topic reload draft, waiting plan without actions, Events/Archive order/touch sizes/navigation, More dismissal and read-only areas,640/639 boundary and preserved desktop split, inert phone actions with unchanged CLI facts, desktop640/1440 actions and drawer. Detailed fact assessment is E419S1-12-assessment.txt. No guessed PASS from TAP alone; no probe correction or rerun.

Documentation: all required strings present, full specified sections read. The four flagged README candidates are dismissed: More notification controls explicitly deferred; desktop item drawers distinguished from full-screen phone cards; Requests to you distinguished from desktop Requests; inline phone replies distinguished from desktop drawer replies. No new contradiction observed in this scope.

Build and isolation: clean detached S equals dev before and after; all three exact stage landing receipts present,3/3 merged. Only expected web/docs/tier/duration paths. Installed dependencies linked as permitted; web bundle built at S. Scratch HOME/XDG/Git; full fixtureEnvironment after overlays,37 inherited variables unset,0 credential-prefix names; system macOS TMPDIR preserved. No real Chrome, live sign-in, providers or human HOME access. Waited for c8041fe3 to free the local slot; named files ran serially with admission checks. No suite submitted by QA. Typecheck, all four web guards, tier lint and brief lint passed.

Cited stage covers at the same full S, tree 406e5573e12f94006cf7c6edc2adc2b8471a0180:

- Linux droplet f3ed4769-c0b3-4501-806c-6c87a1ec9265: A-10090 merged; A-10091 shard1, A-10092 shard2. Full stage occasion, host check and T1/T2/T3/T4/Web completed, exit 0; 4039 tests / 4031 pass / 8 platform-or-prerequisite skips / 0 fail. Linux x64, Node 24.21.0, Neovim 0.12.5, two c-8 lon1 shards. Shard1 cland-v0-0045d23e duration 1172.27s (admission through remote finish), lifetime 1152s/$0.0800; shard2 cland-v0-e2fc796d duration 1104.27s, lifetime 1092s/$0.0758. Overall wall 1195.50s (admission through collection), total cost $0.1558. Web 35 files / 180 tests on shard1; shard2's Web command has no allocated files. T4 ten base files, extra repetitions skipped.
- macOS local c8041fe3-490d-4507-93d2-1e9821fac535: A-10094. Full stage occasion, check plus T1/T2/T3/T4/Web exit 0; 4039/4039, 0 skip/fail. Darwin arm64, Node 24.21.0, Neovim 0.12.5, two workers. Phase command durations 33/183/970/51/83s; queued 15:37:51.766Z to durable log publication 16:00:18.101Z elapsed 1346.335s (includes collection/publication, not a pure execution timing). Cost N/A. Web 35 files / 180 tests. T4 ten base files, extra repetitions skipped.

Both cover receipts have report-only lint/budgets/T3 ratchet; 132 lint findings in 59 files, projected T3/Web wall overages and measured Web budget reports are report-only. Projections are not reported as measured wall. E419S1-14-cover-metrics.txt preserves receipt details and durable paths. Plan read: `# bottom bar and inbox home: open; stage cover complete (Linux droplet, macOS); tree 406e5573e12f94006cf7c6edc2adc2b8471a0180`.

Cleanup: 120 Web fixture census lines all end after 0 and scratch hub stopped; T1 keymap has 0/0 as expected. Scratch /private/tmp/qa-e419s1-jEEt8u removed. Detached tree clean and HEAD/dev remained S. Failure trace copied into this evidence bundle before worktree removal. No extra reruns. Rule proposal sent in topic-896: explicitly separate verified selectors/test names from criterion-derived guesses in pre-implementation briefs and recheck at the tested build.


Durable evidence A-10096: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10096-e-419-stage-1-at-e53bc5a3-15-pass-sessions-row-height-regression/report.md

### qa-676 · 2026-10-23T16:51:23.007Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s1-2026-10-23-2
commit: 1bd43fe0abb104bf8c7e50545d28f3e76e3d41f9
stage: bottom bar and inbox home
stage_hash: de8c2956cbb683813e3b4625c44ac23b4716f014635cd857df5118d11dd5026e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Result | Command / observation | Evidence |
| --- | --- | --- | --- |
| E419S1-00 | PASS | Build/plan/landings/isolation: clean S; 4/4 members including T-1182 | E419S1-00.txt |
| E419S1-01 | PASS | Sealed web build exit 0; clean tree | E419S1-01.txt |
| E419S1-02 | PASS | Width seam, key map, phone harness and selector reads | E419S1-02.txt |
| E419S1-03 | PASS | Keyboard/storage/raw-HTML/dependency rules | E419S1-03.txt |
| E419S1-04 | PASS | Required docs and full section reads; four candidates dismissed | E419S1-04.txt |
| E419S1-05 | PASS | Committed brief lint | E419S1-05.txt |
| E419S1-06 | PASS | Phone frame: 7/7 | E419S1-06.txt |
| E419S1-07 | PASS | More read-only areas: 5/5 | E419S1-07.txt |
| E419S1-08 | PASS | Phone Inbox: 3/3; T-1167 C1–C5 test-body mapping | E419S1-08.txt |
| E419S1-09 | PASS | Inbox 23/23, folds 6/6, Events 11/11 | E419S1-09.txt |
| E419S1-10 | PASS | Eight desktop regression files: 54/54 | E419S1-10.txt |
| E419S1-11 | PASS | Eight shell/keys/Sessions files: 50/50; Sessions 5/5 | E419S1-11.txt |
| E419S1-12 | PASS | Independent probe: 1/1 plus every fact matched | E419S1-12.txt |
| E419S1-13 | PASS | Typecheck, four web guards and tier lint exit 0 | E419S1-13.txt |
| E419S1-14 | PASS | Green same-S Linux/macOS stage covers | E419S1-14.txt |
| E419S1-15 | PASS | 120 clean Web censuses; scratch removed; clean unchanged S | E419S1-15.txt |

**Clear — all 16 scoped cases PASS.** Stage `bottom bar and inbox home`, run `qa-s1-2026-10-23-2`, full tested dev SHA `1bd43fe0abb104bf8c7e50545d28f3e76e3d41f9`. Stage verdict: no criterion marks.

Findings, ranked by severity: none (high, medium or low).

This is the full fresh brief run requested after T-1182 landed at `1eab7e7ce28ff6b2bf431d5ed9b87510fa1eaee4`. The exact non-tracker diff from the previous build is two test waits for `[data-phone]` after viewport changes, in sessions.test.ts and session-actions.test.ts; no web/src, docs or brief change. The original failure remains in A-10096 and its not-clear verdict. It is not overwritten or relabelled. Fresh E419S1-11e passed 5/5, including “Sessions rows render merged facts, holds, waiting detail and physical selection keys”; E419S1-11f passed 9/9, including the narrow session-page test. No extra reruns or probe corrections in this pass.

Runtime: all 22 named files executed serially on local Darwin arm64 with Node v24.21.0 and Chrome Headless Shell, using `node --test --test-concurrency=1 --test-reporter=tap <file>`. Total 159/159, no fail/cancel/skip/todo; every required name passed, including all three T-1167 test bodies mapped to C1–C5. The independent probe adds 1/1, for 160/160 local TAP tests overall. `test-summary.json`, all original logs, and E419S1-08-map.txt retain the evidence. The mapping describes coverage; it makes no separate tracker criterion marks.

Independent probe: every fresh E419S1-12.jsonl fact was judged separately from TAP. No step-error line. Verified Inbox home, ordered four sections/counts/44px folds, matching green empty title, ask count, two-line rows, inline message/request fields, sender/topic/reply_to and reload draft; waiting plan counts without actions; Events/Archive touch targets and navigation. Verified 390×844 touch/mobile frame, badges, header, More contents/dismissal/focus, 640/639 boundary, preserved desktop split and one explicit document reload. Phone Items/Artifacts/Accounts are read-only with working back paths and unchanged CLI facts; desktop controls at 640/1440 and desktop Inbox drawer remain. See E419S1-12-assessment.txt for the fact-by-fact assessment. TAP proves completion only; the recorded facts establish behavior.

Static/docs/build: all rows 00–05 re-executed at S. Four merged members T-1165, T-1166, T-1167 and T-1182; exact clean detached HEAD/dev. Sealed bundle built at S. Full fixtureEnvironment applied after overlays, scratch HOME/XDG/Git, 37 inherited variables unset and zero credential-prefix names; system macOS TMPDIR retained. No real Chrome, live sign-in or human HOME/provider access. Named files waited for the macOS cover's slot and checked admission before each file. Typecheck, all four web guards (23 text tokens at least 4.5:1), tier lint and brief lint passed. Required docs are present; the four README candidates are dismissed by their explicit phone/desktop or deferred-stage distinctions. No new contradiction found.

Cited Coordinator stage covers at S, verification tree `209119a231bdb8631cc62319afa084f1de4e1874` (QA submitted no suite):

- Linux droplet `90dcf010-0b40-476a-a1e8-8d8733e188bc`: A-10108 merged, A-10109 shard 1, A-10110 shard 2. Full stage, host `npm run check` plus T1/T2/T3/T4/Web completed, exit 0; 4039 tests, 4031 pass, 8 platform/prerequisite skips, zero fail/cancel/todo. Linux x64 6.8.0-142-generic, Node 24.21.0, Neovim 0.12.5, two c-8 lon1 shards. Shard 1 cland-v0-f562e617: duration 1352.11 s (admission through remote finish), lifetime 1328 s, cost $0.0922; collection 8.35 s. Shard 2 cland-v0-7e5a711e: duration 1082.11 s, lifetime 1069 s, cost $0.0742; collection 28.80 s. Overall wall 1360.78 s (admission through collection); total cost $0.1664. Web allocated to shard 1: 35 files / 180 named tests; shard 2's Web command has no allocated files.
- macOS local `8a5ef4e3-abfd-4b34-a89d-3cbfc43d9120`: A-10106, full stage check plus T1/T2/T3/T4/Web exit 0; 4039/4039, no fail/skip. Darwin arm64 27.0.0, Node 24.21.0, Neovim 0.12.5, two workers. Phase command durations 33/183/926/48/84 s. Queued 16:23:50.914Z through durable file publication 16:45:33.037Z: 1302.123 s including collection/publication, not pure execution wall. Cost N/A. Web 35 files / 180 named tests.

Both covers run T4's ten base files; extra repetitions were skipped. Lint, duration budgets and T3 ratchet are report-only (132 lint findings in 59 files; projected T3/Web overages and measured budget warnings retained). Projections are not measured wall times. Cover metrics files retain the exact receipt lines and durable log paths.

Pre-verdict plan line is retained exactly in E419S1-14.txt: `# bottom bar and inbox home: open; stage cover missing Linux droplet; tree 406e5573e12f94006cf7c6edc2adc2b8471a0180`. It points to the prior not-clear verdict's build. Both new-S receipts are green; the merged hub receipt explicitly reports complete at tree 209119a2. Recheck the plan after this verdict updates its build.

Cleanup: 120 fixture-owned Web census lines report after 0 and scratch hub stopped; T1 keymap census 0/0 as expected. Scratch /private/tmp/qa-e419s1-l0AC9B removed; final detached HEAD and dev still equal full S and tree clean. Worktree removal follows publication/verdict. Original captures retained. The rule proposal on verifying brief selectors/test names at the tested build remains logged in topic-896.

Durable evidence A-10112: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10112-e-419-stage-1-at-1bd43fe0-all-16-cases-pass-after-t-1182/report.md
