---
id: T-1828
kind: task
title: The provider token's presence and fingerprint from the hub's environment
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: null
branch: null
created: 2026-11-12T10:07:21.146Z
updated: 2026-11-12T18:07:57.305Z
---

## Summary

A local-only frame reports, for each host provider that a pool uses, whether its token is present in the hub's own environment, with the token's fingerprint. Nothing calls the provider. Doctor and setup read it, because the token lives in the hub's environment and not in the human's shell.

## What to build

A `host.providers` frame, or a field of `host.status` (the implementer chooses; the review checks it), answered from the running hub:
- per provider named by a configured pool: the provider, whether a token is needed, and whether it is present, with the 12-character fingerprint that `cland secret list` uses;
- `digitalocean` reads `DIGITALOCEAN_TOKEN`, as the executor does;
- the fake provider reports that no token is needed.

The value is never in a reply, a log line or the journal. The frame is for the local human CLI or Neovim only, like the other `host.*` frames.

## Acceptance criteria

- [ ] C1. With a made-up `DIGITALOCEAN_TOKEN` in the hub's environment and a `digitalocean` pool, the frame reports the token present with its 12-character fingerprint, and neither the reply nor any hub log line contains the value (test).
- [ ] C2. Without the token it reports absent, and a fake-provider pool reports that no token is needed (test).
- [ ] C3. Answering the frame makes no request to the fake DigitalOcean API (test).
- [ ] C4. The frame is refused from a session, the web and a remote (test).

## Blocked by

None (can start immediately)

## Notes

- Hot files: `hub/src/host/status.ts` or a new `hub/src/host/provider-tokens.ts`. Registration points: `hub/src/protocol.ts`, `shared/wire/index.ts`, `hub/src/hub/dispatch.ts`, `hub/src/hub/web-authority.ts`.
- Tests: new `hub/test/host-provider-tokens.test.ts` (T2, `projectHub`, the fake DigitalOcean API with a request log).
- Serves epic C4 and C5.
