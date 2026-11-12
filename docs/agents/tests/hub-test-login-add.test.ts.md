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
