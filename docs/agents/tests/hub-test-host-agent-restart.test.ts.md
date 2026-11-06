# hub/test/host-agent-restart.test.ts

`hub/test/host-agent-restart.test.ts` is T3 because it supervises native agents,
uses the fake SSH master and SCP, and retains a detached harness over restarts.
Run with `node --test hub/test/host-agent-restart.test.ts` under targeted admission.

The shared SSH fixture owns a disposable root, HOME/XDG/Git environment and
fake host. Its process census joins the supervisor, agents and harnesses before
removing storage. The explicit supervisor owner stops the restart loop before
the final census. Secrets are synthetic. Runtime source is copied into a scratch
source tree with planted ignored account/environment files; the delivered
standalone agent runs without repository node_modules and launches its bootstrap.

C1 times kill-agent to the replacement's running process table, bounded at five
seconds (`KILL_TO_RECONCILED_TABLE_MS`), independently of setup budgets.
The version-delivery case keeps one worker across interrupted delivery, lost
replies, duplicate selection and two further upgrades after pruning the original
supervisor version. These are durable setup/receipt checks, rather than a
version-delivery latency assertion; their waits use `testWaitMs()`. The case has
a separate 90-second whole-test setup/teardown envelope (configurable through
`CLAND_TEST_WAIT_MS`) above its sampled C-216 duration allowance. This does not
change the five-second kill-to-table assertion. The duration manifest remains
in report mode; targeted runs prove assertions without executing its gate.
Other cases wait for authenticated version hellos, native completion
receipts and exact PID/birth table rows. A signal log remains empty for the live
harness through replacement. Installation/publication interruption retries the
same immutable version. Accepted-publication reply loss settles through the
matching hello; an explicit duplicate selection must checkpoint already-selected
with the same native PID/birth as applied.json and the still-live agent hello.
The fixture consumes the registry’s exported handoff owner, counting actual
transport copies rather than recreating its delivery policy. Consecutive upgrades prune the initial supervisor's
version and still complete another upgrade. Corrupt hashes and escaping paths
never publish a selectable package.

Held installation and held connection cases arm gates before lifecycle actions,
then observe the installed package or actual socket close. Close joins admitted
work and close/quiesce prevent late delivery/restart publication. The exact-birth
refusal controls live in host-agent-closure.test.ts; native fresh-child replacement
is proven here. Adopted-worker C3 launches a scripted Claude worker through T-1607’s generation
receipt path, freshly restores it in the old supervised agent, then verifies the
new version’s durable table contains the same owned running PID/birth. The fake
worker ignores and logs TERM, and that log stays empty across replacement.

The registry loader control runs in a scratch child with the shared filtered
environment. A Node resolution hook makes every hub dev-only package
unavailable; a planted TypeScript import must fail before the real registry
import succeeds. Its positive completion file and native close are both checked.
This proves the loader boundary with dependencies withheld, without claiming an
installed package build or a configured verification receipt.

Downtime controls stop the old agent, then observe a Claude root's native exit
before starting its replacement. The healthy peer must restore and accept a
filesystem mutation. A positively closed old tree completes release/forget
without signalling. A live unowned asynchronous SessionEnd writer instead keeps
that generation's private files and explicit incomplete report; the writer stays
alive and no recovery signal is sent. The original null result is checked for a
restore request without report options.
