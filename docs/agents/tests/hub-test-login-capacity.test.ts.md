# hub/test/login-capacity.test.ts

T2, in-memory SQLite LoginRecords and PoolRuntime with injected creation. No
native process, provider network, harness, browser or key bytes. The reopen
case allocates one owned `login-capacity-` scratch root; record prefix inventory
before and after the file, expecting 0 → 0 when no historical roots exist.

- `exclusive login in use holds demand growth below max_hosts`: C2, one full host,
  max two, no free login; login wait and no creation decision.
- `wrong region login supplies no pool capacity`: C3, fake-1 disk with fake-2 host.
- `creating login supplies no pool capacity`: C6.
- `settled bindings serve first and pending bindings cannot serve`: C1.
- `shared login permits every pool host and further growth` and corresponding
  key case: C4 metadata capacity, not native binding or key injection.
- `minimum creates hosts without any login`: C5, admitted minimum creation.
- `login verdict classifies a retained signed-out binding and refuses region drift`:
  C1; signed-out snapshot injected through the selector because current transition
  removes bindings atomically. Retained legacy snapshots still fail closed.
- `demand create rechecks login capacity at the creator admission boundary`:
  a competing binding wins before the effect, which never happens.
- `capacity selection bounds decoded rows and indexed query work over retained metadata`:
  synthetic 10,000-row retained corpus; positive decode control, one row decoded,
  two indexed queries, no table scan or temporary sort.

C5 login-add exemption is in login-host-pin.test.ts, case
`login add creates a host while its only login is still creating`.
Scheduler ordering is in host-scheduler.test.ts, case
`healthy binding precedes can-bind and bindable room precedes creation`.
Run files through the shared targeted procedure in docs/agents/tests.md.
Stage QA owns combined native behavior; these component receipts do not cover it.

Account-pin correction cases:
- `pinned account with no free login cannot authorize host growth` holds demand
  despite unrelated ready capacity.
- `pinned account skips incompatible healthy binding for compatible bindable host`
  preserves the requested account during host ordering.
- `demand retains the admitted account pin after a competing bind` rechecks the
  same account at create admission even while another account stays free.
Fixture ownership registers SQLite immediately, joins runtime and lease owners
before its close, attempts every close on rejection and aggregates failures.


Migration and bounded-read corrections:

- `pending capacity counter follows every binding and reader writer and transaction rollback`
  checks bind prepare/finish, reader prepare/refusal/binding/deleting/deleted,
  release acknowledgment rollback and completion, unbind rollback cleanup and
  exclusive changes against a direct count and hasPendingBinding.
- `capacity index bounds visits across same-region rejected rows and agrees with pending fences`
  checks 10,000 matching pending, reader-creating/deleted and null-volume rows.
  An injected nondeterministic SQLite function counts candidates before residual
  filters, with a 10,001-row scan positive control. Pinned, unpinned and missing
  accounts visit at most one eligible candidate. Every corpus row's private count
  is compared with a direct count and hasPendingBinding separately.
- `capacity migration backfills both fences and preserves counts across reopen`
  downgrades only the private schema, keeps public rows, backfills retained
  pending binding/reader states and closes/reopens the database twice.
- `verdict reads only held bindings and eligible capacity across pending reader history`
  fails with 2,000 visited rows before heldForLaunch extraction; afterward it
  requires zero candidate visits/decodes and three queries for no-login verdict.

The stage-one schema downgrade in login-selection.test.ts drops the six capacity
triggers and index before removing the counter and binding phase column.
login-selection and login-exclusive preserve T-1778/T-1786 selection behavior;
only the former's schema setup is extended for the new private migration.
T-1793 reconciliation is not implemented here; SQL writes through these tables
receive the same triggers when that owner is introduced.

`launch selection bounds candidate visits and decodes across ten thousand retained
reader intents` seeds 10,000 matching disk logins with creating/deleted reader
intents, split between ready and shared in-use states. Seed construction
uses one transaction and reused prepared inserts into the real login, binding
and reader tables, so their capacity-maintenance triggers remain active. The
fixture avoids repeated public transition/notification writes; this case proves
selection work, while the earlier cases prove the public mutation invariants.
A full-scan visit control
and list decode control each observe 10,001 rows including the eligible candidate.
The previous selection SQL is a positive query-work control (at least 5,001
visits). Ready and shared selection, with unpinned, pinned and missing accounts,
require at most one candidate visit, one decode and three queries. The fixture
recreates the old launch indexes, records constructor migration milliseconds
(in-memory SQLite, excludes corpus setup), and checks that a second constructor
does not rebuild them. This is work-count evidence, not a launch latency claim.
Both schema downgrade fixtures drop ready/reader indexes before removing the
pending counter on which their launch index keys depend. Existing selection
assertions and titles remain unchanged.

Both new launch-selection cases use the shared fixtureWork owner around guard
acquisition and the complete callback. fakeNativeGuard positively exercises
synchronous, callback, custom-promisify and lower spawn boundaries before SQLite
setup. Cleanup joins the callback, closes the database, checks no unexpected
launches, then restores the guard. No provider, process identity, lease or ledger
is acquired by the work-count case.

`launch selection retains an earlier null-volume ready login and binder refuses
before provider acquisition` pins an earlier null-volume and later valid disk
login in the same account. Pinned and unpinned selection keep the earlier row;
LoginBinder rejects it before acquiring its provider. No binding is persisted and
the later row stays ready. This retains the pre-optimization refusal contract;
the launch query reuses only pending_bindings=0, not the broader capacity predicate.
