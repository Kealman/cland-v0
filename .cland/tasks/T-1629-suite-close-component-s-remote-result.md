---
id: T-1629
kind: task
title: suite-close-component's remote-result wait can time out on a loaded droplet
state: closed
status: done
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-02T06:56:22.636Z
updated: 2026-11-02T07:41:39.056Z
closed: 2026-11-02T07:41:39.056Z
---

## Summary

`hub/test/suite-close-component.test.ts` "live and restored shards separate remote execution from collection in one failed merged result" timed out once on the Linux droplet (`Error: remote result: not within 30000 ms`, `hub/test/harness.ts:902`) in T-1618's verify run 929528ac at b374864f (log A-15677), while the file passes 5/5 locally at that head and 5/5 at clean dev c14994a24 (A-15685). The harness's fixed 30 s wait for a remote result is too tight, or a step in the fixture races, under droplet load.

## What to build

Find what the remote-result wait depends on in that case (fixture shard timing, collection ordering, or the harness constant) and make the case deterministic under load: drive the waited-on step with the fixture's clock or an explicit readiness signal rather than a wall-clock bound, keeping the assertion about separating remote execution from collection unchanged.

Found during T-1618 (topic-1330, 2026-11-02 06:51Z); first and only sighting so far.

## Acceptance criteria

- [ ] C1. The named case passes 20 consecutive runs on a Linux droplet under the merge-batch worker setting, with the assertion unchanged (test).
- [ ] C2. The case no longer depends on a fixed wall-clock wait for the remote result; the wait is tied to the fixture's readiness signal or clock (test).
- [ ] C3. Every other case in `suite-close-component.test.ts` passes unchanged.

## Comments

### coord · 2026-11-02T07:41:39.056Z

Not an independent defect. The timeout reproduced only at T-1618's head (2/2 on Linux, clean dev green). The cause was T-1618's release confirmation, which did not wake pending result collection. Fixed within T-1618 at 6a51b8ef, with a deterministic regression (A-15729). Closed by coord, 2026-11-02 07:42Z.
