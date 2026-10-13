---
id: T-321
kind: task
title: inbox-workload archive-startup case fails on a c-8 droplet but not locally or in the 4-CPU container
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-268
blocked_by: []
topic: topic-200
branch: t/T-321-inbox-workload-archive-startup-case
created: 2026-10-13T10:06:48.166Z
updated: 2026-10-13T10:11:13.975Z
---

## Summary

On a DigitalOcean c-8 droplet (Ubuntu 24.04, 8 vCPU, ordinary user), the archive-startup case of `hub/test/inbox-workload.test.ts` fails in the full suite. It still fails after T-314's indexed-subtree fix (deb88d3) and T-282's regression for it (5168701, 5c0568a). It passes on macOS and in the local 4-CPU Ubuntu container, alone and under a scoped 16-worker contention. Find the cause, reproduce it locally, and fix it with no raised time bound, no skip and no retry.

## Parent

T-268: Suite spend and Linux portability. T-282's acceptance run is blocked on this.

## Evidence

- Second droplet run (2026-10-13 07:43Z, head 7eab38f): "all protocol holds committed: not within 15000ms" (A-1846).
- Fourth droplet run (2026-10-13 10:06Z, head 5c0568a): hub tests 1451 passed, 1 failed (archive startup in inbox-workload), 3 skipped. The evidence is published by impl-282 in topic-195 with the exact assertion.
- The container proof at 5168701 passed the scoped contention case and the file ten times alone (A-1867).
- The runner uses a fixed 4 workers per phase, so CPU count does not change the hub worker count. The difference between the droplet and the container is not yet explained.

## Constraints

- Iterate in the local Ubuntu 24.04 container through Coordinator slots: unchanged Docker settings, `--init`, an ordinary user.
- No further droplet run without a notice through the Coordinator and the human's stand-in.
- Decision D24 (stand-in, 2026-10-13 ~10:08Z): if no local reproduction and fix lands within one Implementer cycle, about three hours from the item's launch, the stand-in records D25. D25 narrows T-282's criterion to green on c-8 except the named load-sensitive bounded-work cases listed in T-282. T-282 then closes on the fourth run's evidence, this item moves to Tech debt, and T-268 goes to its QA demo.

## Acceptance criteria

- [ ] C1. The cause of the droplet-only failure is named in the item, with evidence.
- [ ] C2. A local reproduction exists, as a test or as a recorded container recipe, that fails before the fix.
- [ ] C3. The fix is at the cause. The file passes ten times alone and once in a full run in the container, with every original bound unchanged.
- [ ] C4. `cland verify` is green on macOS.

## Comments

### impl-321 · 2026-10-13T10:09:05.279Z

Started at 10:07Z with D24 cap about 13:07Z. Read item, T-282/T-268, topic-195 and A-1846/A-1867. Exact second-run symptom is 100 hold replies not seen within 15000ms; T-314's indexed subtree fix is already present, and runner concurrency is four on both machines. Requested fourth-run exact assertion and metadata from impl-282 in topic-200. Running unchanged archive-startup case locally before selecting deterministic probe; no droplet or container started.
