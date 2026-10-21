---
id: T-988
kind: task
title: The network, the tunnel and the phone's link
state: open
status: ready
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
topic: topic-792
branch: t/T-988-the-network-the-tunnel-and-the-phone-s
created: 2026-10-20T16:50:00.743Z
updated: 2026-10-21T10:08:55.478Z
---

## Summary

`[web] bind` opens the web edge to the network while the spokes' edge stays on loopback, and ADR 0003 records the amendment. `[web] origin` names the human's tunnel. `cland web --qr` prints the phone's link as a QR code, and `cland doctor` warns about plain HTTP on the network.

## What to build

`[web] bind` defaults to `127.0.0.1`. A network address serves the web edge there under the same Host and Origin checks. `[web] origin` names the tunnel's HTTPS origin. Its host joins the Host allow-list, it passes the Origin check, and a cookie issued for a request whose Host and Origin match it carries `Secure`; the last hop is plain HTTP, so forwarded headers are not trusted. `cland web --qr` prints the tunnel's link when `[web] origin` is set, or else the LAN link when `[web] bind` exposes one, drawn with Unicode half blocks by a vendored MIT-licensed encoder with no new runtime dependency. On loopback alone, `--qr` refuses and says why. `cland doctor` warns when the edge is on the network without a tunnel.

## Acceptance criteria

- [x] C1. With `[web] bind` set to a LAN address, the web edge listens there while the spokes' edge stays on 127.0.0.1 (test reads both bound addresses).
  - done: impl-988 · 2026-10-21T09:52:18.939Z
  - verified: rev-23 [reviewer] · run rev-20261021-988-final · 2026-10-21T10:08:55.422Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2
- [x] C2. `[web] origin` adds its host to the Host allow-list and passes the Origin check, and a cookie issued for a request whose Host and Origin match `[web] origin` carries `Secure`; forwarded headers are not read (test).
  - done: impl-988 · 2026-10-21T09:52:43.506Z
  - verified: rev-23 [reviewer] · run rev-20261021-988-final · 2026-10-21T10:08:55.422Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2
- [x] C3. `cland web --qr` prints the tunnel's link when `[web] origin` is set, else the LAN link, as a half-block QR code, and refuses with the reason on loopback alone (CLI test; the encoder's test vectors decode back to the link).
  - done: impl-988 · 2026-10-21T09:58:09.693Z
  - verified: rev-23 [reviewer] · run rev-20261021-988-final · 2026-10-21T10:08:55.422Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2
- [x] C4. The QR encoder is vendored with its MIT licence, and `package.json` gains no runtime dependency.
  - done: impl-988 · 2026-10-21T09:52:43.876Z
  - verified: rev-23 [reviewer] · run rev-20261021-988-source-2 · 2026-10-21T09:59:01.686Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2
  - verified: rev-23 [reviewer] · run rev-20261021-988-final · 2026-10-21T10:08:55.422Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2
- [x] C5. `cland doctor` warns when the web edge is bound to a network address without `[web] origin` (doctor test).
  - done: impl-988 · 2026-10-21T09:52:43.993Z
  - verified: rev-23 [reviewer] · run rev-20261021-988-final · 2026-10-21T10:08:55.422Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2
- [x] C6. ADR 0003 carries a dated amendment for `[web] bind`, and `hub/README.md` documents `[web] bind`, `[web] origin` and `--qr`.
  - done: impl-988 · 2026-10-21T09:52:44.129Z
  - verified: rev-23 [reviewer] · run rev-20261021-988-source-2 · 2026-10-21T09:59:01.686Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2
  - verified: rev-23 [reviewer] · run rev-20261021-988-final · 2026-10-21T10:08:55.422Z · commit c6e33d4e08d6084f4931a4053600994d7d0482e2

## Comments

### impl-988 · 2026-10-21T09:40:12.274Z

Implementation started. Test seams: the epic-approved real HTTP/WebSocket/CLI boundary with isolated projectHub fixtures; config, QR vectors and doctor policy at T1. No browser/GUI or live-hub exposure.

### rev-23 · 2026-10-21T09:56:13.733Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-988-source
commit: 4fe8c452ec9c8d51102b196148550ffe3a912e69
scope: full
findings: [{"severity":"medium","text":"M1: phoneOrigin selects fe80:: addresses as shareable LAN targets. For bind :: and candidates ['fe80::1','192.0.2.4'], it returns an unscoped link-local URL rather than the usable IPv4 target. web-edge.ts:153 checks '%' but Node supplies scopeid separately, then drops it. Skip scope-dependent link-local candidates, fall through to usable LAN addresses and refuse accurately when none remain; cover link-local-first, only-link-local and tunnel precedence.","file":"hub/src/web-address.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. A-8236 contains Standards/Spec audit at fixed base cbc6c6230054b8c74b6f625c0ed6b28642759db9. One medium C3 finding: wildcard IPv6 enumeration can yield a QR to an ambiguous/unusable link-local endpoint despite an available usable LAN candidate. This is a source-derived case, not an executed probe. Node documents scopeid separately; RFC4007 notes zone indices are node-local. Other changes reviewed: independent actual bind receipts, tunnel exact Host/Origin and Secure condition as explicitly specified, no forwarded-header trust, vendor MIT/pin/no package dependency, independent QR decoder, stopped-hub doctor, docs/ADR/help/skill/clause updates. Top-level auth GET without Origin matches the supplied rule and is not a finding. A-8234 targeted Mac/static summaries are not full-suite/browser evidence. Please correct M1 and request fresh source review before verification.

Criteria: C3 failed (Wildcard phone QR selection can choose a scope-dependent IPv6 link-local address before an available usable LAN address.).

### impl-988 · 2026-10-21T09:58:03.226Z

Reviewer M1 corrected at c6e33d4e: red reproduced fe80::1 selection before LAN; green selection skips IPv6 link-local/scoped and unusable destinations, retains tunnel precedence and gives accurate refusal. Local macOS targeted network T1 4/4 and QR CLI T2 3/3 passed; npm run check passed (test lint report mode, 0 refusals). Fresh source review requested before verification.

### rev-23 · 2026-10-21T09:59:01.686Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-988-source-2
commit: c6e33d4e08d6084f4931a4053600994d7d0482e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; M1 closed, no remaining findings. A-8239 retains the full first-pass audit A-8236 and reviews the four-file correction: skip scoped/link-local fe80::/10 and unusable candidates, fall through to LAN/ULA, accurate refusal and preserved tunnel priority; new pure tests exercise each path. No dev merge or unrelated implementation change. C4 MIT vendor/no package dependency and C6 dated ADR/docs/help/guidance verified from source. C1/C2/C3/C5 await same-head configured execution. Secure is checked against the explicitly supplied Host+Origin rule, including documented missing-Origin GET behavior; forwarded headers confer no trust. A-8238 targeted macOS/static evidence is separate from full-suite/browser evidence. Proceed with normal mode-free verification at this exact unchanged head.

Criteria: C4 verified, C6 verified.

### rev-23 · 2026-10-21T10:08:55.422Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-988-final
commit: c6e33d4e08d6084f4931a4053600994d7d0482e2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-8251 audits A-8245/run 82a1276a at unchanged source-clear c6e33d4e. Linux x64 c-8 lon1 T1/all-T2 fallback across both packages exit 0: 2240 ordinary passes/343 files plus 55 load-test passes; all eleven new identities have five distinct passing load finishes. C1 actual web/spoke address test, C2 tunnel Host/exact Origin/Secure/no forwarded trust, C3 CLI refusal/tunnel/recorded-LAN plus independent QR vectors and corrected M1 wildcard policy, C5 stopped-hub and pure doctor warnings all passed; C4/C6 retain source proof. Recorded LAN case is synthetic, not actual phone/LAN/browser proof. No findings. Host check reference faa2c5cc682cea2b7ef4fcefa3b996a6f5ebc454 not repeated remotely; lint/duration/ratchet report-only, one missing baseline. Web explicitly not run for missing libraries/T-993; no T3/T4/stage/QA pass claimed. Coordinator ee908e3a-7029-4d28-bdc3-329adf312144 accepts this Linux receipt for enqueue and assigns Web to E-412 stage 3 macOS covers. Lifetime 447s, reported cost $0.0310.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
