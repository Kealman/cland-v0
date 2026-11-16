# hub/test/project-hub-lifecycle.test.ts

The native identity case uses `projectHub` with `lockIdentity: 'native'` while
keeping infrastructure probes fake. Its durable lock record must match an
independent native identity read under the sealed fixture environment. The
`nativeProjectHub` wrapper selects the same identity option for CLI interoperability.
The complete explicit-native case runs under the shared `fixtureWork` owner,
registered before the initial `tempProject` acquisition. It composes the shared
admitted-work owner, adopts late roots and joins late startup/resource closure
before root removal or environment restoration.

T3 checks native CLI/spoke/socket integration and the resource tracker's positive
timer-leak controls through sealed child test runners. The retained-interval case
requires the child to exit 1 with both `projectHub leaked resources` and `Timeout`.
Its deliberate first-clear retention remains unchanged: the production daemon
stops the config/role owner once, before closing edges and storage. Repeated
disposal of that same timer can erase the planted leak and invalidate the control.
The verification-wait stop releases its captured timer once: the early daemon
fence and later scheduler close must not clear that same timer twice. Keep the
original leak control unchanged when checking this stop ownership.

The direct-dispatcher request case separately plants a live interval during a
response and requires the same child failure. Keep both controls and the native
child completion receipts; scratch cleanup follows each child's exit/output.
