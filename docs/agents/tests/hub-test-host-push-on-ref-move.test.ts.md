# hub/test/host-push-on-ref-move.test.ts

T3 uses `sshHostFixture` with isolated HOME/XDG/Git and the real Unix Git
socket daemon, executable proxy, production territory update hook and branch
leases. It asserts exact territory heads after commit, amend, reset and rebase,
a native refused result after revocation, no repeated push on unchanged metadata,
next-move retry, private 0600 state and catch-up after agent restart. It installs
no session hook and sends no session push. Cleanup joins agents, clients, socket
daemon and fixture writers before removing the root. Each territory-head wait is
bounded at five seconds; this is convergence evidence, not a benchmark.

The C-216 duration allowance expires 2026-11-11 and records local macOS samples.
The separate T1 `host-ref-watch-compat.test.ts` keeps a previous agent hello and
asserts that watch/unwatch send no operations without the new capability.

The native file also keeps a dirty-removal refusal followed by publication and
an adversarial stale compare-and-swap push that cannot regress a newer territory
head. A second generated case starts the supervised standalone agent with a
scratch Git executable that publishes a held-push receipt. It observes the durable
pending native identity, kills only the admitted agent, commits a newer head,
observes the replacement agent and then releases the old native push. The final
exact territory head and cleared pending checkpoint prove recovery. The native
process ledger owns that push; the test uses no extra writer ledger. Fixture
cleanup stops the supervisor and drains remaining owned children before deletion.

A separate native case kills an admitted producer before its command
receipt, observes a named missing-result fence, then proves a later leased head
publishes and clears that fence. The receipt-specific native case plants bearer,
token and credential-URL output with a positive control, then scans the actual
atomic0600 receipt for planted bytes, confirms bounded redaction and observes
native/captured closure. The worktree case keeps a lost successful removal reply
and retries against positive directory/Git-index absence without replaying deletion.
