# hub/test/recording-host.test.ts

T2 contract for `hub/test/recording-host.ts`. Run with
`node --test hub/test/recording-host.test.ts` under the shared targeted admission
and load rules.

`recordingHost(storageRoot, {sourceRoot, record, overrides})` maps Host file paths from
`sourceRoot` (default: `storageRoot`) into one disposable storage directory.
Paths outside that source root refuse. `realpath` returns the corresponding
source path. Identity-mapped scratch roots also accept their canonical alias
receipts. The local launch layout comes from the production pure layout builder.
Use short disposable roots for adapter tests whose local socket
fallback would otherwise leave the fixture. Overrides model the specific fault
or observation under test; delegate unaffected files to the shared helper.
The optional `record` callback observes default operations. Scoped overrides
retain their own observation receipts, avoiding duplicate records.

The helper never starts processes. Its synthetic spawn owns an exit promise;
stop resolves that promise and removes the child from its liveness inventory.
Command execution and Git worktrees require explicit overrides. Native contract
tests retain their real Host subject and need the native slot for their tier.
Optional capabilities deliberately absent for older-agent scenarios remain
undefined; they still have explicit mapping entries.

The contract test derives every member name from the parsed Host interface and
compares it with the helper, including optional capabilities. The exhaustive
mapped type independently checks operation signatures. Add each new Host member
to the helper and exercise its boundary here. The file/process test runs under
the shared fake-only launch guard, including its positive controls and cleanup
check. It proves scratch publication, appending, metadata, path resolution,
listing, removal and stop/exit behavior without a native child.
