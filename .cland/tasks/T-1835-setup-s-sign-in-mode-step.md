---
id: T-1835
kind: task
title: Setup's sign-in mode step
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1831
topic: topic-1515
branch: t/T-1835-setup-s-sign-in-mode-step
created: 2026-11-12T10:07:22.624Z
updated: 2026-11-15T06:36:56.892Z
closed: 2026-11-15T06:36:56.892Z
---

## Summary

`cland setup` gains an optional sign-in mode step after the hub step and before the remote step. It offers single or users, and single is the default, which `--yes` keeps. On users, it switches the hub, prints the first user's one-time invite link, and waits for the first user's passkey (question 4).

## What to build

GLOSSARY's Setup order (the hub, the sign-in mode, a remote, agent hosts, the Aide) and spec §3.8 and §3.9. The step:
- **Detects** the mode and, in users mode, the users. A project already in users mode prints `ok` with the number of users and asks nothing.
- **Offers** "Let several people sign in to the web (users mode)?", default No. `--yes` takes that default, with or without a terminal: single mode stays and the step prints `skip`.
- **Switches** on yes, after a confirmation. The confirmation says that switching signs out the current browser sessions and that `cland auth reset` is the only way back. The switch goes through the hub, as `cland auth mode users` does, and creates the first user from git's `user.name`.
- **Invites.** It prints the first user's name and the one-time invite link, and waits for the passkey registration on the invite page. Enter skips the wait. A registered passkey ends the step `done`; a skip ends it `open` with `cland user invite <name>`.
- **Without a terminal** (and without `--yes`) it changes nothing and prints `skip` with `cland auth mode users` as its fix, like the other optional steps, so unattended setup keeps its exit status (amended 2026-11-15 by the Coordinator: `open` makes setup exit 1).

The link appears in no hub log line or journal record.

## Acceptance criteria

- [x] C1. With a scripted prompter, the sign-in mode step runs after the hub step and before the remote step, its offer defaults to No, and `--yes`, with or without a terminal, leaves single mode with the step `skip` (test).
  - done: impl-1835 · 2026-11-15T04:32:36.041Z
  - verified: rev-37 [reviewer] · run rev-37-1835-evidence-2 · 2026-11-15T05:25:22.626Z · commit c435f67e19cb9f56dac9cf19ed3deb6107af2b7f
- [x] C2. Choosing users switches the hub to users mode after a confirmation naming the browser sign-out and `cland auth reset`, and the step prints the first user's name and one-time invite link (test).
  - done: impl-1835 · 2026-11-15T04:32:48.340Z
  - verified: rev-37 [reviewer] · run rev-37-1835-evidence-2 · 2026-11-15T05:25:22.626Z · commit c435f67e19cb9f56dac9cf19ed3deb6107af2b7f
- [x] C3. A passkey registered on the invite page in an isolated headless browser with a virtual authenticator ends the step `done`, with the first user active in `cland user list` (test).
  - done: impl-1835 · 2026-11-15T05:02:05.430Z
  - verified: rev-37 [reviewer] · run rev-37-1835-evidence-2 · 2026-11-15T05:25:22.626Z · commit c435f67e19cb9f56dac9cf19ed3deb6107af2b7f
- [x] C4. Skipping the wait ends the step `open` with `cland user invite <name>`, and without a terminal (and without `--yes`) a single-mode project's step changes nothing and prints `skip` with `cland auth mode users` as its fix, so unattended setup's exit status is unchanged (test).
  - done: impl-1835 · 2026-11-15T04:32:48.613Z
  - verified: rev-37 [reviewer] · run rev-37-1835-evidence-2 · 2026-11-15T05:25:22.626Z · commit c435f67e19cb9f56dac9cf19ed3deb6107af2b7f
- [x] C5. A project already in users mode prints `ok` with its number of users and asks nothing, and the invite link appears in no hub log line or journal record (test).
  - done: impl-1835 · 2026-11-15T05:02:05.588Z
  - verified: rev-37 [reviewer] · run rev-37-1835-evidence-2 · 2026-11-15T05:25:22.626Z · commit c435f67e19cb9f56dac9cf19ed3deb6107af2b7f

## Blocked by

- E-1536 (closed)
- T-1831 (the setup runner and step types)

## Notes

- Hot files: `hub/src/setup/steps/signin.ts` (new), `hub/src/setup/runner.ts` (the step order), `hub/src/setup/types.ts`, `hub/src/setup/hub.ts`, `hub/test/setup-prompter.ts`.
- Tests: new `hub/test/setup-signin.test.ts` (T2, scripted prompter, `projectHub` with the web edge); the passkey case in `web/test/setup-signin.test.ts` (Web, isolated Headless Shell with a CDP virtual authenticator, as the passkey tests do); `hub/test/setup-flow.test.ts` order updated.
- Serves epic C5.

## Comments

### impl-1835 · 2026-11-15T04:23:16.497Z

Rule 20 sweep before change: setup order consumers found in runner, setup-flow, setup-cli, setup-favourite (summary), setup-hosts (runner continuation), docs/hub/cland-setup.md, hub README/usage, stage-3 QA and E-1313/E-616 briefs. For passkey completion, propose opt-in user.list setup:true metadata (mode and per-user passkeyRegistered); default user.list reply/refusal remains identical. Consumers searched by user.list/auth.mode/userList: CLI auth, daemon/control/dispatch, protocol/shared wire, web authority, web Accounts/invites, user-mode/users/passkeys and answer/message-user tests, Neovim recorded frames, QA E1536/stage briefs. Existing consumers omit setup and remain on prior shape; new setup client treats absent metadata as unknown/open.

### rev-37 · 2026-11-15T04:36:46.805Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1835-source-1
commit: b81e6ba6be7b4fcbb163ca313c95bf9afe7e7a30
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review clear, no findings. Signin runs hub→signin→remotes; default-No offer+confirmation, hub-owned auth switch, terminal-only invite, persisted passkey identity check, bounded socket reads and joined abortable prompt/observer follow amended C1–C5. Ordinary user.list shape/refusal and permission classification retained; opt-in setup metadata boolean-validated and old/absent metadata remains unknown. Order/help/golden/docs/skill migrations checked; prior-wire guard retained. A-19494 is partial candidate-summary evidence only; provenance and normalized all-tier consumer ledger requested for final evidence. Historical stage-4 exact-order literal is pinned1114abeff and must be labelled separately. No criteria verified until exact-head configured named receipts.

### rev-37 · 2026-11-15T04:59:51.734Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1835-evidence-1
commit: b81e6ba6be7b4fcbb163ca313c95bf9afe7e7a30
scope: evidence
findings: [{"severity":"medium","text":"Invite navigation races the already-open shell's forced sign-out redirect; three recorded repetitions fail before the passkey ceremony.","file":"web/test/setup-signin.test.ts","line":47},{"severity":"medium","text":"Navigation errors retain the credential-bearing invite URL, which is copied unmasked into automatic suite diagnostics; sanitize at the test boundary before reporting.","file":"web/test/setup-signin.test.ts","line":47},{"severity":"low","text":"Twenty object-valued manifest tiers render as [object Object], so the claimed normalized tier ledger is incomplete; preserve all 979 paths and normalize via .tier.","file":".cland/artifacts/A-19506-t-1835-normalized-all-tier-consumer-ledger.md"}]
finding_counts: {"high":0,"medium":2,"low":1}

Evidence not clear despite configured base exit0. Exact head/canonical tree match,6326 ordinary tests+698 file passes and T2 five-name5/5 controls are positive. New Web report-only repetition is7/10 attempted10/10, with concrete page.goto interrupted-by-/signin errors on3/7/9: old shell session revocation races invite navigation at setup-signin.test.ts:47. Those errors also expose full generated invite URLs in automatic diagnostics (rule15); tokens omitted from this report. This is a source/test-boundary race and capture finding, not promotion of advisory load gating. Low: A-19506 retains979 paths but20 object tiers print [object Object]. Independent normalized ledger confirms all220T1/422T2/55Web case+file passes,1T3 scenario pass,264T3/17T4 deferred. C3/C5 failed; fresh corrected-head source review precedes another verify.

Criteria: C3 failed (Three actual Web repetitions fail before the ceremony because the former authenticated shell redirects over invite navigation.), C5 failed (Generated invite URL is exposed in navigation-error diagnostics and automatic suite artifact; test-boundary capture redaction is missing.).

### rev-37 · 2026-11-15T05:03:01.018Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1835-source-2
commit: c435f67e19cb9f56dac9cf19ed3deb6107af2b7f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear. Fresh isolated context removes the old authenticated-shell redirect writer; actual auth switch/invite/passkey/active-user/joined-reader assertions retained. Shared remoteRedactor registers URL+token; outer sanitized Error drops credential-bearing cause/assertion fields, and positive-control production loadDiagnostic serialization proves URL/token removal before navigation. Context and setup waiters join before disposal; no tracing of private ceremony. A-19532 independently has979 normalized paths, zero omissions/tier mismatches. Only Web control and guide changed; no production/dev merge. A-19530 remains predecessor base-pass/advisory7-of10 failure history. All criteria remain run-dependent/unverified pending new configured same-head evidence.

### rev-37 · 2026-11-15T05:25:22.626Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1835-evidence-2
commit: c435f67e19cb9f56dac9cf19ed3deb6107af2b7f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear: run b2e70b6b/A-19540 matches reviewed c435f67e1 and independently recomputed canonical tree c13b3b6c503a1f2c479b75e49cea15f6b08300e6. T0/allT1/fallbackallT2/changedT3 scenario/Web exit0;6326 base test+698 base file passes, zero negative finishes. All5 setup-signin cases base+5/5, abortable-reader control base+5/5, actual passkey Web1.662968176s and scenario13.393809786s pass. Separate Web whole-file report-only CPU repetition10/10 attempted/passed; no per-case5/5 Web claim. Planted serializer secrecy control executes; no invite-pattern matches in final log. All979 normalized conservative ledger paths retained; every220T1/422T2/55Web has case+file pass,1T3 scenario current,264T3/17T4 deferred. Source fixes resolve old navigation/capture findings; A-19530 old7/10/leak history remains. Linux droplet Node24.21/Nvim0.12.5, HeadlessShell1248/CfT156.0.8078.4, uncached/skips[]. C1–C5 verified; report-only advisories and after-stage QA split retained.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-15T06:36:56.892Z

Merged 5885fe1bfb1b3395eb25c1c2aa4898f1c798538f onto dev.
