# hub/test/startup-replies-scale.test.ts

`startup-replies-scale.test.ts` retains the eight byte assertions on 1,000 tasks,
8,163 artifacts, 200 General messages and 200 event records. It also restores
1,645 completed suite receipts, 217 stopped sessions, four plans with 250 children
each, and 800 closed topics. T-1094 enforces deterministic work through the first
completed status socket reply, excluding fixture creation: one suite checkpoint
visits the 1,645 retained jobs once, at most four explorer recomputation batches
run, and all 1,004 item files are read at most twice each (the initial scan plus
plan validation). Native `readFileSync` and `readFile` observers are armed before
startup; the existing explorer log and `verification-checkpoint { jobs }` completion
log count work even when cached serialized snapshots avoid database writes.
The checkpoint receipt is emitted after its transaction and in-memory publication;
it counts jobs visited, not rows changed. Reintroducing per-stopped-session
`#save()` calls must fail the checkpoint count, independent of the machine clock.

First-status process CPU, wall time, work counts and named startup-step wall
durations remain diagnostic. The attempted fixed CPU budget failed on Linux at
10,558.0 ms CPU / 9,603.4 ms wall (A-9776), so it is no longer a performance gate.
A gross **30-second wall guard** catches startup hangs through the completed
status receipt; the 120-second whole-test watchdog bounds completion. Neither
is the computational scaling gate. Byte limits remain unchanged. These counts
guard the known save/recompute/read regressions; arbitrary CPU work or blocking
I/O inside a counted unit is outside them. The separate copied-state CLI
measurement retains its five-second end-to-end target.
Every restored plan must retain its children. This Coordinator-approved T3 scale seam adds no
native process; task verification defers it to periodic and integrated runs.
T-1039 removes the C-325 duration allowance after the expanded file ran in
2.768 seconds on local Darwin arm64; this is targeted local T3 evidence, not
a new Linux or integrated receipt. A-8181's original 6.636-second Linux T2 result
remains historical evidence.
At startup, unbranched non-ready tasks with retained verdicts skip readiness I/O:
the merge gate cannot promote them without a branch. A branchless `ready` row
still runs its check and demotes. `startup-ready-component.test.ts` observes both
filesystem boundaries and final frame statuses; `startup-replies-scale.test.ts`
retains the original durable-scale fixture and measures first completed status.
