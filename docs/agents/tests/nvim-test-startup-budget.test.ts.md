# nvim/test/startup-budget.test.ts

`nvim/test/startup-budget.test.ts` is T3: real headless Neovim consumes the
production socket protocol from `projectHub`; there are zero hub or harness
subprocesses. T1 tracker-summary and T2 shell-component cover projection and
settling rules. It belongs to `NVIM_SMOKE`, including reduced hub-only and
coverage-selected hub runs; web-only diffs retain this smoke baseline too.
Queue-enabled task verification still defers all T3 to the configured process
occasions; smoke membership does not override that tier filter.

The fixture generates 1,000 Markdown items in a disposable project: 200 open,
800 closed (200 releases, 200 epics and 400 tasks), a release/epic/task tree,
roughly 1.7 KB bodies, two criteria and an
implementation comment per item. No generated tracker is committed. Hub,
Neovim and spoke fixtures use scratch HOME/XDG/Git/account state with credentials
filtered from launch environments. The Coordinator and Implementer spokes run
in-process and are pinned so both session rows remain visible. Before connecting,
the test places Sessions left of the explorer; no GUI or harness starts.

The hard limits are **3,000 ms**, **131,072 bytes (128 KiB)** for the first item reply, **262,144 bytes (256 KiB)** per startup reply and **1,048,576 bytes (1 MiB)** across the eight startup reads. A transparent
socket relay counts UTF-8 bytes of the *first task.list response*, including the
JSON result envelope and trailing newline. It also checks that exactly one
open-summary request with `include_containers:true` returns precisely the open
items and their ancestor chain (including closed ancestors of open work), and that Neovim
installs them all. `hub/test/startup-budget.test.ts` exercises these shared probe
assertions at T1, including missing ancestors, fully closed subtrees, extra and duplicate wire or installed rows.
The generated fixture and copied-live manual probe also assert a 120 KiB first-item
margin while retaining the hard 128 KiB budget policy.
The startup clock runs from delivery of the authenticated
hub welcome to observation of the explorer item row, Coordinator header,
header session count and both session rows in their physical screen columns.
All downstream frames wait behind the welcome until the screen observer is
armed, preserving order. Process/RPC/hub/fixture setup has separate bounds;
the completed render has a ten-second observation bound, followed by the
three-second assertion. These are elapsed startup measurements, not fake time
or a pending-callback/title-only receipt, and the hard limits are not load-scaled.

Measured on local macOS arm64 at the T-1010 working tree based on `5453c280`
(Neovim 0.12.5, 160×45 headless screen): the generated baseline rendered in
27.4 ms with 67,588 bytes. A copy of the live tracker (1,020 items, 106 open)
rendered in 48.2 ms with 42,344 bytes. These are warm, quiet scratch-hub
connection-to-render measurements, excluding fixture/hub/process setup and
production crew/indexer load. The three-second limit preserves E-1006's
acceptance target with substantial measured headroom; 128 KiB is about 1.9×
the generated baseline and 3.1× the copied tracker payload.

Two negative fixtures feed the same measurement and budget checker as the normal
case: withholding task.list for 3,100 ms must complete rendering then fail the
time check, with bytes still in budget; adding the generated real bodies to its
rows must fail the byte check, with startup still in budget. Initial local values
were 3,118.4 ms / 67,588 bytes and 27.8 ms / 415,880 bytes respectively.
The negative tests assert the named budget failure, rather than counting an
unrelated setup timeout as proof.

For a fresh local C4 receipt run (headless, macOS only):

```sh
node nvim/test/startup-budget-probe.ts /absolute/project/.cland/tasks
```

The probe reads each matching item once and writes that text into its scratch
tracker before creating a hub. It copies no live database, discovery, config,
conflict captures, run state or accounts, and never starts against the source
tracker. Its output reports total/open counts, connection-to-render milliseconds
and first response bytes. Post the original output with head/tree, platform and
executor attribution; a local receipt supplies no Linux, full-suite or loaded
production-workbench claim.
