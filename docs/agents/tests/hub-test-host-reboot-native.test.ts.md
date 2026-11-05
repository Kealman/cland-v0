# hub/test/host-reboot-native.test.ts

T3 uses two authenticated fake SSH hosts with production supervisors and standalone
agents. The three adapter flavours own small native workers; this file does not
claim native Claude/Codex/OpenCode SDK coverage. The unedited preservation files
supply those contracts. Worker readiness files arm setup before reboot; persisted
process rows are the exit receipt. Replacement hello must carry a different boot
and native PID, and the supervisor PID must change. Other-host rows stay running,
roles use the existing harness-exit release reason, and no adapter stop or local
Host operation is permitted. After row retirement the test requests
`hub.status` with `flushLogs: true` before reading the role-cleared log entries:
the process journal appends asynchronously, so row status alone is not its receipt.
Fixture reboot termination is separate from hub
stop authority. Shutdown joins hub/carriers, agents and fixture process census
before removing roots. Run under the stage's preservation lock, with immediate
exit on failed acquisition and an owner check before releasing it.

The actual separate `fake-host.ts reboot` CLI authenticates to a fixture-lifetime
`serveFakeReboots` controller, started before its workers. That older live owner
keeps the shared cleanup age/ancestry checks unchanged; wrong-token CLI requests
leave worker births and boot unchanged. The controller snapshots live cwd/birth owners inside its disposable host home,
blocks new fake SSH admission, joins captured writers, tears down the old master
using its captured authenticated owner/token, clears run, publishes a new boot id,
and reopens admission. Metadata/private files outside run remain for retirement.
Both Linux and macOS use the explicit fake boot-id file; production Linux uses
its kernel boot id. No GUI/browser or external account is involved.

Final native cleanup runs after hub/controller shutdown, joins captured fixture
owners, then waits up to two seconds for a positive empty native writer census.
This covers a supervisor's final 0.2-second sleep born between capture and kill;
no run root is removed while that writer remains. T-1686 established a 24-second C-216 allowance, expiring 2026-11-11, from
T-1686's ten passing loaded samples on each platform: worst macOS arm64
15.472687375 seconds, with five yes burners on ten CPUs; Linux arm64 container
uses two burners on four CPUs. That allowance was ceil(1.5 times the worst sample),
with all samples recorded in durations.json. The test timeout is `8 * testWaitMs() + 60000` (180 s by default).
Times include native setup, assertions and joined cleanup; no browser is used.

The original fixture final empty-writer assertion is unchanged. A two-second
cleanup timeout reports surviving native PID, birth, group and native start
receipt before failing; root removal still waits for the fixture's own empty census.

T-1691 preserves the separate reboot CLI's numeric exit, native signal and last
8192 stderr characters in a fresh error, through the shared secret/token redactor.
It does not propagate execFile's argv-bearing `Command failed` message (the suite
redacts that entire tail). The reboot controller joins its captured producers,
then observes an empty host writer census within production `LAUNCH_SETTLEMENT_MS`
before removing run or publishing the new boot. A supervisor polling child can
be born after capture and briefly survive its parent's simulated SIGKILL; no
additional signal authority is inferred. First residual and deadline diagnostics
retain PID, parent PID, comm and native birth; the final empty census assertion
and every native recovery assertion remain. A supervisor exit trap cannot reap
children after SIGKILL; actual machine reboot would terminate them too.

T-1691 measured ten macOS arm64 Node24.21.0 passing native cases at source
`28e56df4b`, fourteen yes burners on ten CPUs and per-sample one-minute load
13.109–23.25. Worst case 18.307176458 seconds gives ceil(1.5 × worst) = 28s,
owned by C-216, expiring 2026-11-11; the whole-test guard is now `8 * testWaitMs() + 60000` (180 s by default). No transient writer
was observed in these ten samples. Later review fixes only isolate diagnostic
ps and redact before bounding CLI stderr; native assertions/census are unchanged.

T-1692 uses the shared setup budget for initial agent/worker readiness.
The separate reboot CLI harness guard is `testWaitMs(20000)` (20 s fallback);
`CLAND_TEST_WAIT_MS` overrides it and the whole-test setup budget. Reboot row
retirement, replacement-agent deadlines and final cleanup bounds stay unchanged.
