---
id: T-311
kind: task
title: "Orphan cland hook bridge processes outlive test runs: 64 bound to temporary projects since Oct 8"
state: open
status: backlog
labels:
  - needs-triage
  - tech-debt
assignee: null
parent: T-294
blocked_by: []
topic: null
branch: null
created: 2026-10-13T01:23:15.911Z
updated: 2026-10-13T01:23:15.911Z
---

## Summary

Test runs leave `cland hook bridge` processes behind. On 2026-10-13 at 01:25Z the machine held 67 of them. 64 were orphans (parent pid 1) bound to temporary test projects (`/var/folders/.../T/cland-init-cc-*`, `cland-proj-*`, `qa*`), started between Oct 8 and Oct 12. Their projects' hubs are long gone. They count against the process table that `ps`-heavy tests list, and they hold memory.

## What to find

- Which tests spawn a Claude Code fake whose bridge outlives the test's teardown. T-278's process-group teardown should cover them; check whether the bridge leaves the group, or is spawned by a hook outside it.
- Whether a bridge whose hub file names a hub that no longer answers exits on its own. It should exit after a bounded retry.
- A sweep in `cland doctor --fix` for bridges whose hub file is gone, keeping the doctor's rule of never touching an ambiguous row.

## Acceptance criteria

- [ ] C1. The cause is named: the test(s) or path that leave a bridge behind after teardown.
- [ ] C2. A bridge whose hub is gone exits within a bounded time, proved by a test on a real hub that is stopped under it.
- [ ] C3. A full suite run leaves no new `hook bridge` process behind, checked by a before/after process count in the runner or a test.
- [ ] C4. Existing orphans are cleared by a documented, safe means (doctor or the runner), never by the Coordinator killing processes by hand.
