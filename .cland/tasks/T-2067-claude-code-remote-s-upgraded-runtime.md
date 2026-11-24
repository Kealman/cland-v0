---
id: T-2067
kind: task
title: claude-code-remote's upgraded-runtime case lets a fire-and-forget `cland hook mod-turn-start` child outlive the file; the shared SSH/fake-Claude fixtures lack a close receipt separate from directory disposal
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: null
branch: null
created: 2026-11-24T00:46:47.955Z
updated: 2026-11-24T09:01:13.832Z
---

## Summary

Split from T-2066 (2026-11-24). macOS epic cover 42213931 (A-22710) failed `hub/test/claude-code-remote.test.ts › T-1730 C2 upgraded runtime launches Claude with connected mod bridge` with `SSH fixture cleanup incomplete`. A `cland hook mod-turn-start` process, reparented to PID 1, outlived the file. `mod-turn-start` is deliberately fire-and-forget, and this case waits only for `session.measure` to finish, not for the hook to close; other cases use `joinInitialHookWriters`. impl-2066 reproduced it deterministically with a filesystem-gated hook (PID 11734 live at the census). The reviewer then found that a correct fix needs whole-case ownership. That means the shared SSH and fake-Claude fixtures need a resource-close receipt separate from directory disposal, registered before native acquisition and retryable on a failed close, with disposal only after the outer required-close fence. The fixtures have about 50 direct test consumers, plus helper and transitive ones (two nvim files, and the crew-launch and hook-bridge scenarios).

## What to build

An opt-in lifecycle adapter in the shared fixtures, with default behaviour unchanged, plus an adapter-level rejection and repair control. Then use it in the upgraded case with the hook join. Run every consumer file natively.

## Acceptance criteria

- [ ] C1. The upgraded case joins its hook writers under a whole-case owner whose required-close fence covers every SSH and fake-Claude resource, and a deterministic held-hook control is red before and green after (test).
- [ ] C2. Every existing consumer of the shared fixtures passes unchanged (evidence).

## Comments

### coord · 2026-11-24T00:47:18.619Z

Consumer inventory from impl-2066 (2026-11-24): SSH fixture importers, fakeClaude callers, the merge-support and stage-qa helpers, the crew-launch and hook-bridge scenarios, nvim layers and sessions-lifecycle, QA briefs, and the per-file guides. T-2066 changed none of the shared fixtures.
