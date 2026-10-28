---
id: T-1384
kind: task
title: 'The command provider and provider selection: an argv run with the bytes on stdin and no remote secret, and provider = "" turning transcription off'
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1383
topic: topic-1132
branch: t/T-1384-the-command-provider-and-provider
created: 2026-10-27T23:37:27.222Z
updated: 2026-10-28T00:26:54.060Z
---

## Summary

The second provider runs `[speech] command` as an argv array with no shell. The original bytes go on stdin, with `CLAND_SPEECH_MIME` and `CLAND_SPEECH_LANGUAGE` in an environment free of remote secrets. It reads the transcript from stdout. A factory picks `elevenlabs`, `command` or none from `[speech]` and the resolved secrets.

## What to build

**The `command` provider.**
- It spawns `argv[0]` with the remaining arguments, never through a shell.
- The environment is `withoutExecutorCredentials(process.env)`, plus `CLAND_SPEECH_MIME` and `CLAND_SPEECH_LANGUAGE` (empty to detect).
- The bytes are written to stdin, and stdout is read as UTF-8, trimmed and capped at 1 MiB.
- A non-zero exit or a signal is `command-failed`, with the tail of stderr (at most 2 KiB), redacted.
- An empty argv, or an `argv[0]` that cannot be found, is `not-configured`.
- At the deadline it sends SIGTERM, then SIGKILL after a short grace, and reports `timeout`.
- It is never retried.

**Selection.** `speechProvider(settings.speech, secrets)` returns:
- the ElevenLabs provider with the key from the `ELEVENLABS_API_KEY` override or `speech.elevenlabs_key`;
- the command provider;
- or `null` for `provider = ""`, which callers treat as "off", distinct from not-configured.

`resolveCommand(argv, env)` reports whether `argv[0]` resolves, as an absolute executable or on `PATH`, for doctor (ticket 14). The data-use constant (`SPEECH_DATA_USE`, one line per provider) lives here, for `cland remote status` and T-1369.

Spec §3.6 (the `command` provider, providers in 0.3, data use); research §7 "The `command` provider contract".

## Acceptance criteria

- [ ] C1. A fake command script receives the exact note bytes on stdin and prints a transcript that comes back as `text`, and an argument containing spaces and `$(…)` reaches it literally (test).
- [ ] C2. With made-up `CLAND_TELEGRAM_TOKEN`, `ELEVENLABS_API_KEY`, `XAI_API_KEY` and `DIGITALOCEAN_TOKEN` in the hub's environment, the command's environment contains none of them and has `CLAND_SPEECH_MIME=audio/ogg` and `CLAND_SPEECH_LANGUAGE` (test).
- [ ] C3. A command exiting 3 rejects with `command-failed` and a bounded stderr tail with the made-up key redacted, a missing `argv[0]` with `not-configured`, and a command sleeping past the deadline is killed and rejects with `timeout` (test).
- [ ] C4. `provider = ""` selects no provider, `provider = "elevenlabs"` without a key selects one that rejects with `not-configured`, and `provider = "command"` selects the command provider (test).

## Notes

Shared files: hub/src/speech/ (new)

## Comments

### impl-1384 · 2026-10-28T00:26:54.060Z

Consumer inventory before shared speech retry-policy extension: production speech/index.ts (transcribeNote), ElevenLabsProvider, and speech/elevenlabs.ts imports; tests speech.test.ts plus fakes/speech/exchange.ts. No production transcribeNote caller yet (voice pipeline is T-1388). Search covered hub/src, hub/test, docs, qa and shipped .agents/skills, including T3/T4 guides; no wire shape changes. Config's speech shape, remote factory settings, persisted configuration readers and their config-set/init tests remain unchanged. Existing providers keep the cloud default; an optional provider retry policy will opt command out, with a legacy provider regression retained. New speechProvider factory, resolveCommand and SPEECH_DATA_USE exports are additive; later doctor/status/voice consumers use them. Tests use native subprocess seam because no hub frame invokes speech yet.
