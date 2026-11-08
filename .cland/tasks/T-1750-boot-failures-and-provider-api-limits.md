---
id: T-1750
kind: task
title: Boot failures and provider API limits
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1534
blocked_by:
  - T-1746
topic: null
branch: t/T-1750-boot-failures-and-provider-api-limits
created: 2026-11-07T16:01:59.219Z
updated: 2026-11-08T18:40:43.229Z
---

## Summary

Two create-side failures, handled by the scheduler:
- **No machine or SSH within 5 minutes of the create call:** the host is destroyed, its launches keep waiting, and the Coordinator gets one line naming the host.
- **A provider refusal with a retry time** (DigitalOcean's 429 or droplet limit): creation in that pool pauses until the retry time, and the launch keeps waiting, with no cascade.

After a boot failure, the pool backs off before its next create: 1 minute, doubling to 30 minutes, reset by a host reaching `ready` or by a change to that pool's configuration.

## What to build

The failure handling around the create seam, and the backoff. The line to the Coordinator is an Agents notice addressed to `coordinator`, as `account-limited` is, one per failure, never in General. The 5 minutes stay a fixed constant. The test-only knob `CLAND_TEST_HOST_BOOT_MS` shortens the gate the pool runtime passes to the create path. It is honoured only inside the fake-host fence (`CLAND_FAKE_HOST_ROOT` set), like the executor's `CLAND_TEST_DROPLET_*` (`testTiming`).

## Acceptance criteria

- [ ] C1. A fake host that never boots is destroyed with a confirmed deletion at 5 minutes of hub-clock time, its launch stays waiting, and the Coordinator gets exactly one Agents line naming the host (test).
- [ ] C2. A fake machine whose pinned key never answers within the gate is handled the same way (test).
- [ ] C3. A provider refusal with a retry time makes no further acquire call before that time, keeps the launch waiting, and allows one create after it (test).
- [ ] C4. After a boot failure the pool's next create waits 1 minute, the wait doubles per consecutive failure up to 30 minutes, and a host reaching `ready` resets it (test).
- [ ] C5. `CLAND_TEST_HOST_BOOT_MS` shortens the gate inside the fake-host fence and is ignored without `CLAND_FAKE_HOST_ROOT` (test).

## Blocked by

- T-1746

## Notes

- Hot files: `hub/src/host/pool-runtime.ts`, `hub/src/hub/agents-topic.ts` (Coordinator line kind).
- Tests: new `hub/test/pool-failures.test.ts` (T2, fake clock, fake provider `neverBoot` and `refuseUntil`).
- Serves epic C6. Its plan lane orders it after T-1749, because both edit `pool-runtime.ts`.
