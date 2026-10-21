---
id: T-988
kind: task
title: The network, the tunnel and the phone's link
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
topic: topic-792
branch: t/T-988-the-network-the-tunnel-and-the-phone-s
created: 2026-10-20T16:50:00.743Z
updated: 2026-10-21T09:40:12.274Z
---

## Summary

`[web] bind` opens the web edge to the network while the spokes' edge stays on loopback, and ADR 0003 records the amendment. `[web] origin` names the human's tunnel. `cland web --qr` prints the phone's link as a QR code, and `cland doctor` warns about plain HTTP on the network.

## What to build

`[web] bind` defaults to `127.0.0.1`. A network address serves the web edge there under the same Host and Origin checks. `[web] origin` names the tunnel's HTTPS origin. Its host joins the Host allow-list, it passes the Origin check, and a cookie issued for a request whose Host and Origin match it carries `Secure`; the last hop is plain HTTP, so forwarded headers are not trusted. `cland web --qr` prints the tunnel's link when `[web] origin` is set, or else the LAN link when `[web] bind` exposes one, drawn with Unicode half blocks by a vendored MIT-licensed encoder with no new runtime dependency. On loopback alone, `--qr` refuses and says why. `cland doctor` warns when the edge is on the network without a tunnel.

## Acceptance criteria

- [ ] C1. With `[web] bind` set to a LAN address, the web edge listens there while the spokes' edge stays on 127.0.0.1 (test reads both bound addresses).
- [ ] C2. `[web] origin` adds its host to the Host allow-list and passes the Origin check, and a cookie issued for a request whose Host and Origin match `[web] origin` carries `Secure`; forwarded headers are not read (test).
- [ ] C3. `cland web --qr` prints the tunnel's link when `[web] origin` is set, else the LAN link, as a half-block QR code, and refuses with the reason on loopback alone (CLI test; the encoder's test vectors decode back to the link).
- [ ] C4. The QR encoder is vendored with its MIT licence, and `package.json` gains no runtime dependency.
- [ ] C5. `cland doctor` warns when the web edge is bound to a network address without `[web] origin` (doctor test).
- [ ] C6. ADR 0003 carries a dated amendment for `[web] bind`, and `hub/README.md` documents `[web] bind`, `[web] origin` and `--qr`.

## Comments

### impl-988 · 2026-10-21T09:40:12.274Z

Implementation started. Test seams: the epic-approved real HTTP/WebSocket/CLI boundary with isolated projectHub fixtures; config, QR vectors and doctor policy at T1. No browser/GUI or live-hub exposure.
