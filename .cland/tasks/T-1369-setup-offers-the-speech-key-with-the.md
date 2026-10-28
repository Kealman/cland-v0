---
id: T-1369
kind: task
title: Setup offers the speech key with the provider's data-use line
state: open
status: review
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
updated: 2026-10-28T22:28:18.962Z
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
- [x] C2. With `provider = "command"` or `provider = ""`, setup asks nothing about a key, and without a terminal a missing ElevenLabs key prints `open` with `cland secret set speech.elevenlabs_key` (test).
  - done: impl-1369 · 2026-10-28T22:27:52.998Z
- [x] C3. The docs page and the tour stage name the speech key's command, and they pass the docs and onboarding command checks (test).
  - done: impl-1369 · 2026-10-28T22:27:53.088Z

## Comments

### impl-1369 · 2026-10-28T22:24:04.410Z

Consumer audit before adding the setup speech result row: production runner/types, terminal/JSON setup CLI and setup narration consume arbitrary SetupLine arrays (unchanged fields); direct remotes callers in setup-pairing-component remain unchanged. Exact row/count and prompt consumers: setup-flow, setup-hub, setup-handover, setup-cli, setup-remotes, setup-remote-component; migrate those fixtures/assertions. Other setup tests select named rows or isolated steps and are unaffected. Shipped onboarding TOUR, CLI SETUP_USAGE, hub README, secrets guide and remote-control page need the new offer/command. Site remote-docs source checks and hub remote-docs wrapper plus skills-onboarding command guards cover docs. QA briefs/startup probes, web and Neovim have no setup-row contract consumers found. No frame shape, persisted schema or admission policy changes; prior remote.status compatibility remains untouched.

### impl-1369 · 2026-10-28T22:27:15.143Z

Audit follow-up: T3 scenarios/setup.test.ts has native PTY scripts and exact row arrays; it now pre-seeds a private synthetic speech key and expects speech ok, preserving its lifecycle assertions without new prompts/processes. QA E-613 checks native scenario exit codes rather than fixed report row counts; executor-safety-component's report steps refer to verifier reports, unrelated to setup. Local macOS changed-file tests and typecheck are green so far; new speech cases finish below 20 ms here (Linux duration evidence awaits verifier).
