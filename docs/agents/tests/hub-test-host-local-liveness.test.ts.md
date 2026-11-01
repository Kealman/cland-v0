# hub/test/host-local-liveness.test.ts

The T3 native boundary case observes only the test process with signal 0. A
positive-controlled native spawn guard proves that a bare-PID local Host.alive
request performs no identity subprocess work; the null-PID result is also
checked. The disposable tempProject and fixtureEnvironment supply isolated
HOME, XDG, Git and provider settings, although no native child runs.

The reusable Host contract retains the native identity-bearing mismatch,
legacy timestamp, absent PID and stop assertions. Do not replace those checks
with bare-PID liveness, which grants no signalling authority. Preserve the
unedited lead-routing-process.test.ts native death/event regression.
