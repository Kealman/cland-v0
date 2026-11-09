# DigitalOcean host admission

`cland host create [pool]` uses the same host lease, detached watchdog and hosts
spend admission as automatic pool creation. It remains local-human-only. A pool
needs a current prepared image, an available provider billing declaration and
room under its host and spend caps. DigitalOcean requires account credentials,
API access and an image available in the configured region. These conditions
also apply to inherited pool configuration; a token alone grants no admission.

Creation reserves spend, publishes the database lease and its deadline mirror,
arms the detached watchdog, and checkpoints its native birth before acquisition.
The admission issuer observes the unsettled hosts reservation, mirror, immutable
watchdog input and matching native watchdog identity. The provider refuses
missing lease, armed watchdog or hosts reservation receipts before API access,
naming each missing component. Injecting a fake API grants no authority.

Each intent and droplet is associated with the admitted lease id. A create-only
per-lease index fences duplicate acquisitions and gives watchdog recovery an
exact intent lookup without scanning retained provider history. Droplet tags
include `cland`, the project tag, the pool tag and `cland-lease-<host-id>` beside
the existing unique provider-intent tag. The selected pool image and size reach
the create request. The host key comes from the caller's rendered bootstrap;
the provider supplies an OpenSSH client identity, pinned known-host material,
remote user, home and Node command. DigitalOcean uses the prepared image's runner
account and installs the admitted client public key there. Private keys stay in
private provider files, outside API diagnostics and watchdog evidence.

The SSH gate and runtime delivery consume that identity from the provision record.
They do not derive identity or layout from fake directories or fake-host variables.
The fake provider supplies its existing directory key and transport environment
through the same optional identity field. Test transport membership is published
only after the pinned gate and runtime delivery succeed. Older records without
this field still support status, restart and confirmed destruction; provisioning
never invents missing credentials.

The watchdog starts before the provider returns a machine. At the mirrored lease
deadline it discovers an uncheckpointed acquisition by the exact lease tag. One
matching project/pool droplet plus its exact persisted intent and key association
permits deletion. Both droplet and key need confirming GET absence reads before
spend settles. For an unknown droplet outcome, no match, multiple matches or failed discovery
retains ownership and spend, and records one durable diagnostic beside the watchdog input. The
worker retries without broadening its tag or replaying acquisition. Watchdog
recovery does not open hub.db. Older inputs with an explicit captured machine
retain their existing behavior.

The suite uses only the scripted fake API and recording SSH. It proves admission,
exact-tag recovery after the database owner closes, and strict SSH inputs. It
provides no evidence of a real DigitalOcean machine reaching ready; that remains
a release live-run check.

Admission capabilities retain a live authority callback. Each resource mutation
rechecks the database lease, mirror, exact watchdog checkpoint/native birth and
unsettled hosts reservation; final synchronous lease and ledger publication checks
immediately precede the actual API send after any shared pacing wait. The API
combines the acquisition signal with its existing transport signal and checks
capacity again after asynchronous authority reads; cancelled or revoked queued
mutations never reach the provider. Lease expiry/release, spend settlement/cancellation
and watchdog retirement revoke capabilities before their asynchronous work. The
lease index still fences attempts whose provider outcome is unknown.

A refused droplet POST after successful key import is not empty acquisition.
The exact key id and positive droplet refusal are persisted before cleanup. The
live acquire owner waits through the shared API cooldown, then deletes the key
once through the paced API and confirms its GET absence. Only then can a refusal
carry its bound non-acquisition receipt, retire the watchdog and cancel spend.
Abort or unconfirmed deletion returns owned failure and retains both controls.
If the hub stops, machine-less watchdog replay attempts key deletion by its
persisted id. A lost import response is resolved by one unique exact key-name
match; no match, ambiguity or lookup/deletion failure is retained and reported.
An explicit not-started POST checkpoint or positive POST refusal settles the
droplet side. In that case unresolved non-billable keys remain reported for
explicit reap and T-1765 while spend may be cancelled. Unknown POST outcomes
retain spend even after a key is deleted, until exact-tag droplet deletion is
confirmed. New intents persist the POST phase; old records without it stay
conservative. A durable bound
non-acquisition receipt makes this cleanup replayable without another deletion.

Hub and worker machine-absence publication share `recordHostAbsence`, which binds
both callers to the immutable watchdog input before publishing. Legacy captured-
machine inputs and receipts retain their existing parser. Machine-less replay
requires the bound admission fields and uses the original confirmation timestamp.
