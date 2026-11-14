# hub/test/session-native-lifecycle.test.ts

T-1855 holds the OpenCode keep-context pool's background `pruneMerged` writer
after native worktree removal, continuing writes in `territory.git` on immediate
turns until stop begins. This deterministic gate uses no sleep allowance. The
shared `beforeDirectories` owner checks completion after hub stop, then always
releases and joins the injected writer in `finally` before root removal, including
early assertion failure. Keep the writer-start receipt and final completion
assertion: path absence precedes remaining branch/config writes. The original
400 ms probe produced both incomplete-writer assertion and `ENOTEMPTY` on the
unfixed shutdown; the final gated probe retains an independent cleanup owner.
Never add removal retries. Five fresh-process lone runs and a sequential paired
run with the merge recovery component file prove teardown on macOS within the
default 10 s T3 test budget. Incomplete production shutdown retains its writer;
fixture teardown awaits the same settlement. Native cancellation is T-1856.

The fake OpenCode session publisher writes a unique temporary file and renames
it onto `sessions/<id>.json`; API listings exclude temporary entries. The T1
partial-write control is in opencode-policy.test.ts. Keep the final native
session JSON.parse and directory assertion unchanged: publication guarantees a
complete record, with no reader retry masking partial bytes.

T-1846 gives the initial pooled launch reply a named `POOL_LAUNCH_SETUP_MS`
(`testWaitMs(30_000)`) budget for Git worktree creation and native discovery.
The reply completes setup; PID discovery, persisted native directory/history,
claim release and brief delivery still prove the lifecycle behaviour separately.
Run each OpenCode context setting five times in fresh processes under the
machine-wide preservation lock, with CLAND variables stripped and no HOME or
TMPDIR overlay. Record scratch socket inventories before and after.

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

T-1472 retains the pool context assertions unchanged, including line205's
fresh-Codex-thread history check. A new launch brief stays pinned to its launch
credential with provisional null recipient session_id until the validated native
first-turn receipt binds it. It must not snapshot the previous pool holder's
identity and replay the already-carried first input after rejecting completion.
The memory/frame control is in inject-stalled.test.ts; native handoff remains
proven here, for all three harnesses and both keep_context settings.
