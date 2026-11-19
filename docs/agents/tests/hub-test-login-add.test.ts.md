# hub/test/login-add.test.ts

T3: `terminal disk logins create a host, reuse it and retain only public metadata`
starts a hub through the CLI, drives `login add codex` and `login add claude-code`
through pinned fake SSH and existing fake binaries, then disconnects an admitted
terminal connection. It proves host creation and reuse, file-store Codex config,
1 GiB region-matched volumes, one snapshot per success, last sign-in, detached
ready rows, creating isolation and signed-out disconnect cleanup. Another
connection cannot report completion. The fake calls contain no logout, and
synthetic disk tokens stay out of public metadata, captured output and logs.

Run `node --test hub/test/login-add.test.ts` on supported Node 24, stripping
inherited `CLAND_*`. Use the release preservation slot, load below 20, and a
between-file stop file. Inventory TMPDIR `hc-*` before and after: owned roots
must return to zero after native writers, hub and watchdog owners join. This
fixture installs a scratch SSH wrapper after unlinking the fixture's original
link; never write through a fixture bin symlink. No real provider, harness,
credential, browser or external network is involved.

Stage QA runs the case on dev. T1/T2/Web and changed T3 are Linux mode-free
verification evidence; local native checks name macOS separately; complete T3
belongs to the merge batch and T4 to stage/epic occasions.

The terminal disconnect segment asserts the durable `sign-in interrupted` episode and captured host, the exact volume attachment and its mounted symlink. It does not infer SSH closure from socket loss. Native success and failure remain owned by the CLI post-close frame.

The terminal disk login test uses only disposable fake hosts and credentials.
CLI-started fixture hubs register the allocated project root, never their source
worktree. The final named test `fixture file outputs are removed` runs after
fixture cleanup joins, checking every allocated root and recorded alias absent.
Run the entire file to include that census; a filtered body is not census proof.
Failures retain roots when writer closure cannot be proved. The shared
fixture-socket lifecycle tests also exercise census after planted test failure.

`receiptFixtureCase` owns the entire changed acceptance callback before setup.
Each asynchronous step is admitted and bounded separately; fixture and daemon
setup have named bounds. Fixture helper hooks use the owner's proxy context and
run after original work joins on normal or signal cleanup. The daemon producer
captures its stop before returning, and closing releases registered login children
before joining their continuations. Admission fencing is not used for teardown.
