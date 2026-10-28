---
id: T-1395
kind: task
title: The documentation describes photos, files and voice from Telegram, and the composer's attachments
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1386
  - T-1387
  - T-1389
  - T-1390
  - T-1391
  - T-1394
topic: topic-1162
branch: t/T-1395-the-documentation-describes-photos-files
created: 2026-10-27T23:37:29.571Z
updated: 2026-10-28T20:43:58.590Z
---

## Summary

The remote-control page gains a "Photos, files and voice" section, and the web page names the composer's attachments and inline images. The page states the limits, the 🎤 message and echo, the providers with `provider = ""`, the `command` contract, and the data-use line. Both pages pass the site's docs tests.

## What to build

The section covers:
- inbound photos, documents and albums;
- the 20 MB and `max_upload_mb` limits;
- outbound photos, documents and the line for larger files;
- what is transcribed;
- the 🎤 message, the "not transcribed" cases and the echo;
- a voice reply to a card;
- `[speech]` with `elevenlabs`, `command` (argv, stdin, the two environment variables, no secrets) and `""`;
- doctor's speech lines and the data-use line, copied from `SPEECH_DATA_USE`.

Setup's offer of the key stays with T-1369. The site's remote-docs test gains checks that the commands and keys named exist. Spec §3.6; §4 (documentation pages).

## Acceptance criteria

- [x] C1. The remote-control page names `max_upload_mb`, `[speech] provider`, `command`, `CLAND_SPEECH_MIME`, `CLAND_SPEECH_LANGUAGE` and the data-use line identical to `SPEECH_DATA_USE`, and the site's docs tests pass (test).
  - done: impl-1395 · 2026-10-28T20:43:34.533Z
- [x] C2. The web page names file attachments in the composer and inline PNG, JPEG, GIF and WebP, and its existing docs checks pass (test).
  - done: impl-1395 · 2026-10-28T20:31:32.714Z

## Notes

Shared files: site/src/content/docs/docs/remote-control.md, site/src/content/docs/docs/web-and-phone.mdx, site/test/remote-docs.test.ts

## Comments

### impl-1395 · 2026-10-28T20:29:59.973Z

Scope: docs-only, no shared runtime contract changes. Confirmed seam: site source guards in site/test/remote-docs.test.ts against shipped CLI help, generated config, speech command env declarations and SPEECH_DATA_USE (no platform calls). C1 then C2 red/green. No implement skill entries or duration allowances for site tests per Coordinator.

### rev-26 · 2026-10-28T20:36:08.689Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1395-source-1
commit: 8cccae9f6e13f1cf55ad8b579206ff9c3c64ed0f
scope: full
findings: [{"severity":"medium","text":"M1: Audio/video notes are transcribed only with a present reported duration <= speech.max_seconds; longer or unmeasured ones follow ordinary upload without transcription. Distinguish this from over-limit voice notes, which are refused before download and not stored. The current paragraph overstates what is transcribed.","file":"site/src/content/docs/docs/remote-control.md","line":82}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source audit complete; sole finding M1. A-13458 records Standards/Spec, checked authoritative boundaries and evidence limits. A-13454 local narrative retained; no reviewer workload or fresh runtime marks. Correct M1 and request fresh exact-head source review before verification.

### rev-26 · 2026-10-28T20:37:33.844Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1395-source-2
commit: 91f1f25319962332a7f861366f2b7e90964c10de
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13461 source2 clear; sole prose correction resolves M1 duration admission/storage outcomes and matches media.ts/telegram.ts. All remaining task files/guards unchanged from completed source1 audit. Full three-file scope covered, no findings or reviewer workloads. Local seven-case report retained separately; configured runtime and C1/C2 fresh verification pending. One mode-free run at unchanged head may proceed; final review uses original records.

### impl-1395 · 2026-10-28T20:42:52.447Z

Consumer audit after failed 3a159b3a: rg configNames/secretNames plus remote-docs imports across site/, hub/test/, docs/agents/tests/ identifies site/test/remote-docs.test.ts producer/self-guard, hub/test/remote-docs.test.ts sole importing equality consumer, docs/agents/tests/hub-test-remote-docs.test.ts.md guide, tier/duration metadata entries. No production/wire consumers. Failure actual adds speech.provider/model/language/max_seconds/command and artifacts.retention_days/max_upload_mb; expected only four remote keys. Reproduced exact red with node --test hub/test/remote-docs.test.ts locally macOS (7 pass/1 fail). Migrate expected filter preserving independent configKeys equality, update guide; no wire changes.

### rev-26 · 2026-10-28T20:43:13.715Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261028-1395-evidence-1
commit: 91f1f25319962332a7f861366f2b7e90964c10de
scope: evidence
findings: [{"severity":"medium","text":"M2: site exported configNames now includes speech/artifacts but the importing runtime equality guard still filters configKeys to remote-only. Original A-13462 fails on exactly those seven additional names. Migrate owning expected namespaces while preserving equality and negative controls; retain complete consumer red/green and request fresh source review before resubmission.","file":"hub/test/remote-docs.test.ts","line":9}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13463 original-record evidence1 not clear. T0 green/T1 red;1137 ordinary passes1fail plus35 separate load passes; all7sitecases green. T2/T3/T4/Web unexecuted. Item-owned consumer omission missed by prior source audit; no shared defect or retry exception. M1 prose stays corrected. No reviewer workload or fresh verified marks.

Criteria: C1 failed (Configured T1 docs contract fails: site vocabulary extraction matches runtime config and secret names; exported namespace expansion left the importing equality guard unmigrated (A-13462).).

### rev-26 · 2026-10-28T20:43:58.590Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1395-source-3
commit: da715f5a9dc319b24d782e3d758ee05a39c74e78
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13464 source3 clear, M2 resolved with complete independent runtime equality over remote/speech/artifacts; sorted copy preserves duplicates and does not mutate export. Exact-head importing consumer audit confirms sole wrapper, guide updated, prior pages/guards unchanged. Local wrapper8/8 report separate; A-13462 retained failed. Current runtime C1 failure awaits successful original configured evidence, no fresh verification or reviewer workload. Restore claimant done as needed and submit mode-free at unchanged head.
