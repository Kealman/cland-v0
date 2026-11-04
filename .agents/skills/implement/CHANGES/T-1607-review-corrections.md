# T-1607 source-review corrections

A-16407 at fc90db2db identified jobs preflight, a late-hook false closure, terminal settlement, durable failed-launch recovery and a setup bound. Coordinator decision 9e8dc018 permits event-driven terminal settlement and sequences failed-launch settlement after T-1606.

The agent preflights and pins a real agent-owned jobs directory before any command and rechecks it after launch. A held recovery checkpoint proves an asynchronous hook born across root exit cannot produce a closed receipt or metadata deletion; no new authority is acquired after root absence. Concurrent-release setup now has its own deadline and retains finally/drain and the final assertion.

Remote terminal observation performs one bounded native stop/absence confirmation before exit publication. A generation marker persists a cleanup-incomplete cause and at most one restart recovery retry; timers never retry native CLI commands. The matching ADR and Host/skill/test guidance record the exception. Local paths and C5 test sources remain unchanged.

Failed-launch integration remains pending T-1606's LaunchSettled and the Coordinator's explicit merge instruction. This correction checkpoint is not source-clear or verification evidence.

The terminal marker is an O(1) per-generation lookup in adapter state, not a
history/startup scan. Its new stateReason value uses the existing free-text field;
consumer inventory: Sessions and Core, protocol/shared wire string types, CLI
session formatting, Web SessionRow/SessionPage and Neovim state/panels all retain
and display arbitrary reasons. Existing Codex and signed-out reason producers,
the T1–T4 test fixtures (codex-native, Claude accounts/schedule, session-host,
inject-stalled, scripted-codex, Neovim sessions/protocol frames), and QA briefs
T-272/E-1531/E-1531-stage-3 require no migration: they assert other reasons or
render arbitrary text. No reply field, row membership or wire type changes.

Coordinator 66fe13ce approved a deterministic pre-signal churn control. It creates
a native descendant after prepare-stop capture and before commit, observes its
PID/birth and its absence from the approved tree, and reproduced the generic
identity refusal red before the fix. One bounded recapture now validates the same
exported descendant-acquisition policy as SessionEnd joining. The initial PID
census stays memory-only and is consumed by the admitted stop; candidate changes
are not checkpointed as owned targets before validation. A second churn, foreign
UID, reparented process, pre-existing PID or vanished root birth remains incomplete.
Native control and release-loss then passed together.

pre-signal descendant churn is settled by one bounded recapture; other refusals end cleanup-incomplete with the row and role held, settled by an explicit re-stop

The earlier 20/20 receipts at 88297e2b3 are A-16426; they do not run this later
fix. The new control demonstrates a mechanism for the earlier refusal, but cannot
prove it was that earlier run's cause. The reviewer must read A-16426 alongside
this correction evidence, not infer an automatic retry for admitted refusal.

Consumer search for claudeDescendantCapture/stopClaude/captureForStop/captured:
only AgentProcesses' adopted-worker path and claude-stop's dynamic acquisition
use the new exported policy; claude-stop unit controls consume it directly.
Prepared stop remains a boolean result, Host callbacks and wire operations are
unchanged, and ordinary AgentProcesses callers retain capture-once behavior.
The added cleanup-failure state uses the existing free-text stateReason consumers
listed above. Its exact-generation adapter-state lookup is O(1) and clears on
confirmed cleanup; it grants no retry or signal authority.

Unconfirmed explicit-stop causes suppress timer-triggered settlement and native
restart replay. Re-adoption may still finish an already released receipt (or a
matching confirmed-private-deletion checkpoint), which carries no signal
authority. A T2 restart control rejects any native command/signal on the
unconfirmed path and retains the running row/cause for explicit re-stop.

A native reparented-child control showed why capture admission must share that
policy too: with the new ledger guard temporarily disabled, a later explicit
stop promoted the unowned orphan and returned true (`true !== false`, assertion
“explicit re-stop cannot promote an unowned orphan”). The guard was restored
immediately. With it, two explicit stops retain the live orphan, row and role;
only independent pinned cleanup of that unowned child followed by an explicit
re-stop settles the worker. The positive control completes in ~2s and this
adverse control in ~3.5s on the local Mac, including fixture setup.

Fresh adoption records a memory-only process census. Adopted capture updates
use the same native-birth/UID/ancestry policy; a recovered marker alone grants no
new acquisition. The no-inherited-authority test now explicitly observes and
aborts a pre-restart capture, so its known baseline tree is durable before it
asserts that the later SessionEnd hook cannot be acquired. Its final unowned-hook
and no-signal assertions remain. C5 sources are unchanged.
