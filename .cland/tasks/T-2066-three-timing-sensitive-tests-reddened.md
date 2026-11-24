---
id: T-2066
kind: task
title: "Three timing-sensitive tests reddened the E-1888 epic and stage covers under load: soak coverage-map timestamp, hosts-view boot wait, and a claude-code-remote hook process outliving its file"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-24T00:28:28.732Z
updated: 2026-11-24T00:28:56.022Z
---

## Summary

At dev 05519f77e (2026-11-23/24), three consecutive full covers each failed one test, with every other test passing. Each test passes in other runs and on its own:
1. `hub/test/suite-soak-component.test.ts › green nightly publishes a coverage map that selects task tests`. macOS epic cover 70909049 (A-22706) failed at line 211 with `pointer.created` 12:00:02.000Z against `f.clock.now()` 12:00:02.025Z: the fake clock ticks once more between publication and assertion under load. It passes 5/5 on its own. The assertion dates from 2026-10-24.
2. `web/test/hosts-view.test.ts › Hosts Add moves the real inbox login wait through booting to placed`. Linux stage cover 92a041c8 (A-22707, shard 1, fsync 25 ms) failed with a `locator.waitFor` timeout at 6000 ms waiting for "waiting for host waiting-host to boot". The wait is fixed and doesn't scale with load. The test passed in 77af614d, 6a592423, 37b7f4fd and 4e4ae4e1.
3. `hub/test/claude-code-remote.test.ts › T-1730 C2 upgraded runtime launches Claude with connected mod bridge`. macOS epic cover 42213931 (A-22710) failed with `SSH fixture cleanup incomplete`: a `cland hook mod-turn-start` process, reparented to PID 1, outlived the file.

## What to build

For each, make the test deterministic under load:
- Case 1: assert the publication timestamp the producer recorded, not the clock at assertion time.
- Case 2: use the shared load-scaled browser wait, not a fixed 6 s.
- Case 3: join or reap the hook child through the fixture's owned process census before cleanup asserts, or find why the hook survives.

Keep every behavioural assertion. These may be split into three S items if their owners differ.

## Acceptance criteria

- [ ] C1. Each of the three cases passes 5/5 under an added CPU load of about 7 on macOS, and on Linux in a mode-free verify (evidence).
- [ ] C2. Case 2 uses a load-scaled browser wait, case 1 asserts the producer's recorded time, and case 3 has a cleanup control showing no hook process outlives the file (test).
