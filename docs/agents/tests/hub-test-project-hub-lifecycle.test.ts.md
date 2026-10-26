# hub/test/project-hub-lifecycle.test.ts

T3 checks native CLI/spoke/socket integration and the resource tracker's positive
timer-leak controls through sealed child test runners. The retained-interval case
requires the child to exit 1 with both `projectHub leaked resources` and `Timeout`.
Its deliberate first-clear retention remains unchanged: the production daemon
stops the config/role owner once, before closing edges and storage. Repeated
disposal of that same timer can erase the planted leak and invalidate the control.

The direct-dispatcher request case separately plants a live interval during a
response and requires the same child failure. Keep both controls and the native
child completion receipts; scratch cleanup follows each child's exit/output.
