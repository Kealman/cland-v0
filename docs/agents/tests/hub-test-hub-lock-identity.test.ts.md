# hub/test/hub-lock-identity.test.ts

`hub-lock-identity.test.ts` is T2: it uses disposable files and injected process,
identity and wall-clock observations. It covers whole-record acquisition,
foreign fresh/lapsed holders (each identity component separately), foreign break
guard recovery without PID probes, same-host PID reuse, legacy record shapes,
and generic sync/async lock preservation. Delayed acquisition must install a fresh heartbeat and exclude an immediate second foreign contender. Main and guard records with malformed identity or heartbeat without identity must raise `InvalidLockIdentity` without probes or removal; `readLock` propagates that refusal. The identity-reader seam covers Linux
and macOS selection and read failure. It launches no process or browser.

Production hub acquisition opts into `HubLockOptions`; generic locks omit it.
`projectHub` supplies `lockIdentity` beside its synthetic process table. Direct
legacy fixtures with a fully injected process table may omit that identity and
retain legacy lock semantics without native probes. Production always captures
hostname, native boot id and Linux PID namespace before acquiring the lock.

Heartbeat timestamps use the injected hub clock. The initial heartbeat is not
periodic refresh evidence; T-1616 owns refresh and lost-lock shutdown. T-1617
owns lifecycle consumers, including offline tracker migration. Mixed hub versions
on a shared volume are unsupported.

Native-to-embedded lifecycle handoffs carry an explicit `lockIdentity` through
`pacingOwner` and `ProjectHubOptions`. The T2 regression persists a native-shaped
same-host lock, proves the default synthetic identity refuses without PID probes,
then observes matching-identity dead-holder reclamation and the replacement's
durable lock token. This catches fixture provenance drift in ordinary task
verification without weakening production foreign-holder refusal. Real CLI
restarts capture the native tuple on both sides; a genuine native tuple change
still intentionally counts as foreign.
