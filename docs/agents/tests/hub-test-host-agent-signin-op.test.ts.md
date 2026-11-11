# hub/test/host-agent-signin-op.test.ts

`hub/test/host-agent-signin-op.test.ts` is T3: native bootstrap, fake provider,
attached fake volume, private Unix agent socket and fixture-owned fake harness.
It uses no real account, provider API, mount helper or network.

- `sign-in streams bounded output, redacts split input echoes and persists its exact close`
  observes prompt output before sending a memory-only input line. The fake harness
  checks the line's known SHA-256 digest, echoes it across chunks, and exits 7.
  The test reads the exact admission's durable receipt and scans fixture files
  for the input, with a planted positive control before the final scan.
- `sign-in cancel joins descendants and durable close before unmount` launches
  an inheriting child and holds the native close checkpoint. It asserts the fake
  mount remains present while unmount waits, then joins the exact cancellation
  receipt before accepting unmount completion. No elapsed-time settlement.
- `sign-in output overflow terminates with an explicit bounded close outcome`
  verifies each chunk is at most 4096 UTF-8 bytes and total delivered output is
  at most 64 KiB, with an `output-limit` close outcome.
- `post-release rejection retains descendant birth and refuses unmount` injects
  failure after release while an independent-stdio child is alive. It waits for
  the durable descendant birth, checks retained ownership and rejects unmount
  with `writers-remain`. Independent fixture owners join the child before
  accepting the deliberately incomplete agent shutdown and removing the root.
- `failed native-close publication emits incomplete and refuses a waiting unmount`
  holds then fails publication. The peer gets `CLAND_NATIVE_INCOMPLETE`; a
  waiting unmount refuses and the mount remains.

Run under the release's native preservation slot, one file at a time, with
inherited `CLAND_*` removed. Fixtures build their final environment through
`fixtureEnvironment`, and join clients/agent children before directory removal.
The per-test observer budgets come from `until`/`testWaitMs`; no real-time
behaviour timeout is asserted. The hub/card owner owns the 15-minute deadline.

T1 companions `signin-client`, `signin-command` and `signin-redactor` prove
admission mismatch, owner loss, shared command grammar and all split positions
of an echoed input. `host-agent-client` retains the previous hello wire shape
and proves capability refusal before spawn. `host-agent-boundary` and
`host-agent-closure` cover the regenerated runtime package.

`signin-owner` uses an in-memory native adapter to cover uncertain starts,
completion failures and bounded retirement over 40 sequential runs. The reusable
optional sign-in contract covers absence, typed refusal and returned admission,
input, output and close shapes with planted failures.

`peer shutdown joins another run receipt checkpoint after one run fails` proves
that every started shutdown join completes before failures are aggregated. Its
independent `finally` join also protects the root when the red assertion fails.
