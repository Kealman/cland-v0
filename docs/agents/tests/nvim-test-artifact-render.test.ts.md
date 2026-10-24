# nvim/test/artifact-render.test.ts

`nvim/test/artifact-render.test.ts` exercises the T2 recorded-client boundary:
read-only thread projections, exact editable raw source, rendered-on-open defaults,
and a 2,000-line artifact’s bounded first paint: only visible rows plus four source
rows are parsed before the first rendered grid; the remaining parse is deferred.
The T2 load gate keeps a 200 ms gross guard. The 50 ms target is measured separately
as a median of several local macOS runs on a quiet machine, reported in the item
topic with head/tree and individual samples. Its parser counter
is read after the final rendered screen is observed; unchanged file versions
(path, mtime and size) reuse the cached projection. Unsaved raw edits are separate
buffer versions. `qa/cases/ARTIFACT-001.lua` checks the visible Markdown features,
block quote, raw toggle, help and palette through the headless grid. Prompt and
browser compatibility remain in `nvim/test/artifacts.test.ts`. T-1005 adds T2
recorded-client proofs in `artifact-render.test.ts` for folder entry/`.md`/`.markdown`
children selected in the browser, palette `CTRL-v` with unequal centre/split widths
and independent toggles, and both `␣ps`/`␣pa` sending exact saved Markdown bytes
with the correct attachment flag. These assert rendered grids, editable raw
source and protocol receipts, without timing targets. The headless-grid case
`qa/cases/ARTIFACT-002.lua` reads a rendered folder child and palette split side
by side, then checks that a split raw toggle leaves the centre rendered. It is
appended to the shipped T4 catalogue; E-795 after-stage QA remains separate.

The same T2 file covers artifact-event refresh with an already-loaded raw buffer,
raw saves replacing a cached version, 120→80→120 table relayout against the thread
projection, source-line cursor mapping across a stacked table and deferred table
completion, rendered-on-restart snapshot/restore, and a recorded move into a folder
followed by a save on the rebound raw path. These assert grids, exact source lines,
buffer identity/options and final decoration receipts; they add no timing targets.
The shared projector returns a one-based `source_line` on each metadata row,
including table rows and their generated separators. Artifact refreshes consume
this mapping without changing mode; unchanged versions keep their cursor row.

The 20,000-line scenario in that T2 file also observes a `j` key and its cursor movement before rendering finishes, then waits for the final decoration receipt before checking start/middle/end grids and zero new parsers on reopen. Parser instrumentation asserts continuous Markdown region extensions of at most 128 rows and injected-language batches of at most 64 regions; scheduled-callback instrumentation records every artifact/projector/native-parser turn, including synchronous reused-parser and query-only turns, and asserts at most 256 extraction/projection steps, 128 buffer rows and 256 decorations per slice. A one-second gross slice guard catches a stalled callback under load. Source-row counting stops after first paint: scanning the full source inside a timing spy would introduce unbounded work of its own. The context case covers a fence and table spanning many batches, a reference resolved from the end of the document, recursive Markdown and Vim-in-Lua injections, combined/include-children and child-excluding injection ranges, comparison of text, canonical spans, link metadata and applied extmark styles with the unsliced thread projection, and a superseded-version callback barrier. A reused-parser regression requires every synchronous parse turn to appear in the timing audit.

The 16 ms target is a quiet local macOS measurement, separate from load-gate repetitions. Report five fresh-client runs' maximum render-callback times, their median, head/tree, queue state and machine load/idle evidence in the item topic. Include initial projection-buffer construction as well as every native parser callback, extraction/projection and buffer decoration turn. The full first-paint open/redraw/grid observation is also reported separately. Timing includes the observation wrappers; it is diagnostic in T2 and never substitutes for the deterministic work assertions.


The recorded artifact screen file checks browser/palette page reads and General
archive continuation when byte-capped pages contain fewer than 200 messages.
It also opens older-page rendered centre/split folder-child views, holds detail
reads across reconnect and visibility reset, and proves both rendered/raw views
retain their artifact identities before those detail receipts arrive.

T-1026 retains the 20,000-line fixture and every original work cap. The input is
normalized and split once for the async parse and projection. Each injected
language reuses its parser across 64-region batches; descendants from the prior
batch are removed after their immutable trees are saved, before the next parse.
The existing long case additionally bounds parser creation at six. The context
oracle includes 65 nested Markdown fences, crossing the batch boundary with
inline descendants, so text, spans, links and applied styles detect stale-child
reparsing or duplicate extraction. The callback audit still covers every turn,
without allocating unused return-value tables in scheduled callbacks.

For T-1026 duration evidence, keep the test identity unchanged. Record five
sequential, standalone local executions with head/tree and platform, then the
case's ordinary T2 timing from mode-free Linux droplet verification. Stage covers
supply the subsequent Linux and macOS landing measurements. These standalone
runs are local evidence, not five Linux load repetitions.

The T-1026 duration fixture keeps exactly 20,000 source rows and 256 rich
eight-line sections in eight distributed clusters of 32, including the existing
start/middle/end samples. Each plain section reuses seven short plain lines and
a blank paragraph boundary; it does not create one enormous unfinished paragraph.
The clusters retain dense 128-row windows with more than 256 decorations. The
fully rich recursive/context oracle is unchanged by this density reduction.
Additional workload guards require at least 150 root extensions, 256 Lua regions,
1,024 inline regions, 20,000 extraction/projection steps and 4,096 decorations,
alongside exactly 20,000 settled rows. Diagnostic totals quantify the margin over
every original per-slice cap. The RPC audit transfers each callback's assertion
fields once, retaining every observed slice and reused-parser receipt.

During T-1026 validation, temporarily raising each work/row/decoration cap in
isolation must still fail its original cap assertion on this fixture. Restore
the source after every targeted mutant; publish the original results and the
restored head's green file result together. These negative controls establish
that the shorter repeated syntax still pressures the deterministic limits.
