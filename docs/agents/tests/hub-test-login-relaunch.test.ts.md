# hub/test/login-relaunch.test.ts

T2: `node --test hub/test/login-relaunch.test.ts`.
The generated cases `renewal <disabled|enabled|failed|interrupted> relaunches only
the signed-in host and harness after durable success` use an in-memory HubCore,
ProcessTable, fake adapters, provider and FakeClock. They assert durable login
success before relaunch, live config selection, exact resume/stop name sets,
preserved worktree/conversation/session identity, no duplicate success hook,
and untouched other harness, other host and stopped sessions. No child or browser.

C1 parser/default/init omission: `hub/test/host-pools-config.test.ts`, case
`hosts relaunch_after_signin defaults false, accepts booleans and init omits it`.
Hot apply: `hub/test/config-set.test.ts`, case `config set applies optional
template keys now with normalized parser readback`, asserting `applies: now`
for both boolean settings.

Native fake OpenCode proof remains in `hub/test/login-resignin-native.test.ts`:
`native opencode sign-in renews the mounted writer with relaunch false` and
`native opencode sign-in renews the mounted writer with relaunch true`.
Use the preservation slot and existing fixture unchanged; true checks a new PID
and the same persisted conversation, cwd and session identity before a renewed
turn writes the same volume. No real login, network, key or provider is used.
Stage QA owns the integrated dev occasion; Linux task verification supplies
T1/T2 and changed T3, merge batch supplies full T3, T4 waits for stage/epic.

The `sign-in relaunch yields to queued <stop|archive|resume> at lifecycle admission`
cases hold the competing owner at its native stop boundary, queue automatic
relaunch behind it, then check the durable resulting row and exact native call
counts. Automatic relaunch pins live/unarchived eligibility and host generation
inside the existing resume lifecycle slot before directory/native work. A newer
generation or explicit stop/archive supersedes the automatic operation.

Fixture setup registers each storage owner immediately. Writers drain before
storage; all writer joins are attempted and incomplete writers retain storage
and the root. The adverse cleanup and setup-failure cases prove this ordering.
