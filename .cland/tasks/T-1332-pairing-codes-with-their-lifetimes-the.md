---
id: T-1332
kind: task
title: Pairing codes with their lifetimes, the three-waiting cap and the two-reply limit for strangers
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1308
blocked_by:
  - T-1331
topic: topic-1088
branch: t/T-1332-pairing-codes-with-their-lifetimes-the
created: 2026-10-26T07:54:42.838Z
updated: 2026-10-26T14:48:01.675Z
---

## Summary

A stranger who writes to a paired-capable messenger gets a pairing code. It has 8 characters drawn without 0, O, 1 and I, and comes with the sender's numeric id and the approve command. Codes expire, at most three wait at once, and a stranger gets at most two replies, then silence.

## What to build

Pairing-code generation and the per-messenger limits over T-1323's remote tables (waiting codes, stranger counts). A Telegram code lives one hour and a Discord code 15 minutes. At most three wait per messenger. A stranger gets the code and one more reply, then nothing. Each waiting code is a needs-you inbox row ("Pair Telegram user 12345 (Name)? code …"), and pairing rows never reach a remote. Spec §3.2.

## Acceptance criteria

- [x] C1. Through a test messenger a stranger gets a well-formed code with their id and the approve command, then one more reply, then nothing, and a fourth waiting code is refused (test).
  - done: impl-1332 · 2026-10-26T14:32:18.647Z
  - verified: rev-26 [reviewer] · run rev-20261026-1332-evidence-1 · 2026-10-26T14:48:01.444Z · commit c3628320651a7cdd4d074e57ad4bbd1bd49e81b7
- [x] C2. Codes expire at one hour (Telegram) and 15 minutes (Discord) under an injected clock, and the waiting code appears as a needs-you inbox row that no remote receives (test).
  - done: impl-1332 · 2026-10-26T14:32:18.730Z
  - verified: rev-26 [reviewer] · run rev-20261026-1332-evidence-1 · 2026-10-26T14:48:01.444Z · commit c3628320651a7cdd4d074e57ad4bbd1bd49e81b7

## Comments

### impl-1332 · 2026-10-26T14:13:09.259Z

Rule 20 audit before edits: extending Remote.start with an optional trusted pairing callback (old one-argument implementations remain valid), adding optional Inbox.pairings (legacy Inbox objects remain valid), and suppressing pairing rows/counts across remote inbox reads and broadcasts. Existing request types and stored request records stay unchanged. Consumers: hub/src/remote/{gateway,authority,configuration,state}.ts; hub/src/hub/{inbox,dispatch,snapshot,core,daemon,budget,store,web-authority}.ts; hub/src/cli/inbox.ts; hub/src/roles/handover.ts; hub/src/protocol.ts; shared/wire/index.ts and hub/test/wire-conformance.ts; test messenger and all gateway constructor callers; web connection/inbox visit/archive/notification readers; Neovim hub/state/init/inbox/actions/thread/topic readers; test fixtures, startup probes and QA briefs across all tiers. Full filename inventory will be attached as an artifact. Old sections, ids and archive kinds remain unchanged: old client readers/fixtures safely ignore absent/new optional pairings; dedicated pairing cards belong to E-1313, approval to T-1333. CLI inbox should list the new rows. No new frame, schema requirement or permission. Regressions will retain previous hello and inbox wire shapes, and prove no pairing contents reach remote reads or model deltas.

### impl-1332 · 2026-10-26T14:21:53.201Z

TDD progress: red→green receipts for fake-messenger code format/copy command, two replies and three waiting codes (both platforms), injected-clock exact expiry/inbox mirror exclusions, authority refusal for pairing ids, CLI inbox rows, and the by-id approval/clear seam. The gateway-state persistence test initially failed at its request userId assertion (actual undefined, expected 9007199254740993) because it had wall-clock dates already expired at hub startup; migrated that consumer to an injected clock at the request's creation time, retaining its final persistence assertion. Inventory A-12425. No real messenger, browser, token or key used.

### rev-26 · 2026-10-26T14:30:48.905Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1332-source-1
commit: 84f4096d522421a9df0dc539af41d02be63dcdff
scope: full
findings: [{"severity":"medium","text":"M1: new pairing-* rows follow planned-stage, violating lexical tier ordering and refusing admission. Move only those entries before permissions, retaining T2/T1; owning guard red/green required. Implementer reports uncommitted correction.","file":"hub/test/tiers.json","line":291},{"severity":"medium","text":"M2: needsYou(false) captures a total, then subtracts pairingCodes.waiting().length at a later clock observation. Expiry between them removes the pairing but leaves the captured total including it, so remote hub.status can expose a pairing-only count. Use one consistent projection or recompute on expiry; add an injected-clock deadline-crossing control with a non-pairing positive row, preserving existing expiry/filter/authority assertions.","file":"hub/src/hub/inbox.ts","line":574}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated full source audit complete: Standards M1, Spec M2; two medium findings, no other findings. A-12429 records persistence/limits/expiry, authority, all changed consumers and compatibility review with local evidence limits. Fix M1/M2, retain assertions, restore claimant done and request fresh pushed-head source review before one mode-free verify. Coordinator full cover/landing separate; no Reviewer execution.

Criteria: C1 failed (M1 prevents configured verification admission at this head.), C2 failed (M2 allows a pairing-only needs-you count to reach remote status across an expiry boundary; M1 also blocks admission.).

### rev-26 · 2026-10-26T14:33:02.511Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1332-source-2
commit: c3628320651a7cdd4d074e57ad4bbd1bd49e81b7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; M1/M2 resolved, no remaining Standards/Spec findings. A-12431 records the full base-to-head audit plus four-file correction: tier ordering fixed without tier changes; remote count uses the total and pairing rows from one Inbox projection, with both exact clock-crossing controls and ordinary request positive assertion. All existing limits/expiry/filter/authority/compatibility cases retained. A-12430 targeted local evidence remains distinct from configured proof. C1/C2 done restored, final verification pending one same-head mode-free run. No Reviewer execution.

### rev-26 · 2026-10-26T14:48:01.444Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1332-evidence-1
commit: c3628320651a7cdd4d074e57ad4bbd1bd49e81b7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1/C2 verified. A-12435 independently audits original A-12434 / run 310eaba6-59d0-4822-b8bc-8bfa21248484: exit0, 3426 ordinary test passes /460 files; ten new pairing identities each base+5 actual scoped load passes (50 separate load-test executions), all pass. Exact limits/restart/TEXT, injected expiry/remote row+count exclusion/authority, old shape, CLI and both M2 clock-crossing controls pass. Max new base/load0.336284834s, no new allowance required. T0/allT1/fallback allT2/Web complete; noT3/T4 Linux execution, no full-cover/platform-demo claim. Host prepared-tree reuse, browser pin and report-only diagnostics retained. Local targeted T3 receipts remain separate; Coordinator owns additional full cover/landing. No Reviewer execution.

Criteria: C1 verified, C2 verified.
