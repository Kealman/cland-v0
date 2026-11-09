# Fake harness login contract

T-1774 supplies test-only login behavior in the existing Claude Code, Codex and
OpenCode fake binaries. Set `FAKE_LOGIN_ENABLED=1` or `FAKE_LOGIN_HOME` explicitly.
Neither file presence nor the legacy setup-profile `fake-login.json` activates it.
No real harness, provider account or external login endpoint is used.

`login.json` lives in `FAKE_LOGIN_HOME`, otherwise `CLAUDE_CONFIG_DIR`, `CODEX_HOME`,
or the directory containing `OPENCODE_DB`. Default harness paths under the sealed
HOME/XDG roots apply when those variables are absent. For explicit OpenCode DB
paths use the shared `scratchAccountEnvironment` after `fixtureEnvironment`.

The JSON shape is:

```json
{
  "name": "fake-login",
  "token": "random synthetic UUID",
  "generation": 0,
  "signIn": { "at": "ISO timestamp", "host": "host-a" },
  "lastRotation": null,
  "dead": false,
  "turns": []
}
```

`FAKE_LOGIN_NAME` supplies the name and `FAKE_LOGIN_HOST` the host; absent a host
override, the OS hostname is used. Time is real throughout these fixtures.
Successful turns replace the token, increment generation, set `lastRotation`
to `{at, host}` and append `{host, session, generation}`, retaining the last 20.
Writes replace the file atomically with mode 0600. These fixtures model one
writer per login home; they do not arbitrate concurrent owners.

`claude auth login` prints an example.test link and consumes a nonempty pasted
code from stdin; empty EOF refuses without writing a login. `codex login --device-auth` prints an example.test link and
device code; a live existing login refuses without changing the file.
`opencode auth login` (also with `--standalone`) signs in immediately.
Each successful sign-in resets generation, history and dead state.

A missing login, `DEAD-LOGIN` turn, or subsequent turn with a dead login returns:

- Claude: `StopFailure`, `authentication_failed`, `OAuth token revoked`.
- Codex: `refresh_token_reused`, `codexErrorInfo: unauthorized`.
- OpenCode: `provider.auth` in the execution failure.

The native background/session handlers and headless fake CLI turns share the
rotation helper. Headless fixture forms are `claude -p TEXT --session-id ID`,
`codex exec TEXT --session ID`, and `opencode run TEXT --session ID`.
These lightweight forms exist only in the fake binaries.

CLI logout and `/logout` inputs are recorded as JSON lines in
`FAKE_HARNESS_CALL_LOG`; logout marks the login dead. Never place pasted codes
or tokens in arguments. `FAKE_LOGIN_HOLDER=1` leaves a detached child with its
cwd in the login home and `login-holder.open` open. `login-holder.json` records its pid,
cwd, file and open-file inode after opening it, before sign-in returns.
Repeated sign-ins reuse only a live private-socket challenge response with a current open-file inode. A stale receipt never suppresses launch or authorizes a PID signal. The holder owns shutdown through `stopLoginHolder(home)` in `login-holder-client.ts`; register cleanup before sign-in, independently of reading the receipt. The holder exits if its CLI disconnects before the IPC ownership commit. After commit, the private socket owns its lifetime. `holderRequest(home, status)` proves liveness; the test-only `crash` command lets the holder kill itself to leave stale metadata. Fixtures observe OS exit before removing storage; these tests leave disposable roots in place.

Downstream stage QA can cite this schema and the case guide below. It does not
represent coverage of real provider or harness authentication.
