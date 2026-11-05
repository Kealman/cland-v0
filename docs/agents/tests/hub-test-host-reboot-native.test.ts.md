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
no run root is removed while that writer remains. The C-216 per-test allowance is 24 seconds, expiring 2026-11-11, from
T-1686's ten passing loaded samples on each platform: worst macOS arm64
15.472687375 seconds, with five yes burners on ten CPUs; Linux arm64 container
uses two burners on four CPUs. The allowance is ceil(1.5 times the worst sample),
with all samples recorded in durations.json. The test timeout remains 60 seconds.
Times include native setup, assertions and joined cleanup; no browser is used.

The original fixture final empty-writer assertion is unchanged. A two-second
cleanup timeout reports surviving native PID, birth, group and native start
receipt before failing; root removal still waits for the fixture's own empty census.
