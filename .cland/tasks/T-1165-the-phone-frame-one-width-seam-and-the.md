---
id: T-1165
kind: task
title: "The phone frame: one width seam and the bottom bar"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by: []
topic: null
branch: null
created: 2026-10-23T07:00:02.025Z
updated: 2026-10-23T07:00:15.247Z
---

## Summary

Below 640 CSS px the shell gives way to the phone frame: a compact header, one screen and a bottom bar of Inbox, Topics, Sessions, Events and More with their counts, More opening a small sheet of Items, Artifacts and Accounts. One width seam replaces the scattered 639 px checks, and the Web harness gains a phone context.

## Parent

E-419 (§3.6 the bottom bar, P24 and P26; choices "The phone width" and "Touch"; the prefactor and the first half of tracer step 1).

## What to build

- **The width seam.** One module answers whether the page is at phone width (below 640 CSS px), the way `desktop.ts` answers 1280 px, and the shell and the Sessions area's narrow row tap and Enter read it, so the phone has one breakpoint. Between 640 and 1279 px the desktop shell keeps running with the rail collapsed, as today.
- **The frame.** Below 640 px the rail is not rendered. A bottom bar holds Inbox, Topics, Sessions, Events and More, each a target at least 44 px tall with its icon, name and count, the current one marked. The counts come from the same source as the rail's badges; Events counts the events since the human's last look, as the inbox's events line does. The header keeps the project, the release chip, Search (the palette) and the needs-you pill with the hub dot; the Coordinator chip and `?` leave the header at this width (help stays in the palette).
- **No split, no drawer.** At phone width ⌘\ opens no split and a selected row opens no drawer; a split saved on the desktop stays saved and returns when the page is widened. A first load at phone width with no saved area opens Inbox.
- **More.** More opens a small sheet above the bar, without a scrim, listing Items, Artifacts and Accounts; choosing one opens it, and Escape (through the key map, never a component-local listener) or a tap outside closes it. Their read-only behaviour is the next ticket.
- **The harness.** A Web case can ask for a phone context: 390x844 with touch and the mobile flag in Chrome Headless Shell. Readiness waits for the bar's five slots instead of the rail's seven areas. No new dependency.

## Acceptance criteria

- [ ] C1. At 390x844 the rail is absent and the bottom bar shows Inbox, Topics, Sessions, Events and More with their counts, and a tap on each of the four areas opens it (Web test).
- [ ] C2. At 640 px the shell shows the collapsed rail and no bar, and resizing to 639 px swaps the rail for the bar without a reload (Web test).
- [ ] C3. At 390x844 ⌘\ opens no split and a selected row opens no drawer, and a split saved at 1440 px returns when the page is widened again (Web test).
- [ ] C4. More opens a sheet above the bar without a scrim listing Items, Artifacts and Accounts, and Escape or choosing one closes it (Web test).
- [ ] C5. Every visible control of the header, the bar and the More sheet at 390x844 is at least 44 px tall (Web test).
- [ ] C6. `web/README.md` gains a Phone section on the width seam, the bar, More and the phone test context (docs).
