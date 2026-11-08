# hub/test/waiting-launch-restart.test.ts

T2 uses `projectHub` stopped and started on one disposable root, provided fake
Hosts and in-process fake harnesses. No real cloud or browser is involved.

Cases: original reason/since in session list and inbox; cancellation and name
reuse; removed custom role and removed pool with one Coordinator Agents notice
across two restarts; restored placement on a committed ready provision, pinned
pool despite changed role defaults, exactly one spawn and no restored placed
wait; revoked admitted actor grant after restart. Setup uses real time consistently and bounded `eventually` observations.
The positive process-row publication, rather than the launch reply, proves placement.
Run `node --test hub/test/waiting-launch-restart.test.ts` on supported Node.


Review regressions cover silent restoration across repeated restarts, rollback
when Coordinator notice retention returns no receipt, a new human username,
changed inferred role, retained typed memory reason until an actual host memory
report, and different-name idle reuse. Reuse reads the durable wait at the
session-reused publication event before the queue finalizer, then restarts and
asserts no replay. Observer cleanup is registered before fixture UI/store
resources, cancels every armed poll and joins it before those resources close.
