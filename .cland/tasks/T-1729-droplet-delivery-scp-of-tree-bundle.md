---
id: T-1729
kind: task
title: "Droplet delivery: scp of tree.bundle fails with exit 1 and only the known-hosts warning on stderr (2 of 3 runs on snapshot cland-v0-35e1dc609f89)"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-06T19:37:35.448Z
updated: 2026-11-06T19:37:35.448Z
---

## Summary

Since the executor snapshot cland-v0-35e1dc609f89 (image 253339653, prepared 2026-11-06 18:48Z after T-1709), two of the first three droplet deliveries failed at `delivery upload tree.bundle` with `machine copy failed or exceeded its time bound (exit 1)`. The only stderr is `Warning: Permanently added '<ip>' (ED25519) to the list of known hosts.` No test ran on those machines. Earlier copy failures in the hub log (2026-10-28, 11-02, 11-03) were ssh connection timeouts with exit 255; these are exit 1 with no scp error text.

## Occurrences

- Periodic dev T3 d22186e2 at e19c3496, droplet cland-v0-592657b4 c-8 sfo2, 19:17Z (A-17189): not run, infrastructure.
- Stage cover 255a9c8b shard-2 at e19c3496, droplet cland-v0-a5917b0e, 19:36Z (A-17192). Shard-1 on cland-v0-6fe8a260 delivered and ran 4098 tests green. The new droplets report kernel 6.8.0-147 (the old image was 6.8.0-142).

## What to build

1. Make the copy failure say what scp said. `failure('copy', …)` in `hub/src/executor/droplet/machine.ts` keeps stderr, so find why scp's own error is missing: is it the remote side, `-q`, or a killed process reported as exit 1? Report signal or timeout distinctly from a scp exit.
2. Reproduce against a droplet from the current snapshot (hub-owned; through `cland verify` runs or a test with the scripted machine) and name the cause: remote path or permissions under `/home/runner/runs/<run>`, first-boot I/O on a freshly transferred snapshot, sshd state after the hook's package installs, or the copy bound.
3. Fix the cause. A blind retry of the upload is acceptable only once the cause is shown to be transient, and it must be bounded and reported.

## Acceptance criteria

- [ ] C1. A copy failure's message distinguishes a scp exit code with scp's stderr, a signal, and the time bound (test).
- [ ] C2. The cause of the exit-1 uploads is named with evidence from a real droplet run on the current snapshot, and the fix or bounded retry is in place (evidence).
- [ ] C3. Five consecutive droplet runs deliver `tree.bundle` with no infrastructure not-run (evidence).
