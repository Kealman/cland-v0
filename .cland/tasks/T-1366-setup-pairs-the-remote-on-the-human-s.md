---
id: T-1366
kind: task
title: Setup pairs the remote on the human's yes
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1365
topic: topic-1105
branch: t/T-1366-setup-pairs-the-remote-on-the-human-s
created: 2026-10-27T05:46:50.530Z
updated: 2026-10-27T07:12:49.421Z
closed: 2026-10-27T07:12:49.421Z
---

## Summary

Once Telegram is enabled, setup prints the bot's `t.me` link and waits while the human presses Start. It then shows the waiting code as "Pair Telegram user 12345 (Name)? code …" and approves it with `pairing.approve` on the human's yes.

## What to build

Spec §3.11 (setup approves the code on the human's yes) and §3.2. Setup's hub client gains three calls: remote status (for the bot link), the inbox's pairing rows and `pairing.approve`. It sends them over the local connection that the CLI uses, which the hub accepts.

After enabling, the step prints the link and pauses ("press Start, then Enter"). It then reads this messenger's waiting codes.
- One code: a confirm with the pairing row's text. Yes approves it and prints `done` with the paired name and id. No leaves `open` with `cland remote approve telegram <code>`.
- No code: an offer to wait once more, else `open` with the link.
- Several codes: a choose among them.

Write the wait, confirm and approve logic without anything Telegram-specific, keyed by messenger, so that 11 reuses it with `/cland pair`. Without a terminal, an enabled, unpaired remote prints `open` with the link and the approve command.

**External wait and shared files:** E-1309 (Telegram pairing, T-1342, is on dev) · **Shared files:** hub/src/setup/steps/ (the remote step), hub/src/setup/hub.ts

## Acceptance criteria

- [x] C1. With the fake Bot API and a scripted prompter, a Start sent during the pause shows "Pair Telegram user <id> (<Name>)? code …", a yes pairs it, and the step prints `done` with the name and id (test).
  - done: impl-1366 · 2026-10-27T06:45:52.624Z
  - verified: rev-26 [reviewer] · run rev-20261027-1366-evidence-1 · 2026-10-27T07:06:42.670Z · commit 3f90f313a5644e88ed2a8e1730a8593a3d8566c3
- [x] C2. A no pairs nothing, and the step prints `open` with `cland remote approve telegram <code>` (test).
  - done: impl-1366 · 2026-10-27T06:45:52.714Z
  - verified: rev-26 [reviewer] · run rev-20261027-1366-evidence-1 · 2026-10-27T07:06:42.670Z · commit 3f90f313a5644e88ed2a8e1730a8593a3d8566c3
- [x] C3. With no waiting code after the pause, setup offers one more wait and then prints `open` with the bot link. With two codes it asks which one to approve (test).
  - done: impl-1366 · 2026-10-27T06:45:52.813Z
  - verified: rev-26 [reviewer] · run rev-20261027-1366-evidence-1 · 2026-10-27T07:06:42.670Z · commit 3f90f313a5644e88ed2a8e1730a8593a3d8566c3
- [x] C4. Without a terminal, an enabled, unpaired Telegram remote prints `open` with the bot link and the approve command, and a second terminal run after pairing prints `ok` (test).
  - done: impl-1366 · 2026-10-27T06:45:53.032Z
  - verified: rev-26 [reviewer] · run rev-20261027-1366-evidence-1 · 2026-10-27T07:06:42.670Z · commit 3f90f313a5644e88ed2a8e1730a8593a3d8566c3

## Comments

### impl-1366 · 2026-10-27T06:39:20.070Z

Implementation starts at the assigned seams: setup runner/scripted prompter, local CLI frames via setupHub, and fake Telegram Bot API. Reuse remote.status, inbox.list (pairings optional for old hubs), and pairing.approve without changing wire shapes or admission policy. New SetupHub wrapper methods are additive and optional for existing injected setup clients. No new dependencies or role-clause lines.

### impl-1366 · 2026-10-27T06:44:51.102Z

TDD receipts on local macOS: setup-pairing-component initially left 2 prompts unconsumed (C1), then passed after local inbox/approve integration; declining initially returned the placeholder command instead of the waiting code's exact command (C2), then passed; empty-code scripts left retry prompts unconsumed and multi-code script left selection/confirmation unconsumed (C3), then passed; nonterminal C4 initially reported only 'optional Telegram remote', then passed after adding the known bot link. Wire shapes and admission are unchanged. SetupHub consumers found in cli/setup, setup/types, steps/{hub,aide,remotes}, handover, and setup-{hub,hub-component,handover,remote-component,remotes} tests; existing injected clients retain optional methods. Running the Coordinator-requested complete setup/onboarding/Telegram-pairing file list serially before source review.

### rev-26 · 2026-10-27T06:47:30.931Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261027-1366-source-1
commit: 7db3690a98470e63103399896be33467a2857041
scope: full
findings: [{"severity":"medium","text":"M1 Standards: added pairing line in SETUP_USAGE is absent from owning frozen commands.json row. Preserve compatibility/full-help guards and original red/green exits/output; update only that row.","file":"hub/src/cli/usage.ts","line":20},{"severity":"medium","text":"M2 Standards: existing Telegram-in-setup section still says pairing inside setup is unavailable and all unpaired activation remains open/manual. Replace superseded paragraph to match new pause/choose/default-No confirm/approve flow, with done on approval and open on decline/no-code/nonterminal.","file":"hub/README.md","line":2645}]
finding_counts: {"high":0,"medium":2,"low":0}

Consolidated full source audit complete, A-12626 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12626-t-1366-full-source-1-findings-at-7db3690a9.md. Standards M1/M2 only; no additional Spec/fixture findings. Reviewed messenger filtering, default-No identity grant despite --yes, unchanged local transaction/admission, Start offset and pairing readback, optional SetupHub/old inbox compatibility and serial consumers. A-12623 counters127 local macOS passes across19files; no configured/Linux/browser/full-tier proof, C1–C4 unverified. Corrected pushed-head source review required before configured verification; Coordinator owns landing.

### rev-26 · 2026-10-27T06:49:32.008Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1366-source-2
commit: 3f90f313a5644e88ed2a8e1730a8593a3d8566c3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-12629 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12629-t-1366-source-2-clearance-at-3f90f313a.md. M1 owning frozen setup-help row and M2 stale README section resolved; enhanced --yes/Enter false-default regression preserves null pairing and waiting exact command. No production change, wire/admission change or dev merge. A-12627 original guard red/green and A-12628 corrected serial21-file133-pass local macOS matrix inspected; no configured/Linux/browser/full-tier proof. C1–C4 remain unverified. Keep head stable for authorized mode-free verify, then original-record final evidence review; Coordinator owns landing.

### rev-26 · 2026-10-27T07:06:42.670Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261027-1366-evidence-1
commit: 3f90f313a5644e88ed2a8e1730a8593a3d8566c3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1–C4 verified. Audit A-12633 records independent inspection of original A-12632 / c5f1f55b-e1b5-4ecf-8cf5-c456e4af2ae3: 3,606 ordinary passes, no failures/cancellations/skips/TODO, plus 30 separately scoped load passes (six new identities, each 5/5). Named confirmation, default-No under --yes, decline retaining the waiting code, bounded extra wait, selection and nonterminal cases pass; no new identity reaches 3 s. T0, all T1, fallback all T2 and Web completed on Linux x64; T3/T4 did not run. Pinned Headless Shell 156.0.8078.4 / Playwright v1248 recorded. Host typecheck reused, not remotely repeated; timing/lint notices remain report-only. Source-2 A-12629 unchanged. Coordinator decision 7c930120 accepts this configured task gate; separate stage cover, enqueue and landing remain Coordinator-owned.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-27T07:12:49.421Z

Merged 8fe335fbd187d0897486b919335451a1076b1c2a onto dev.
