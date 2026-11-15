# T-1806 inventory procedure for native preservation rows

This is the reusable filesystem evidence block, not an additional QA request.
The responsible item lead supplies the file list and routes any findings to
`lead T-1806` in the item topic. Historical cleanup belongs to T-1865 and is
outside this procedure. This item authorizes no historical census or deletion.

Before and after each native file, import `temporaryInventory` from
`test-support/temporary-inventory.ts` at the candidate build and persist its JSON
result in separate evidence files. After the test process has closed and fixture
cleanup has completed, compare those snapshots through `inventoryDelta` from
the same module. Each root must have `added: []` and `removed: []`. Retain both
full snapshots even on failure. Counts alone cannot prove preservation.

The default snapshots include every entry in each canonical root, including
system /tmp. Allocate declared capture files and suite infrastructure before
arming the observer. An explicit `{prefixes:['hc-','ct-','cland-h-']}` option is
available only for labelled prefix evidence; it does not satisfy the unrestricted
name-set check. The original A-19565 system /tmp evidence is prefix-only, while
its per-user and suite-TMPDIR snapshots are unrestricted. Run native preservation
rows only with the Coordinator's authorization at the clear reviewed head;
read-only full listings are required. No historical/development-leftover cleanup
is authorized by these rows.

Use the same helper around the serial host-file batch under a disposable suite
TMPDIR. That batch exercises the shared nested-alias disposal path without
running concurrent native files. No native row runs without its preservation
slot; no local full suite runs outside `cland verify`. The Linux verification
receipt and full merge-batch T3 coverage remain separate from these macOS rows.

Scratch projects that bypass `tempProject` call `enableFixtureHostSockets(root)`
from `shared/fixture-sockets.ts` before host registration. Stop all writers and
observe their closure before calling `removeFixtureSockets(root)` and removing
the owned root. Neither helper sweeps historical paths.

Registration adds no root entries. The first host allocation persists the marker
and creates private socket storage. Every child launcher uses fixtureEnvironment
after all overlays; its exact-root layout opt-in lets a hub/CLI child allocate
before the parent's first hostPaths call. Unused projects keep their empty
listing, so prepared-copy and confinement guards retain their original assertions.
