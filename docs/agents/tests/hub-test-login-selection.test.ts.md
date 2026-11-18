# hub/test/login-selection.test.ts

T2 public LoginRecords selection/migration seam with disposable SQLite files;
no child, socket, provider, real login, account state or browser is used.

Coordinator decision 6ee8b256-b79e-44cd-a790-33119f4f7cc3 authorizes a synthetic
corpus instead of live-copy data: E-1535 introduces the domain and the live project
has no representative login history; this epic is fakes-only. The fixture creates
10,000 signed-out, creating and wrong-region ready disk logins across harnesses,
accounts and regions, with retained snapshot histories, through public LoginRecords
methods inside a transaction. No raw SQL writes data around the schema.

The positive control observes all 10,000 history-row decodes via list(). The hot
selection cases decode zero history rows, use one held query or two queries for
ready selection, and return at most two held records or one ready record. SQLite
EXPLAIN QUERY PLAN must use login_bindings_launch/login_ready_launch without a
full scan or temporary sort. Both account-pinned and unpinned selection are tested,
as are a settled binding and conflicting bindings. These are query/decode work
budgets; no wall-time or live-project performance is inferred.

The migration control seeds every row through the public API, downgrades only
the additive schema to stage1, and reconstructs LoginRecords. It checks public
rows/bindings unchanged, private harness backfill and indexed held selection.
A planted index-creation failure proves the private column/backfill rolls back
with the migration savepoint, then the ordinary migration succeeds.

Run `node --test hub/test/login-selection.test.ts` with supported Node24 and
inherited CLAND variables removed. Store handles close before root disposal.

The shared process-cleanup directory/resource owner makes T2 the lowest admitted
tier; the test itself launches no native process or socket.


The schema-only stage-one downgrade drops the six binding/reader capacity
triggers and `login_capacity_launch` before removing private pending_bindings
and binding.phase. Public records and the selection assertions remain unchanged.
It also drops the ready/reader launch indexes before pending_bindings, since
their maintained pending-count keys depend on that column. Selection titles and
assertions are unchanged.

`status reads decode current storage only and bound harness work across retained history` seeds 300 deleted-only October records and two live records (including a removed pool). Its positive decode control sees all 302 rows; the November status range decodes only two. Three harness existence reads plus one storage range use SEARCH plans and the dedicated indexes, with no temporary sort or index scan. This is a fake-only retained corpus because logins are unreleased.
