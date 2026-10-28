---
id: T-1383
kind: task
title: "The speech seam: transcribe with nine failure kinds, retries within one 90-second deadline, and the ElevenLabs provider against a fake"
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: topic-1127
branch: t/T-1383-the-speech-seam-transcribe-with-nine
created: 2026-10-27T23:37:27.091Z
updated: 2026-10-28T00:16:07.759Z
---

## Summary

A messenger-neutral speech module defines `transcribe({ audio, mime, filename, languageHint?, durationSec?, signal })`, returning `{ text, language?, durationSec?, segments? }`, and a `SpeechError` carrying one of the nine kinds. It wraps any provider in one deadline with at most two retries for transient kinds. Its first provider is ElevenLabs Scribe v2, tested only against a loopback fake.

## What to build

**The seam.**
- `SpeechProvider { name, transcribe }`.
- `SpeechError { kind, message, retryAfterMs? }` with exactly the kinds not-configured, auth, bad-audio, too-long, quota, rate-limited, unavailable, timeout and command-failed.
- A language normaliser that lower-cases the value, keeps the primary subtag and maps ISO 639-3 codes and English names to ISO 639-1 (`eng`, `english` and `en` become `en`).
- `transcribeNote(provider, input, { deadlineMs: 90_000, clock, random })`:
  - one deadline signal for the note;
  - each attempt bounded at 30 seconds inside it;
  - retries only for rate-limited, unavailable and timed-out attempts, at most two;
  - exponential backoff with jitter, or `Retry-After` when present, never past the deadline;
  - a deadline reached reports `timeout`.
- Every error message passes the remote redactor, with the speech keys registered.

**ElevenLabs.**
- `POST <root>/v1/speech-to-text` with the `xi-api-key` header and `redirect: 'error'`.
- Multipart fields `model_id` (from `[speech] model`), `tag_audio_events=false`, `language_code` only with a hint, and `file` as the original bytes with their MIME type and file name. No transcoding.
- Status and error-code mapping per the research's table:
  - 401 and 403 are auth; 402 and `insufficient_credits` are quota; 429 is rate-limited;
  - `audio_too_long`, `request_too_large` and 413 are too-long;
  - `invalid_audio`, `invalid_audio_format`, `invalid_file_type` and `audio_too_short` are bad-audio;
  - 5xx, a transport failure and a refused redirect are unavailable.
- A missing key is not-configured, and no request is made.
- The root is `https://api.elevenlabs.io`, or `CLAND_ELEVENLABS_API_ROOT` only when it is loopback HTTP with a port.

**The fake**, in `hub/test/fakes/speech/`: it scripts per-request responses (status, `detail` body, `Retry-After`, delay, a 302 to another loopback server) and records the multipart fields and whether a key header arrived. It never logs the key.

Spec §3.6 (the speech seam, providers, bytes untouched); research Q-1289 §7 and its rules 1, 2, 4 and 7 to 10; the DigitalOcean client (`hub/src/executor/droplet/api.ts`) as the precedent.

## Acceptance criteria

- [x] C1. An OGG note transcribes through the fake ElevenLabs into `{ text, language: "ru" }` from a `"rus"` response, and the fake recorded `model_id=scribe_v2`, `tag_audio_events=false`, no `language_code` without a hint, and the original bytes with `audio/ogg` and `voice.ogg` (test).
  - done: impl-1383 · 2026-10-27T23:42:34.823Z
- [x] C2. Against the fake, a missing key, 401, `invalid_audio`, `audio_too_long`, 402, persistent 429, persistent 503 and a response slower than the deadline each reject with not-configured, auth, bad-audio, too-long, quota, rate-limited, unavailable and timeout respectively (test).
  - done: impl-1383 · 2026-10-27T23:49:38.164Z
- [x] C3. A 429 with `Retry-After: 2` followed by a 200 transcribes after a 2-second wait under the injected clock, a third consecutive 503 is not retried, and auth, bad-audio, too-long and quota are never retried (test).
  - done: impl-1383 · 2026-10-27T23:49:38.278Z
- [x] C4. A 302 from the fake is not followed and the redirect target receives no request, and no `SpeechError` message from any kind contains the made-up key, even when the fake echoes it in its error body (test).
  - done: impl-1383 · 2026-10-27T23:42:35.799Z

## Notes

Shared files: hub/src/speech/ (new), hub/src/remote/redact.ts, hub/test/fakes/speech/ (new)

## Comments

### impl-1383 · 2026-10-27T23:38:33.680Z

Consumer inventory (rule 20), before implementation: rg speech/Speech/ELEVENLABS/XAI_API_KEY across hub/src, shared, shipped .agents/skills, qa, hub/test, nvim/test and web/test finds no existing speech provider/transcribe contract or wire consumer. New seam only: hub/src/speech and hub/test/speech.test.ts; T-1384 and T-1388 will consume it later. Existing shared redactor RemoteRedactor/register callable contract stays unchanged; existing consumers remote gateway, Telegram, secrets validation and tests remain unaffected. Existing config/secrets/CLI readers continue to expose settings only; this item does not activate a provider or change any frame/list/schema/permissions. Test seam: production provider + loopback fake, fake clock for deadline/retry receipts. No real credentials or platforms.

### rev-32 · 2026-10-27T23:46:16.760Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261027-1383-source
commit: eaccf984b841ac7ad5828caa848434cfd086fa33
scope: full
findings: [{"severity":"medium","text":"M1 Standards: new guide lacks the required path-derived test-file H1, so unchanged test-docs guard fails. Use # hub/test/speech.test.ts and preserve the guard/index with original red/green receipts.","file":"docs/agents/tests/hub-test-speech.test.ts.md","line":1},{"severity":"medium","text":"M2 Spec: a provider result returned after the 30-second attempt end but before overall note end is accepted if timers have not run. Retain/check the effective attempt end and cover a clock-blocked late attempt while preserving bounded retries and total deadline.","file":"hub/src/speech/index.ts","line":50},{"severity":"medium","text":"M3 Standards: paused-clock transcription/fetch work is started without a pre-registered abort/join owner; missing setup or intermediate assertion failure can abandon it in a retry sleep. Own invocation/listener setup and cleanup with independent bounds plus missing/aborted controls before closing native resources.","file":"hub/test/speech.test.ts","line":60}]
finding_counts: {"high":0,"medium":3,"low":0}

Consolidated full source audit A-12942: Standards M1 guide H1 deterministically fails unchanged test-docs guard; M3 test exchanges need pre-owned cancellation/drain and independent setup bounds, including missing/aborted setup controls. Spec M2 post-result check enforces only note end, accepting an attempt result after 30 seconds if its abort callback has not run; retain/check attempt end and add blocked-attempt regression. All medium; no additional findings in multipart bytes, mappings, redirect refusal or registered-key redaction. A-12934 is local summary only; no configured runtime proof. Worktree corrections are outside this pinned verdict. Fresh committed source review before verification; preserve original assertions and original command receipts.

Criteria: C3 failed (The wrapper accepts results past an attempt's 30-second end before the note deadline if its timer callback has not run.), C2 failed (Timeout/retry test failures do not cancel and drain their launched work; add pre-owned setup/cleanup controls before reliable failure-path proof.).

### rev-32 · 2026-10-27T23:49:30.620Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261027-1383-source2
commit: 8813562803f8035c0b90d3d39841743b502a22a8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-12951 carries A-12942 plus all five correction files. M1 path H1/unchanged docs guard fixed; M2 effective attempt end checked after completion with blocked-attempt retry regression; M3 pre-owned exchanges independently bound setup/drain, cancel and join real provider/note work before native server/handler close. Four added controls retain original assertions and the synthetic ignores-cancellation boundary. Standards 0, Spec 0. A-12947 is local macOS original-output 13/13 speech and 3/3 docs evidence, not configured/Linux proof. Fresh full lint was not claimed; run owning test lint/tier checks before submission. Restore C2/C3 claimant done marks cleared by source1; C1–C4 runtime verification remains pending same-head configured named-case receipts.

### rev-32 · 2026-10-28T00:03:31.055Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1383-evidence1
commit: 8813562803f8035c0b90d3d39841743b502a22a8
scope: evidence
findings: [{"severity":"medium","text":"E1 Evidence: configured run 78bce2b0 exited 1; actual error is 'the screen never showed events first page within 10000 ms'. T2 failed and Web did not execute, so no final passing configured receipt exists. No new speech source diagnosis or confirmed shared-defect classification.","file":"nvim/test/events.test.ts","line":33}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed evidence disposition A-12970 audits A-12965. Exact-head host T0 and Linux T1 passed; fallback T2 failed at Events view waitScreen nvim/test/events.test.ts:33, Web unexecuted, T3/T4 unselected. Ordinary 3488/3489 pass with one fail; 90 separate load passes. All 13 speech cases and 5/5 each (65) passed; maximum speech sample 0.134228648 s. Ordinary speech native file finish is 0.479921799 s; printed 0.256 s is observed case-duration aggregate. None of this makes the configured run green. C1–C4 remain runtime-unverified; no criterion failed solely for this run failure. Source2 remains the source audit. Await Coordinator disposition before retry/shared fix; changed head requires source review. No final clear or ready claim.
