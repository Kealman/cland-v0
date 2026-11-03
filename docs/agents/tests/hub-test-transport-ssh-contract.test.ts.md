# hub/test/transport-ssh-contract.test.ts

`hub/test/transport-contract.ts` exports `TRANSPORT_ENDPOINTS`, the single list
`hub.sock`, `spoke.sock`, `git.sock`, `agent.sock`, and `transportContract`.
A second carrier, expected to be `outbound` in 0.4.x, supplies a `ContractFixture`
to that same function and passes its assertions unchanged. Each entry registers
`node:test` itself and calls `transportContract(t, fixture)` from its test body;
this preserves entry-file identities for duration receipts and load-gate replay. The fixture supplies
the carrier, host run directory, endpoint exchanges, a carrier-drop operation
and native no-TCP inspection. It owns setup and complete resource drainage.
`outbound` remains unsupported in 0.4.0; this suite adds no carrier or runtime gate.

The contract requires all four host paths to be Unix socket nodes in the
agent-owned 0700 run directory. The directory mode is 0700; socket nodes are
0600 in the fake. Host-to-hub exchanges use hub, spoke and git; hub-to-host
exchanges use agent. Binary requests and distinct replies prove both directions,
including a stub-side exact-byte receipt. Agent requests use the existing agent
framing so the carrier's authenticated readiness probe can use the same stub.
After an actual master drop, readiness waits with a deadline for a replacement
and replies from every endpoint, then retains the final exchanges. A status
of `up` alone is insufficient.

`transport-ssh-contract.test.ts` and `transport-fake-contract.test.ts` both bind
the shared suite through `transport-contract-fixture.ts`. Per A-15561 the fake
transport **is** the real ssh carrier driven by the fake ssh stand-in, so these
are two named entries for one pairing, not independent carrier implementations.
There is no real sshd, remote host, key generation or external network. The
supervisor check stub succeeds because the in-process agent stub already owns
its endpoint; no detached agent or harness is launched. Per-session forwards
are carrier-specific and outside this contract.

Both entries are T3 because a real stand-in master is killed and replaced.
Run them individually with supported Node 24:

```sh
node --test hub/test/transport-ssh-contract.test.ts
node --test hub/test/transport-fake-contract.test.ts
```

Before each targeted command check free disk and the load restrictions from the
shared test guide. A native positive control binds one ephemeral loopback TCP
listener without connecting, proves the scanner detects it, then closes it
before carrier start. The scanner reads Linux `/proc` socket descriptors and
LISTEN rows, or macOS `lsof` descriptors. It inspects the test worker and every
live scratch-root child before and after reconnect. Missing native inspection
fails rather than claiming no listeners. This proves no endpoint TCP listeners;
it does not claim that a future real SSH connection would avoid TCP outbound.

Explicit hub stub paths use `fixtureSocketPath`. Production-selected carrier
paths and fake-host run paths retain their names and are asserted below 104
bytes including NUL. The fake root uses a short disposable `/tmp/tc-*` path,
independent of the stage's deep TMPDIR. Carrier children inherit that scratch
cwd and `fixtureEnvironment`; teardown stops the carrier, drains scratch
children and closes all peers/listeners before removing roots and socket aliases.
No browser, live hub, account or inherited Git configuration is used.
