# hub/test/orphan-servers-perf.test.ts

Run `node --test hub/test/orphan-servers-perf.test.ts` for the two T4 cases.
The socket-startup measurement requires a quiet machine. Both cases use owned
disposable projects and native fake OpenCode processes; no real harness account
or platform is involved.

The shared-deadline case first sends SIGSTOP to its own server and observes the
OS stopped state. It then freezes Date during discovery and advances it to the
shared deadline immediately after forwarding the sweep's actual SIGTERM. The
server stays stopped through that deadline, independent of handler installation
or scheduling speed. Only Date and the OS signal boundary are controlled;
inspection and termination still use native processes. Real timers keep running.
The sweep must reject, and after a real 1.3-second negative observation window
the signal trace must contain only TERM and the server must still be alive.
The finally block restores both boundaries and resumes the server before owned
fixture cleanup. The separate 30-second test bound includes setup and teardown;
it is not a sweep-latency claim.

For T-1435's macOS stress evidence, obtain the Coordinator's exclusive stress
slot first. Run ten fresh instances of only `the shared sweep deadline` in two
concurrent workers (five waves), alongside one bounded CPU burner. All launchers
must use the shared sealed fixture environment and scratch roots; preserve only
the admission/session controls required by `runnerFixtureEnvironment`. Join every
worker and the burner before releasing the slot. Record each native exit and
case result, platform, exact tree and elapsed time. A slot refusal is not a test
failure and must not be retried until its availability notice.
