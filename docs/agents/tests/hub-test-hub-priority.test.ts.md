# hub/test/hub-priority.test.ts

T2 exercises startup priority logging, `hub status` JSON/text and doctor JSON/text
against one in-process hub, with a fake clock and injected nice value. It asserts
that doctor recognizes the local holder and that every report reuses the startup
observation.

The CLI status command uses native lock readers, so this fixture explicitly uses
`nativeIdentityProjectHub`. Before replacing `process.env` with the sealed doctor
toolchain environment, it captures `fixtureLockIdentity(env, true)` and retains it
as `CLAND_TEST_LOCK_IDENTITY` in that environment. This reuses runner metadata
when available; standalone macOS runs explicitly read native boot identity via
sysctl. The doctor fixture's injected lock reader then uses the same identity.
Default projectHub fixtures continue to use synthetic identity without sysctl.

Without the shared identity, doctor classifies the native holder as foreign and
skips the local status path, including the priority warning. The existing warning
assertions catch that regression. All project, toolchain, HOME and Git paths are
owned by disposable fixtures; no real harness is launched.

Run on macOS with a supported Node on PATH:

```sh
node --test hub/test/hub-priority.test.ts
```

The same case runs on Linux verification executors. A local macOS receipt alone
is not Linux coverage.
