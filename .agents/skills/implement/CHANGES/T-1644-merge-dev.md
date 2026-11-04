# T-1644 authorized dev integration

Coordinator 8ca4e17e authorizes one merge of dev after T-1604 and T-1606.
Pinned parents: bc5dfea1c (task) and ce6195767 (origin/dev).

Keep both Host admission paragraphs and both Host agent sections, and combine
the README reference facts. The duration manifest keeps all seven dev additions
and drops the seven obsolete task test identities without replacing baselines.
Host launch-layout keeps dev's short fixture roots and the task's positive
OpenCode, rollback and concurrent-editor cases. No symbols are renamed during
resolution. LaunchFiles auto-merge retains both Host.stat and asynchronous
bounded settlement/retain/retry behavior from dev. Targeted files are run
without post-merge edits; delta source review precedes verification.

## Forced T-1606 fixture edit

Coordinator 00dd9229 directs remapping stat in codex-remote-cleanup.test.ts;
its other file operations already map into separate scratch storage. All original
assertions and the planted hub-side mirror stay unchanged. Comparison used a
clean detached ce6195767 checkout and isolated fixture/Git environment: dev3/3,
merged0/3 with the same 15-second durable-settlement timeout. The recording Host
had inherited local stat, which consulted the mirror instead of Host storage.
No production compatibility path is retained. A separate LaunchFiles guard
positively arms native mirror stat/read refusals and proves remote rollback
never reads or changes that mirror.
