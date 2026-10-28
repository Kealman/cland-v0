---
id: T-1394
kind: task
title: Doctor shows the speech key's presence and the command's resolution, and cland remote status shows the provider's data-use line
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by:
  - T-1384
topic: null
branch: null
created: 2026-10-27T23:37:29.292Z
updated: 2026-10-28T08:10:55.719Z
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

- [ ] C1. Doctor with a made-up ElevenLabs key in `.cland/secrets.toml` shows the speech key present with its fingerprint and never the value, without one it warns with `cland secret set speech.elevenlabs_key`, and the fake ElevenLabs receives no request in either run (test).
- [ ] C2. Doctor with `provider = "command"` shows `ok` for a command on `PATH` and a warning naming a missing `argv[0]`, and the command is never run (test).
- [ ] C3. `cland remote status` prints the ElevenLabs data-use line naming "Improve the models for everyone" and stored transcripts, and the command and off lines for the other settings (test).

## Notes

Shared files: hub/src/doctor/remotes.ts, hub/src/cli/remote.ts, hub/src/cli/usage.ts
