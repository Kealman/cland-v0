---
id: T-1980
kind: task
title: claude-code-remote.test.ts:330 scans the fake host's run directory while processes.json is atomically replaced, and fails with ENOENT on the temporary file
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
  - flaky
assignee: null
parent: E-1881
blocked_by: []
topic: null
branch: null
created: 2026-11-18T15:22:04.049Z
updated: 2026-11-18T15:22:04.049Z
---

## Summary

Merge batch e69dcee6 (T-1634 and T-1973; Linux droplet c-8 sfo2, integrated head 44f9ed43e, A-21305) failed in T3 on `hub/test/claude-code-remote.test.ts:313`, "hub restart after tree closure re-adopts its durable generation and releases the job", with `Error: ENOENT: no such file or directory, open '…/home/.cland-host/run/processes.json.new-17812-…'` from the test's own recursive `scan` helper (line 330). The scan lists the fake host's run directory, then reads each entry, while the host writes `processes.json` through a temporary `processes.json.new-*` file and an atomic rename. An entry listed by `readdir` can be gone by the time it's read. That's a race in the test helper, not in either batch member: neither diff touches the file or its subject.

## What to build

Make the scan tolerate entries that disappear between listing and reading. Skip a temporary `*.new-*` writer file, or treat ENOENT on an entry the listing just returned as "gone". Or wait for the host's write receipt before scanning. Keep every assertion about the re-adopted generation and the released job unchanged.

## Acceptance criteria

- [ ] C1. With a writer held mid-rename (a deterministic seam, not a timing loop), the scan completes and the test's assertions still hold (test, red before).
- [ ] C2. The file passes 20/20 under a load gate at 10 (native slot), with assertions unchanged (evidence).
