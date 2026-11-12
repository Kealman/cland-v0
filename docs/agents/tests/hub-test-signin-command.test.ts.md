# hub/test/signin-command.test.ts

T1: pure command planning, with no filesystem, harness execution, socket,
browser, provider or credential. Run with supported Node:
`node --test hub/test/signin-command.test.ts`, with inherited `CLAND_*` removed
and subject to the project's targeted-run admission.

- `sign-in planners use only public harness arguments and mounted paths`:
  exact-deep-equals the Codex device-auth command/environment and OpenCode
  command/database path, then rejects a path outside `/cland/auth/`.

This proves the planned public arguments and path grammar, not a native sign-in
or live harness authentication. The terminal and agent share this planner.
