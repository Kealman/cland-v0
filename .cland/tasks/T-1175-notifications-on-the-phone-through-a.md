---
id: T-1175
kind: task
title: Notifications on the phone through a service worker
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1166
  - T-1128
  - T-1142
topic: topic-917
branch: t/T-1175-notifications-on-the-phone-through-a
created: 2026-10-23T07:00:04.656Z
updated: 2026-10-23T20:28:40.721Z
---

## Summary

On a phone, notifications go through a service worker: the subscription button in More asks for the permission and registers the worker on a tap, the "needs you" and "finished" switches live in More, and T-1128's rules raise notifications through the worker, whose click focuses the app on the row.

## Parent

E-419 (§3.6 notifications on the phone; choices "The subscription button" and "The service worker"; the second part of tracer step 6). Reuses T-1128's rules and T-1142's switches.

## What to build

- **The worker** is served at the root scope and has no fetch handler, so it never serves a stale shell. It handles a notification click: it focuses an open client and sends it the row to open, or opens the app at that inbox row when none is open.
- **More** holds T-1142's two switches, per browser, and the subscription button. A tap on the button asks for the notification permission and registers the worker, as iOS requires a tap; it creates no Web Push subscription (push with the page closed is 0.2.x). A denied permission turns both switches off and the button's tooltip says why. At phone width the switches live in More, not in the profile block.
- **Delivery.** T-1128's rules decide (now layer only, never while the page is visible and focused, one per row as its tag, naming the session, the item and what waits); with an active worker registration the notification goes through `showNotification`, otherwise through the page's `Notification` as on the desktop. A waiting plan and a TUI-bound approval are inbox rows and notify like any row.
- **The harness** gains a context option that allows service workers; the default stays blocked. The suite stubs the permission and `showNotification`; a real notification is QA's demo with the full Chromium build.

## Acceptance criteria

- [ ] C1. At 390x844 More holds the "needs you" and "finished" switches and the subscription button, and a tap on the button requests the permission and registers the worker without creating a push subscription (Web test).
- [ ] C2. With the worker registered and `showNotification` stubbed, a new ask while the page is hidden raises one notification through the worker naming the session, the item and the question (Web test).
- [ ] C3. A waiting plan and a fake Claude Code approval entering the inbox each raise one notification through the worker (Web test).
- [ ] C4. The worker has no fetch handler, and its click handler focuses an open client and sends it the row, or opens the app at the inbox row when none is open (test).
- [ ] C5. A denied permission turns both switches off and the subscription button's tooltip says why (Web test).

## Comments

### impl-1175 · 2026-10-23T20:28:40.721Z

Implemented worker click/no-fetch contract, More subscription and shared switches, active-worker delivery with page fallback, encoded cold-entry row navigation, and edge MIME/root-scope headers. Vertical red→green receipts: missing worker script, missing More controls (0 !== 2), missing worker showNotification receipt, missing root header (undefined !== '/'). New sealed Web tests cover ask/plan/TUI approval and denial; required targeted regression set now running. Docs and implement skill updated with one-line CHANGES provenance; role clauses unchanged.
