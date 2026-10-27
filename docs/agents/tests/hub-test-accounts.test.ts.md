# hub/test/accounts.test.ts

The generated Codex and OpenCode retained Implementer handoff tests launch with
an explicit brief before waiting for usage, idle and released holds. OpenCode's
default instruction route installs a clause-only launch as the durable
`cland-role` entry without starting a turn (T-619, T-1263). Keep the usage check:
the brief supplies real work, and an initial idle snapshot alone does not prove
that work completed. Keep the final account, process, conversation and worktree
assertions when changing startup synchronization.

Run each OpenCode handoff case alone five times on macOS and the Codex variant
once for T-1263. These targeted receipts supplement the mode-free task run;
they are not a full T3 suite. Clause-only startup and pool readiness are covered
separately by `session-native-lifecycle.test.ts` and
`scenarios/crew-launch.test.ts`, which read the durable role instruction.

The generated saved-account relaunch/restart cases preserve the fresh conversation
and saved-account assertions. After recovery, observe the old spoke connected,
flush/read the journal prefix, then arm a bounded reader before `session.stop`.
Fresh resume follows a new durable `bye` record for that name. Native stop alone
proves neither socket disconnect nor release of its name reservation; do not
weaken the reservation or replace this receipt with an elapsed delay. The
prefix excludes disconnects from the earlier relaunch and hub lifetime.
