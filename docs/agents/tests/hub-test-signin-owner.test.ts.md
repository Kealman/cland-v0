# hub/test/signin-owner.test.ts

T1: an in-memory native adapter exercises the agent sign-in owner with disposable
`signin-owner-` directories for receipt checkpoints. No child, socket, browser,
real harness, provider or credential is used. The fixture registers root removal
when allocated. Run with supported Node:
`node --test hub/test/signin-owner.test.ts`, with inherited `CLAND_*` removed
and subject to the project's targeted-run admission.

Exact case titles:

- `uncertain rejection after native admission retains the operation and disk hold`:
  injected post-admission rejection leaves one active operation and disk hold;
  close reports `CLAND_NATIVE_INCOMPLETE`.
- `native completion failure reaches the peer and retains writer admission`:
  checks the exact `signin-incomplete` event and retained hold after failure.
- `settled native objects retire and only a bounded receipt cache remains`:
  40 sequential simulated native closes each return the exact admission receipt,
  leave no active object/hold, and keep at most 32 cached receipts.
- `peer shutdown joins another run receipt checkpoint after one run fails`:
  one incomplete operation cannot hide another run's checkpoint/close event;
  shutdown reports incomplete only after that join. An independent finally
  cancellation joins the healthy receipt writer before root removal.

Retained failing operations here have no real native writer. These controls do
not prove process identity, descendant drainage or OS closure; see
[the native operation cases](hub-test-host-agent-signin-op.test.ts.md).
