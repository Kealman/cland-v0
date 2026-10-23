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
updated: 2026-10-23T07:00:22.483Z
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
