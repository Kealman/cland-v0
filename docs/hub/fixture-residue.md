# Fixture residue maintenance

The Coordinator runs `node hub/bin/cleanup-native-fixtures.ts --help` for the
standalone maintenance interface. Implementers supply a reviewed dry-run plan;
only the Coordinator runs real deletion in an authorized quiet native slot.

Dry run: `node hub/bin/cleanup-native-fixtures.ts --dry-run /private/tmp SCRATCH`.
SCRATCH is a disposable environment root. The command filters provider/account
credentials and isolates HOME, XDG and Git for its single bounded lsof call.
On systems without `/usr/sbin/lsof`, or on an incomplete census, live holders
are unknown. They are advisory information and confer no deletion authority.
Each class reports its exact path pattern, count, apparent bytes (directory and
symlink sizes included; symlinks never followed), completeness and oldest/newest
top-level modification time. Sizes are not disk allocation figures. No database
contents are read. Rows list every candidate with proof or a retention reason.

Historical `cland-h-*`, `hc-*`, account and suite roots and legacy `ct-*` aliases
are always retained. Names and an empty process census prove no ownership or
closure. A zero-eligible historical plan is expected and is not cleanup success.

The only removable class is a reciprocal `ct-<32 hex>` symlink with a private
version-1 `alias-closed.json` in its canonical `.fixture-sockets` target. The
receipt binds alias and storage device/inode and records completed listener,
peer and child drainage. `removeFixtureSockets` publishes it before unlink,
under its existing caller obligation to join all users first. Every subsequent
allocation invalidates closure before returning a path. Old receipts and old
clients remain valid for ordinary fixture use but grant no cleanup authority.

After review, the Coordinator passes the saved plan and one exact literal:
`node hub/bin/cleanup-native-fixtures.ts --remove-literal PLAN.json SCRATCH LITERAL RECEIPT.jsonl`.
The executor revalidates the proof and both identities and refuses unlisted or
changed entries. It fsyncs an intent into a new, exclusive receipt file outside
the fixture root, unlinks only the symlink, then fsyncs completion. It never
recursively removes a root or follows an alias target. An intent without a
completion is incomplete and requires reconciliation. Use a distinct receipt
path for each literal; no glob, shell expansion or recursive rm is involved.

The added closure metadata is additive and private to fixture storage; runtime
owners, QA kits and tests still call the existing allocation/disposal functions.
No protocol frame, production host fallback or inherited HOME receives deletion
authority. Regression details: [fixture cleanup tests](../agents/tests/hub-test-fixture-cleanup.test.ts.md).
