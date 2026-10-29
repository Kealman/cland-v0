---
id: T-1320
kind: task
title: The hub ran out of its 4 GB heap during a release dry-run's web bundle build
state: closed
status: done
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1185
branch: null
created: 2026-10-26T02:27:30.262Z
updated: 2026-10-29T21:51:50.049Z
closed: 2026-10-29T16:04:24.106Z
---

## Summary

The hub (pid 686, restart #56, default 4 GB heap, about 23.6 h up) died with "FATAL ERROR: Reached heap limit" at about 02:21Z on 2026-10-26, while serving `cland release --item R-1277 --dry-run`. The last log lines before the Mark-Compact at 4091 MB are the dry-run's web bundle build ("✓ built in 1.06s"); .cland/release-web/7f4d74d2… holds the bundle and an 82 MB source.tar. A rerun on the restarted hub (#57, 8 GB heap) passed at about 780 MB RSS, and the real release also passed.

## What to build

Find what the release preview holds in hub memory during the web bundle build (the 82 MB source tar, build output buffers, or the hub's accumulated state over a long uptime), and keep it bounded so a dry-run on a long-lived default-heap hub cannot exhaust it. Profile with the SIGUSR1 inspector recipe on a scratch hub (rule 15), never the live one.

## Acceptance criteria

- [ ] C1. A release dry-run with the web bundle on a scratch project's hub peaks within a stated heap bound, measured and recorded with the commands used, and a regression test asserts the bundle step streams rather than buffers the source tar (test).

## Comments

### impl-1320 · 2026-10-29T16:04:15.439Z

Closing diagnosis per Coordinator decision 0dff396f-7a81-4702-a520-c4d7e42a993c: NOT REPRODUCIBLE on current dev 6a24facf8497f11c8347c705da67457f8e86ce80; no production change and no claimed root-cause fix. source.tar was already disk-backed via git archive --output and tar -xf in b5930f220, before the original 2026-10-26 incident. Sealed scratch nativeProjectHub / production release dryRun frame, native Git/tar/offline npm, fake GitHub auth/publication only, SIGUSR1 inspector + HeapProfiler, on local macOS arm64 Node v24.21.0. Command: node --max-old-space-size=256 --inspect-port=0 --test --test-isolation=none hub/test/T-1320-profile.ts. Durable source.tar 86,620,160 bytes; successful planned webBundle receipt; baseline heap 36,839,648 bytes, sampled peak heap 46,062,736 bytes (43.93 MiB), peak arrayBuffers 3,105,620 bytes (2.96 MiB), peak RSS 242,712,576 bytes (231.47 MiB). Memory sampling every 5 ms covers release request through successful reply, excluding setup and child-process heaps; this does not reproduce long-uptime history or real product output. Probe 1/1 passed; existing node --test hub/test/web-release-publication.test.ts 2/2 passed locally. No Linux/full verification run or C1 completion claimed. Evidence: A-13743 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13743-t-1320-baseline-heap-diagnosis.md; runnable probe: A-13748 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13748-t-1320-sealed-sigusr1-release-heap-probe.ts (copy beside harness.ts to rerun). Coordinator will close under E-1444 C1 and check live heap/RSS before the v0.3.0 dry-run, restarting a long-lived hub if needed. If OOM recurs, capture heap snapshot and reopen with that reproduction.

### coord · 2026-10-29T16:04:24.106Z

Closed without a change: not reproducible on current dev. impl-1320's evidence (A-13743 diagnosis, A-13748 probe): a native scratch hub release dry-run with an 86,620,160-byte `source.tar` and `--max-old-space-size=256` succeeded, peaking at 43.93 MiB heap. `source.tar` was already disk-backed before the incident (b5930f220). The original OOM was a long-uptime hub on the old 4 GB heap; hubs now start at 8 GB. Mitigation: before the 0.3.0 dry-run, check the live hub's heap and RSS and restart it if long-running. Reopen with a heap snapshot if a dry-run OOMs again.
