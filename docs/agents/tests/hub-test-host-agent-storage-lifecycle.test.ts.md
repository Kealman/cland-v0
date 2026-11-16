# hub/test/host-agent-storage-lifecycle.test.ts

T3 requires the exclusive native slot. It starts an isolated agent whose
readiness checks its native self-birth, with a synthetic boot identity and a
sealed fixture environment. No provider, account, external network or real
harness is used.

`agent readiness precedes retained recovery and close joins its suspended directory`
holds the recovery filesystem iterator after 32 of 10,000 retained entries.
An authenticated hello proves the listener remains ready while that work is
held. Close fences the scan synchronously, joins its resumed iterator, and
observes no additional entry before the fixture removes its root. All setup
and test waits share the load-scaled setup bound. Cleanup releases the held
scan and joins both client and server before removing storage.
