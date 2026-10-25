# hub/test/session-native-lifecycle.test.ts

The progress-digest reply follows T-360's fake Codex contract: answer the last
human or agent delivery (the report), with its topic and `replyTo` id. The old
expectation of a pong for the first progress note predates that contract. Keep
the three held notes, single ordered input, injected stages and restart checks;
only the native reply expectation changes. T-1253 updates this missed consumer.

The file also proves native pool worktree migration and child/history identity,
usage re-publication after hub restart, and process stop policy at merge. Keep
its existing owned scratch roots, sealed environments and process cleanup. The
Codex restart case migrates the pre-T-1269 expectation of an undefined total: a
rate-limit-only reconnect now republishes the stored total, and the final stop
record keeps it, while the no-replay and one-final assertions stay.
The OpenCode row waits for the durable `cland-role` instruction entry in the
fake session record (`sessions/<ses>.json`) rather than first-turn usage: with
role instructions on by default no clause turn runs. Keep the idle and
released-claim assertions. Run it alone locally; mode-free task verification
selects this changed T3 file.
