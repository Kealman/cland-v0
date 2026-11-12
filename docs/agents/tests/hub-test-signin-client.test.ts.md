# hub/test/signin-client.test.ts

T1: an in-memory EventEmitter transport exercises `startSignIn`; no socket,
native process, browser, account or provider is used. Run with supported Node:
`node --test hub/test/signin-client.test.ts`, with inherited `CLAND_*` removed
and subject to the project's targeted-run admission.

Exact case titles:

- `a close receipt for another admission is refused and never settles this run`:
  a mismatched receipt rejects the captured run with `CLAND_NATIVE_INCOMPLETE`.
- `connection loss after admission has no native close receipt`:
  connection closure remains incomplete rather than manufacturing native success.
- `malformed close {"code":null,"signal":null} stays incomplete`
- `malformed close {"code":null,"signal":""} stays incomplete`
- `malformed close {"signal":"SIGTERM"} stays incomplete`

The three generated malformed-close cases require an actual native exit fact
and valid code/signal shape; every case keeps its final rejection assertion.

- `missing capability is positively not admitted without a native request`:
  checks both the typed `CLAND_SIGNIN_UNAVAILABLE` non-admission and zero requests.

These client controls do not prove native tree closure or receipt persistence;
those belong to [the agent integration cases](hub-test-host-agent-signin-op.test.ts.md).
