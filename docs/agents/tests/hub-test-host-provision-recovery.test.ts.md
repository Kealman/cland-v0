# hub/test/host-provision-recovery.test.ts

T2 startup through projectHub, directory-only fake provider, scratch HOME/Git.
`node --test hub/test/host-provision-recovery.test.ts` covers creating, booting,
connecting and cloning interruption checkpoints. Each case checks public host.list
for failed/incomplete, positive provider readiness for the retained machine and
no minted runtime registration. The creating case deliberately omits machine
identity even though acquisition happened: startup must not infer replay or
release authority. No native host or provider network.

Prepopulated-membership cases change, withhold or mark released the provider
identity. A typed carrier factory records admissions: rejected machines construct
zero carriers/Hosts, while unrelated legacy/manual membership is preserved. The
control does not start native SSH, a Git daemon or an agent.

No-registration controls retain interrupted, failed and released captured machines
with prepopulated membership. Both startup restore and direct automatic registration
(the configuration-reload path, without restore) must leave zero physical aliases,
carriers and Hosts. Released directories cannot be read; a separate manual machine
still registers. Ownership checks use indexed captured addresses/ids, including
failed history, without scanning that history at startup.
