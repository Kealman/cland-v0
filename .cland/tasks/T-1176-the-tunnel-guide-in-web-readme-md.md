---
id: T-1176
kind: task
title: The tunnel guide in web/README.md
state: closed
status: done
size: S
criterion_seq: 3
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
updated: 2026-10-23T21:17:21.767Z
closed: 2026-10-23T21:17:21.767Z
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

- [x] C1. `web/README.md` walks from Tailscale Serve with the hub on loopback, through `[web] origin` and `cland web --qr`, to installing the app and turning notifications on in More (docs).
  - done: impl-1176 · 2026-10-23T20:58:54.760Z
  - verified: rev-23 [reviewer] · run rev-20261023-1176-source · 2026-10-23T21:00:38.532Z · commit f7450abfe67b0d6d63c9cc60b36c6b8134a233bd
  - verified: rev-23 [reviewer] · run rev-20261023-1176-final · 2026-10-23T21:12:37.579Z · commit f7450abfe67b0d6d63c9cc60b36c6b8134a233bd
- [x] C2. The guide states that plain HTTP on the LAN gives no install or notification, that iOS keeps the installed app's cookies apart, and that any HTTPS reverse proxy of the human's own works but never a cloud service (docs).
  - done: impl-1176 · 2026-10-23T20:58:55.217Z
  - verified: rev-23 [reviewer] · run rev-20261023-1176-source · 2026-10-23T21:00:38.533Z · commit f7450abfe67b0d6d63c9cc60b36c6b8134a233bd
  - verified: rev-23 [reviewer] · run rev-20261023-1176-final · 2026-10-23T21:12:37.579Z · commit f7450abfe67b0d6d63c9cc60b36c6b8134a233bd
- [x] C3. A hub started with the guide's `[web]` snippet accepts that origin on Host and Origin, and `cland web --qr` prints a link on it (test).
  - done: impl-1176 · 2026-10-23T20:58:55.505Z
  - verified: rev-23 [reviewer] · run rev-20261023-1176-final · 2026-10-23T21:12:37.579Z · commit f7450abfe67b0d6d63c9cc60b36c6b8134a233bd

## Comments

### impl-1176 · 2026-10-23T20:52:20.296Z

Confirmed the supplied C3 seams: T2 projectHub with the README's literal [web] TOML, loopback HTTP/WS carrying configured Host/Origin, and executable `cland web --qr` under sealed HOME/XDG/Git and scratch opener stubs. No real tunnel, network interface or browser. Waiting for T-1175 on origin/dev before writing.

### rev-23 · 2026-10-23T21:00:38.533Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1176-source
commit: f7450abfe67b0d6d63c9cc60b36c6b8134a233bd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1176 full source review

Head f7450abfe67b0d6d63c9cc60b36c6b8134a233bd; tree 13cb9ac8f9ee2214c0d3a39786ab326f4e47dfa7. Branch t/T-1176-the-tunnel-guide-in-web-readme-md. Fixed base/parent 267dfd13923978a835bc4675d08e02477e4dc3f9 (T-1175 landed). Diff command: git diff 267dfd13923978a835bc4675d08e02477e4dc3f9...f7450abfe67b0d6d63c9cc60b36c6b8134a233bd. One commit, four files, 176 additions. Run rev-20261023-1176-source. Clear; findings []; C1 and C2 source-verified, C3 runtime pending.

## Standards

No findings. Reviewed against AGENTS.md, .cland/rules.md (especially 9, 12, 15–18), docs/agents/tests.md Test levels/observable boundaries, docs/review-and-qa.md, and the existing web admission/CLI fixtures. No CONTRIBUTING.md or CODING_STANDARDS.md was found. Crew disables Reviewer subagents; both axes performed in this session. Fowler baseline considered without independent smell findings.

Changes are documentation, one T2 contract and its tier registration; no runtime/dependency/authority/protocol changes. Documentation adds a dedicated matching tests seam, so no changed command/help/skill/role behavior needs migration.

The new test reads the sole literal TOML block from the bounded README guide section without substitutions, asserts loopback and HTTPS, writes it to a disposable root and starts projectHub with FakeClock and fake adapters/probes. The executable CLI is itself under test, which is the allowed T2 subprocess exception. clandWithEnv uses the shared sealed account environment after overlays, including owned HOME/XDG/Git/provider filtering; both browser openers are scratch executable stubs and their absence of use is asserted. Only loopback HTTP/WS is contacted; the synthetic origin remains a Host/Origin value, not a network destination. No Tailscale, GUI, real browser, native harness or startDaemon launch.

The test awaits CLI completion before inspecting link and independently decoded QR; HTTP response completion has a bounded request timeout. WebSocket listeners are installed before hello; open, welcome and exact status result are separately bounded. It checks authenticated completion rather than treating open/presence alone as admission. Shared fixture cleanup stops hub writers before directory removal, checks owned resources, and the test terminates its socket. No sleeps, elapsed-time synchronization, loosened assertion or unclassified test. Diff check clean.

## Spec

C1 established in source. The guide starts with local secure-context limitations, same-tailnet Tailscale Serve preparation, explicit loopback bind and exact HTTPS origin, then hub restart/status to identify the web listener's persistent port (separate from spokes), Serve target/status, cland web --qr and private five-minute/30-day sign-in behavior. Android/iOS installation and More's tap subscription and per-browser switches follow. Commands/settings/status formatting match the shipped CLI and edge owners.

C2 established in source. Plain-HTTP LAN limitations, distinct installed iOS cookies, sign-in in that context, self-owned HTTPS reverse proxy with WebSocket/Host/Origin preservation and no cloud publication are explicit. Badge support is qualified by platform; zero clears it. The page must remain open/connected for notifications; closed-page Push is explicitly outside 0.2.0. These match T-1176 and E-419's accepted scope.

C3 structurally implemented, runtime pending. The README-derived config starts the scratch hub; status proves the web edge is available and bound to 127.0.0.1. Executable --qr must succeed, print the configured origin and /auth token, and decode exactly to the printed link. Actual token redemption through loopback uses configured Host/Origin and checks redirect/cookie; an authenticated WebSocket hello then exact hub.status result establish accepted admission. Existing web-auth tests retain mismatch/refusal coverage; this guide contract tests the positive promise. Real Tailscale provisioning, real installation, platform notifications and badges are stage QA, not simulated coverage claims.

A-10238 is summary evidence: local Darwin arm64 Node24.21.0 precommit working-tree red 'README must contain the HTTPS phone guide', then targeted green; required built web-auth/web-edge/guide 38/38, worst guide identity 0.153166 s, below prescribed 1.6 s T2 threshold. It explicitly records subsequent tier ordering correction. Build, hub typecheck and static/tier/test lint are reported passing, existing 132 report-only findings/59 files, zero refusals. No original raw command stdout/exit logs accompany that summary yet; preserve retained originals durably with actual source/exit/timing attribution, without transcription reruns. These claims are not configured exact-head Linux or load evidence.

Proceed with mode-free cland verify only after current source clearance; final C3 settlement follows its same-head receipt and actual passing-sample/load audit. Coordinator 5d9b6146 in topic-919 additionally authorizes taking T-1183 if landed before final verification; if that changes this reviewed head, request fresh delta source review before verification. No changed-head reuse claim.

QA policy is affected after-stage, no per-item brief or qaCriteria. Reviewer read-only Git/source/log/hub only; no tests, probes, external browsing/network, live browser, GUI, edits, merges or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable source review: A-10241.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-23T21:12:37.579Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1176-final
commit: f7450abfe67b0d6d63c9cc60b36c6b8134a233bd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1176 final evidence review

Head f7450abfe67b0d6d63c9cc60b36c6b8134a233bd; complete Git tree 13cb9ac8f9ee2214c0d3a39786ab326f4e47dfa7; branch t/T-1176-the-tunnel-guide-in-web-readme-md. Run rev-20261023-1176-final. Clear, findings []; C1–C3 verified. Source review A-10241 / rev-20261023-1176-source carries forward at unchanged head.

## Standards

No findings. Independently audited original configured receipt 5a450701-a70e-4b33-a1ac-a45cbddf0c27 / A-10243: exit 0, 2780 ordinary test finishes and 415 file finishes, all pass; zero fail/skip/cancel. T1 132 files, fallback all hub and Neovim T2 240 files, complete Web 43 files. Separate actual load-gate records establish five further guide test/file passes; no reliance on generic five-repetition headers.

Linux x64 6.8.0-142-generic, droplet c-8 lon1 cland-v0-8ab7897f, Node v24.21.0, Neovim v0.12.5, workers 2/Web runner 4, lifetime 587 s/$0.0408. Actual phase walls 48.88 s, 317.27 s and 136.03 s; sums and projections are not wall time. Complete host npm run check output includes typecheck, build, tier/static/test lint, zero refusals. Remote T0 is marked not repeated; reused host candidate tree e9a4920b82c9e05724f6acabda28101a0c37a29f is independently confirmed a Git tree object, not a different commit. Complete task Git tree is separately named above.

Generic lint remains report-only (132 findings in 59 files), as do durations and ratchet. Two missing file duration baselines and projected Web wall warnings remain recorded. Seventeen report-only tier-tripwire diagnostics occur in unchanged claude-code-schedule, connection-snapshot, suite-admission-cost and web-authority tests; none names the new guide identity. They are not silently represented as enforced tier passes.

New guide identity ordinary sample 0.356045477 s; actual five load samples 0.252441775, 0.266585296, 0.261119446, 0.258939474, 0.251698024 s. All below prescribed 1.6 s T2 allowance threshold; prior local 0.153165959 s also below. No allowance required. File process timing is distinct from identity timing.

A-10242 original local continuation receipt independently read: Darwin arm64 Node24.21.0, parent 267dfd13 plus implementation working tree later committed f7450abf; 38/38 targeted tests, zero failure/skip/cancel, total 2422.593166 ms, then hub typecheck. The combined command exited 1 at the subsequent unsorted tier-map guard; tier sorting was later corrected. Initial build/first two test lines are a separately returned chunk absent from this capture; later static success is summary-only in A-10238. This is not a green complete local command-chain claim. Configured current-head check now supplies complete static evidence. No transcription rerun requested or performed.

## Spec

C1 and C2 source-established documentation marks remain current. The guide covers loopback/Tailscale Serve and own HTTPS reverse proxy, exact origin, status-derived web port, QR, install, distinct iOS cookies, More notification controls, HTTP LAN limits and no cloud/closed-page Push.

C3 now established by the same-head ordinary and five repeated T2 passes: the literal README TOML starts the sealed scratch hub, executable cland web --qr prints and independently decodes a link on that configured origin, actual token redemption succeeds on loopback with configured Host/Origin, and authenticated WebSocket welcome plus exact status result succeed. No actual tunnel, external network, GUI or real phone was exercised.

Branch tip/tree independently remain the reviewed values. Lead reports fresh origin/dev b10c9119 read-only conflict check clean and unchanged head/worktree; no dev merge is claimed. Source review already records the Coordinator's conditional T-1183 direction; no changed-head evidence reuse occurred.

T3/T4 not run at this task occasion; configured T3 is deferred to periodic dev/integrated occasions and absent from batch tiers. Real tunnel/install/notification/badge behavior remains affected after-stage QA, no per-item QA brief or criteria. Reviewer performed read-only Git/source/log/hub review, no tests, probes, external browsing/network, live browser, GUI, edits, merge or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable final review: A-10244.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-23T21:17:21.767Z

Merged b4a8280887b18e5c43b6c9f612ce325d4f0d8790 onto dev.
