---
id: T-1369
kind: task
title: Setup offers the speech key with the provider's data-use line
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1313
blocked_by:
  - T-1366
  - T-1367
  - T-1368
  - E-1311
topic: topic-1166
branch: t/T-1369-setup-offers-the-speech-key-with-the
created: 2026-10-27T05:46:51.082Z
updated: 2026-10-28T22:56:21.254Z
---

## Summary

After the messengers, setup's remote step offers the ElevenLabs key. It shows the provider's data-use line (the same text `cland remote status` prints), then stores the key through the hidden question. The docs page and the tour stage gain the speech key.

## What to build

Spec §3.11 (setup offers the speech key) and §3.6 (data use). The offer appears only when `[speech] provider` is a cloud provider whose key is missing. For `command` and for `""` it prints one line and asks nothing. The data-use line comes from E-1311's single constant. The key goes to `speech.elevenlabs_key` through 05's hidden question.

- A decline prints `skip`. A present key prints `ok`.
- Without a terminal the offer prints `open` with `cland secret set speech.elevenlabs_key`.

The remote-control page gains the speech key and its data-use line, and the tour stage gains one sentence on voice notes.

**External wait and shared files:** E-1311 (the speech providers and the data-use line) · **Shared files:** hub/src/setup/steps/ (the remote step), .agents/skills/onboarding/TOUR.md, the remote-control docs page

## Acceptance criteria

- [x] C1. With a scripted prompter, setup shows the data-use line that `cland remote status` prints, reads a made-up key through the hidden question and stores it, ending in `done`; a decline prints `skip` and a present key `ok` (test).
  - done: impl-1369 · 2026-10-28T22:27:52.892Z
  - verified: rev-31 [reviewer] · run rev-20261028-1369-final1 · 2026-10-28T22:56:20.608Z · commit 33483bcddb0008221089895362274a54a2322bd2
- [x] C2. With `provider = "command"` or `provider = ""`, setup asks nothing about a key, and without a terminal a missing ElevenLabs key prints `open` with `cland secret set speech.elevenlabs_key` (test).
  - done: impl-1369 · 2026-10-28T22:27:52.998Z
  - verified: rev-31 [reviewer] · run rev-20261028-1369-final1 · 2026-10-28T22:56:20.608Z · commit 33483bcddb0008221089895362274a54a2322bd2
- [x] C3. The docs page and the tour stage name the speech key's command, and they pass the docs and onboarding command checks (test).
  - done: impl-1369 · 2026-10-28T22:30:13.628Z
  - verified: rev-31 [reviewer] · run rev-20261028-1369-final1 · 2026-10-28T22:56:20.608Z · commit 33483bcddb0008221089895362274a54a2322bd2

## Comments

### impl-1369 · 2026-10-28T22:24:04.410Z

Consumer audit before adding the setup speech result row: production runner/types, terminal/JSON setup CLI and setup narration consume arbitrary SetupLine arrays (unchanged fields); direct remotes callers in setup-pairing-component remain unchanged. Exact row/count and prompt consumers: setup-flow, setup-hub, setup-handover, setup-cli, setup-remotes, setup-remote-component; migrate those fixtures/assertions. Other setup tests select named rows or isolated steps and are unaffected. Shipped onboarding TOUR, CLI SETUP_USAGE, hub README, secrets guide and remote-control page need the new offer/command. Site remote-docs source checks and hub remote-docs wrapper plus skills-onboarding command guards cover docs. QA briefs/startup probes, web and Neovim have no setup-row contract consumers found. No frame shape, persisted schema or admission policy changes; prior remote.status compatibility remains untouched.

### impl-1369 · 2026-10-28T22:27:15.143Z

Audit follow-up: T3 scenarios/setup.test.ts has native PTY scripts and exact row arrays; it now pre-seeds a private synthetic speech key and expects speech ok, preserving its lifecycle assertions without new prompts/processes. QA E-613 checks native scenario exit codes rather than fixed report row counts; executor-safety-component's report steps refer to verifier reports, unrelated to setup. Local macOS changed-file tests and typecheck are green so far; new speech cases finish below 20 ms here (Linux duration evidence awaits verifier).

### rev-31 · 2026-10-28T22:30:02.463Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1369-source1
commit: 6d3efa4baf4ab453f88ce9d582c42ef529e8754b
scope: full
findings: [{"severity":"medium","text":"M1: SETUP_USAGE changed without migrating its frozen commands.json row; unchanged exact export and root-help guards disagree. Preserve guard sources and migrate only owning SETUP_USAGE fixture bytes, with original red/green receipts.","file":"hub/src/cli/usage.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13486 consolidated full source1 not clear; M1 only. Requested speech flow matches source and new T1 seam is appropriate; all-tier consumer audit caught frozen-help omission. Implementer reports original unchanged guards red and row-only working correction green; that uncommitted correction is outside this head. C1–C3 runtime-unverified, not falsely failed for this consumer mismatch. No reviewer workloads. Push correction and request fresh source before configured mode-free verification; keep dev base.

### rev-31 · 2026-10-28T22:30:53.355Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1369-source2
commit: 1a8887f836e1b68d10d51ad4dc34f52249cc8de5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13487 source2 clear. M1 resolved: only frozen SETUP_USAGE key changed and now equals production bytes; both guards unchanged. Independently confirmed Coordinator95b367c9 authorizes one dev merge; incoming delta only three allowance owner strings plus tracker records, no cap/timeout/source relaxation. All source1 authored behavior/tests/docs unchanged. C1–C3 pending exact-head original configured evidence. No Reviewer workloads or full run requested.

### impl-1369 · 2026-10-28T22:36:20.538Z

Correction to consumer audit: setup-favourite was incorrectly classified unaffected. Its two whole-run success exit assertions failed in Linux run 6d009d48 and locally: AssertionError 1 !== 0 at lines 162/182, because default missing speech now reports open. Fixture now seeds a private synthetic speech key, matching other unrelated setup fixtures, preserving all original assertions. Local setup-favourite 13/13 green. Run 6d009d48 is partial failed evidence: Linux droplet T0 green, T1 failed, T2/changed T3/Web did not execute; duration budget report mode, $0.0165, lifetime 238s. No new speech case reached 3 seconds in completed T1.

### rev-31 · 2026-10-28T22:37:06.604Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261028-1369-evidence1
commit: 1a8887f836e1b68d10d51ad4dc34f52249cc8de5
scope: evidence
findings: [{"severity":"medium","text":"M2: missed whole-run setup consumer fixture has no speech key; new legitimate open row changes two exact exit expectations from 0 to 1. Preserve assertions, explicitly configure this unrelated fixture, extend consumer inventory and request fresh source before successor verification.","file":"hub/test/setup-favourite.test.ts","line":33}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13496 audits original A-13494/6d009d48: T0 passed, T1 failed (1142 ordinary pass/2 fail plus65 separate load passes); both native assertions 1 !== 0 at setup-favourite162/182. T2/changedT3/Web unexecuted, browser install not coverage, all report-only limits retained. My source audit missed this consumer too. Old run remains failed partial evidence; C1–C3 unverified. Fresh correction review follows, not unchanged-head retry.

### rev-31 · 2026-10-28T22:37:38.405Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1369-source3
commit: 33483bcddb0008221089895362274a54a2322bd2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13497 source3 clear. M2 resolved via exactly two fixture lines: pre-existing owned scratch gets private synthetic speech readiness. All original exit/favourite/roles/trust assertions preserved; no production change/dev merge. Item consumer inventory corrected. Reported local unchanged red11/2 to green13/13 and exact-head typecheck remain macOS evidence; A-13494/A-13496 remain failed partial Linux evidence. C1–C3 pending fresh configured original receipts. No Reviewer workloads or full run requested.

### rev-31 · 2026-10-28T22:56:20.608Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261028-1369-final1
commit: 33483bcddb0008221089895362274a54a2322bd2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13508 configured final evidence clear; C1–C3 verified from original A-13504:4025 ordinary passes+70 separate load passes, seven new task identities each base+5/5, both favourite regressions/frozen help pass. T0/allT1/fallbackallT2/changedT3once/Web complete; remainingT3/T4 absent; actual Linux/CHS/host-tree/report-only limits retained. Existing scenario14.912s and advisory22.369s stanza need no allowance per Coordinator2b310cf4. Prior failed A-13494/A-13496 retained separately. Coordinator-required same-head full-all for six unchanged T3 consumers remains pending; this verdict does not satisfy it or permit enqueue before that gate. Head stays frozen.

Criteria: C1 verified, C2 verified, C3 verified.
