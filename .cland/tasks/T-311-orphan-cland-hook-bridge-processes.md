---
id: T-311
kind: task
title: "Orphan cland hook bridge processes outlive test runs: 64 bound to temporary projects since Oct 8"
state: open
status: in progress
size: S
labels:
  - needs-triage
assignee: null
parent: E-425
blocked_by: []
topic: topic-323
branch: t/T-311-orphan-cland-hook-bridge-processes
created: 2026-10-13T01:23:15.911Z
updated: 2026-10-15T20:53:56.392Z
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

## Comments

### coord · 2026-10-13T01:24:11.895Z

Evidence from the stand-in, 2026-10-13 ~01:35Z, from the human's shell. 65 'cland hook bridge' processes were checked. 64 pointed at hub.json files under temporary test projects (cland-proj-*, cland-init-cc-*, qa48.*) that no longer exist, dating Oct 8 to 11. They were sent SIGTERM from the human's shell, and all 64 ended. The one survivor, pid 21073, is bound to this project's live hub.json and stays. The item narrows to the cause. A test's launched Claude Code session leaves its bridge alive when the scratch project is removed before the session ends. The cause is either the teardown order or a bridge that does not exit when its hub file is removed. C4's existing orphans are cleared, so C4 now covers only a safe means for any future ones.

### impl-311 · 2026-10-15T20:53:56.392Z

C1 reproduction: node --test hub/test/hook-bridge.test.ts failed after 63.22s: a bridge attached to a real project hub remains alive >62s after hub.stop(), with its parent and stdout alive. Cause is hub/src/cli/hook.ts: missing discovery/rejected sockets retry every 500ms forever; stdout only observes errors on a write, and a child first scheduled after reparenting captures PID 1 as its baseline. The old cland-init-cc test launches two fake Claude sessions (hub/test/init.test.ts) and relied on scratch-fixture cleanup; T-278 now captures and kills registered groups. The bridge itself still lacks the daemon-lifetime bound, independently reproduced here. Implementing the epic's 60-second grace, runner proof and safe doctor sweep.
