---
id: T-1394
kind: task
title: Doctor shows the speech key's presence and the command's resolution, and cland remote status shows the provider's data-use line
state: open
status: ready
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1384
topic: topic-1144
branch: t/T-1394-doctor-shows-the-speech-key-s-presence
created: 2026-10-27T23:37:29.292Z
updated: 2026-10-28T08:51:42.937Z
---

## Summary

Doctor gains speech lines:
- the provider (`elevenlabs`, `command` or off);
- for ElevenLabs, the key's presence with its fingerprint, or a warning with `cland secret set speech.elevenlabs_key`;
- for `command`, whether `argv[0]` resolves.

Doctor never makes a provider call. `cland remote status` ends with one line on the provider's data use and where to change it.

## What to build

`checkRemotes` gains a `speech` group, read from `.cland/config.toml` and the resolved secrets like the token lines:
- **provider:** `ok` with its name, or "off" for `""`;
- **elevenlabs key:** `ok` "present (<fingerprint>)", or `warn` "absent" with the fix;
- **command:** `ok` with the resolved path, or `warn` "argv[0] not found: <name>" with the fix to edit `[speech] command`; an empty command is `warn`.

No line performs a network request or a spawn of the command; resolution is a PATH and executable check (ticket 04's `resolveCommand`).

`cland remote status` appends the provider's line from `SPEECH_DATA_USE`, for example: "speech: elevenlabs. ElevenLabs may train on audio outside enterprise plans until 'Improve the models for everyone' is off (Terms and privacy, Data use), and it stores transcripts." It is computed locally, so the `remote.status` frame does not change. `REMOTE_USAGE` names the line. Spec §3.6 (data use), §3.10 and §3.11.

## Acceptance criteria

- [x] C1. Doctor with a made-up ElevenLabs key in `.cland/secrets.toml` shows the speech key present with its fingerprint and never the value, without one it warns with `cland secret set speech.elevenlabs_key`, and the fake ElevenLabs receives no request in either run (test).
  - done: impl-1394 · 2026-10-28T08:15:50.716Z
  - verified: rev-26 [reviewer] · run rev-20261028-1394-evidence-1 · 2026-10-28T08:51:42.691Z · commit cad60172eebfa48da62f4b1f9cfb3a5a789775e2
- [x] C2. Doctor with `provider = "command"` shows `ok` for a command on `PATH` and a warning naming a missing `argv[0]`, and the command is never run (test).
  - done: impl-1394 · 2026-10-28T08:15:50.811Z
  - verified: rev-26 [reviewer] · run rev-20261028-1394-evidence-1 · 2026-10-28T08:51:42.691Z · commit cad60172eebfa48da62f4b1f9cfb3a5a789775e2
- [x] C3. `cland remote status` prints the ElevenLabs data-use line naming "Improve the models for everyone" and stored transcripts, and the command and off lines for the other settings (test).
  - done: impl-1394 · 2026-10-28T08:18:46.044Z
  - verified: rev-26 [reviewer] · run rev-20261028-1394-evidence-1 · 2026-10-28T08:51:42.691Z · commit cad60172eebfa48da62f4b1f9cfb3a5a789775e2

## Notes

Shared files: hub/src/doctor/remotes.ts, hub/src/cli/remote.ts, hub/src/cli/usage.ts

## Comments

### impl-1394 · 2026-10-28T08:12:55.448Z

Consumer inventory before edits: checkRemotes is called by cli/doctor.ts; Check rows consumed by doctor text/JSON and doctor-{remotes,run,cli,isolation}.test.ts. remote.status callers include cli/remote.ts, web/Neovim remote views, gateway status, harness frames, remote-cli/workbench/neutral tests and QA E-1308/E-1309. Wire/JSON stay unchanged, including legacy-hub rows. New doctor names are additive; existing names and verdicts retained. Plain status footer only affects CLI text; shipped onboarding TOUR and secrets/README/help describe it. No schema, authority, credential resolution or provider-call policy changes.

### rev-26 · 2026-10-28T08:18:25.971Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1394-source-1
commit: 28a1b8d5a4e56f9787f0cb5857ff543f6dd8f591
scope: full
findings: [{"severity":"medium","text":"M1 Standards: changed DOCTOR_USAGE/REMOTE_USAGE not migrated in their frozen owning rows. Preserve unchanged guard red/green; update only those two rows.","file":"hub/test/fixtures/cli-usage/commands.json"},{"severity":"medium","text":"M2 Spec/C3: status discovers owning project hub but reads invocation cwd config; nested invocation incorrectly falls back to ElevenLabs for project command/off. Resolve local config through established project/discovery root and add sealed nested previous-hub/unchanged JSON regression.","file":"hub/src/cli/remote.ts","line":48}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source1 A-13117 not clear:Standards1medium/Spec1medium. Doctor presence/fingerprint/no-network/no-spawn command lookup, local footer JSON compatibility and docs/consumer inventory inspected; C1/C2 runtime pending. Localmac touched11/22/typecheck summary not configured/Linux proof. M1 guards and M2 nested regression red/green corrections in workingtree outside this head. Push consolidated correction, restore C3 done with evidence, fresh source review before verify. No devmerge unlessCoordinator directs;QA none.

Criteria: C3 failed (Nested-directory remote status reads the wrong local config and reports default ElevenLabs instead of project command/off.).

### rev-26 · 2026-10-28T08:20:26.026Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1394-source-2
commit: 2e54df9b91f0a59d2c39bc4271201c42132aa94b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full successor source A-13121 clearsM1/M2 at2e54df9b9/treeda8a06c8,Standards0/Spec0. Owning frozenDOCTOR/REMOTE rows migrated; footer resolves discovery.root??projectRoot(cwd); sealed nested command/off previous-hub/identicalJSON regression retained with literal data-use case. A-13119 actual guard/nested red→green; localmac remote-cli23/23/typecheck, earlier unchanged doctor11/11 targeted only. C1–C3 done/runtime-unverified. One mode-free configured run at frozenhead, original-record final review; no devmerge unlessCoordinator directs. QA none/integrated separate.

### impl-1394 · 2026-10-28T08:32:19.647Z

Coordinator decision cde09378 (topic-1144): preserve doctor ok/warn/fail contract. No enabled remote => ok 'speech unused until a remote is set up'; empty provider => ok 'transcription off'; key/command checks warn only with a remote enabled. Consumer inventory for this report policy: cli/doctor check aggregation/render/JSON/exit, doctor fixture notOk and doctor.test repair assertions, doctor-remotes direct rows, doctor-cli/run/isolation/probe tests, README/help/commands.json, secrets docs, implement/onboarding guidance and file-specific test docs. Other remote/status wire consumers unchanged; no new verdict, summary or frame field. Repair tests retained unchanged; enabled-remote key/command cases and no-remote/off regression cover the policy.

### rev-26 · 2026-10-28T08:34:32.681Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1394-source-3
commit: cad60172eebfa48da62f4b1f9cfb3a5a789775e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13135: full source3 clear, Standards/Spec zero findings under Coordinator decision cde09378. Unused/off speech remains healthy via existing ok detail; provider diagnostics require an enabled remote. Repair tests unchanged. Prior A-13131 stays failed (T0/T1 complete, T2 two owned regressions, Web/T3/T4 unexecuted). C1–C3 remain runtime unverified. One fresh mode-free verify at this unchanged head, then original-record evidence review.

### rev-26 · 2026-10-28T08:51:42.691Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1394-evidence-1
commit: cad60172eebfa48da62f4b1f9cfb3a5a789775e2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13151 independently audits original A-13149/ebc8e877 at unchanged source3 head: 3844 ordinary passes plus 50 scoped load passes, zero failures/skips/cancellations/unfinished. All five task identities pass base+5/5 load; both retained doctor repair regressions pass. T0/T1/fallback all T2/Web completed; no T3/T4. Linux droplet/pinned isolated browser provenance confirmed; host typecheck reused, timing/lint report-only. Previous A-13131 remains failed. C1–C3 verified; Coordinator integrated coverage/landing separate.

Criteria: C1 verified, C2 verified, C3 verified.
