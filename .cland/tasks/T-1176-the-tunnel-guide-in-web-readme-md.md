---
id: T-1176
kind: task
title: The tunnel guide in web/README.md
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1174
  - T-1175
topic: topic-919
branch: t/T-1176-the-tunnel-guide-in-web-readme-md
created: 2026-10-23T07:00:04.893Z
updated: 2026-10-23T20:52:20.296Z
---

## Summary

`web/README.md` gains a guide from the human's own HTTPS tunnel to an installed app with notifications, with Tailscale Serve as the worked example, and a test keeps the guide's configuration true.

## Parent

E-419 (§3.6 and §3.7 HTTPS through the human's tunnel; choice "The guide"; the last part of tracer step 6).

## What to build

- **Why HTTPS.** A phone on the local network over plain HTTP is not a secure context: no service worker, no notifications, no install.
- **Tailscale Serve, worked through.** The hub stays on loopback; Tailscale Serve forwards the tailnet's HTTPS name to the web edge's port; `[web] origin` names that HTTPS origin; `cland web --qr` prints the tunnel's link as a QR code. Any HTTPS reverse proxy of the human's own works the same way; never a cloud service.
- **Installing.** Add to Home Screen on Android and iOS; on iOS the installed app keeps its cookies apart from Safari, so open the link inside the installed app or sign in again there.
- **Notifications.** Turn them on with a tap on the button in More, then the switches; the badge carries the needs-you count. Push with the page closed is not in 0.2.0.
- **The test** starts a hub with the guide's `[web]` snippet and checks what the guide promises.

## Acceptance criteria

- [ ] C1. `web/README.md` walks from Tailscale Serve with the hub on loopback, through `[web] origin` and `cland web --qr`, to installing the app and turning notifications on in More (docs).
- [ ] C2. The guide states that plain HTTP on the LAN gives no install or notification, that iOS keeps the installed app's cookies apart, and that any HTTPS reverse proxy of the human's own works but never a cloud service (docs).
- [ ] C3. A hub started with the guide's `[web]` snippet accepts that origin on Host and Origin, and `cland web --qr` prints a link on it (test).

## Comments

### impl-1176 · 2026-10-23T20:52:20.296Z

Confirmed the supplied C3 seams: T2 projectHub with the README's literal [web] TOML, loopback HTTP/WS carrying configured Host/Origin, and executable `cland web --qr` under sealed HOME/XDG/Git and scratch opener stubs. No real tunnel, network interface or browser. Waiting for T-1175 on origin/dev before writing.
