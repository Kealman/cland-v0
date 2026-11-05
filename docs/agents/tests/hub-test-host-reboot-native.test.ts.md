# hub/test/host-reboot-native.test.ts

T3 uses two authenticated fake SSH hosts with production supervisors and standalone
agents. The three adapter flavours own small native workers; this file does not
claim native Claude/Codex/OpenCode SDK coverage. The unedited preservation files
supply those contracts. Worker readiness files arm setup before reboot; persisted
process rows are the exit receipt. Replacement hello must carry a different boot
and native PID, and the supervisor PID must change. Other-host rows stay running,
roles use the existing harness-exit release reason, and no adapter stop or local
Host operation is permitted. Fixture reboot termination is separate from hub
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
no run root is removed while that writer remains. The C-216 per-test allowance
is 12 seconds, directed by the Coordinator from a clean macOS local early sample
of 4.578853292 seconds and T-1666's observed Linux/macOS ratio (14.3/8.9, about
1.6), then 1.5 times the projected Linux time with headroom. The Linux figure
is a projection, not an observed T-1613 time. Failed/overlapped samples are excluded; reviewed-head
native preservation and Linux evidence remain separate receipts.

The original fixture final empty-writer assertion is unchanged. A two-second
cleanup timeout reports surviving native PID, birth, group and native start
receipt before failing; root removal still waits for the fixture's own empty census.
