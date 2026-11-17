## Additive interaction selection (T-1454)

Batch reports also carry optional `t3` evidence: `mode: report`, proposed files
and a reason. Importing and individually unknown T3 files are listed only when
T3 is absent from the configured batch tiers. Scan failure is unknown (`files:
null`), rather than an empty set. This projection never changes the execution
plan, exit status or admission, including with `batch_interaction = run`. Older
reports without `t3` remain readable. The summary bounds examples to ten paths;
the persisted selection retains every proposed path and fallback reason.


For cland-runner candidates, `[merge] batch_interaction = "report"` defaults to
recording proposed additions without changing configured batch tiers or Web.
Explicit `"run"` executes those additions. Existing or generated configs omitting
the key inherit report; config set/reload uses the same parser. Task-verify
widening remains active. Changing the batch default to run is a separate item
based on recorded batch lines. No role permissions or clause lines are added.

Merge batches compare pinned member heads with the
prepared candidate and follow runtime imports through helpers and re-exports.
Importing or individually unknown T2/Web graphs add those files, retaining
configured batch tiers. Only unavailable scan machinery or phase-wide read/byte
budgets add the whole affected T2/Web phase. Per-file traversal exhaustion adds
that file. Unknown batch graphs never add unrelated T3/T4. Task verifies retain test
files hidden by first-parent dev merges plus roles/area guards. Unavailable or
over-limit task history retains full T1–T4/Web through final command planning.

The graph lazily uses TypeScript's parser, separately from the legacy tokenizer.
Literal import/export, import-equals, require and dynamic-import edges are
resolved, including calls in templates and escaped literals. Non-literal module
specifiers, escaping loaders, eval/Function/vm forms, parse errors, unavailable
TypeScript and unsupported source extensions remain unknown. Bounded direct
createRequire(import.meta.url)(literal) calls and const handles used only in
direct literal calls use the same resolution; other uses remain unknown.

Built-ins are external. A bare package is external only when an ancestor
candidate package.json declares a registry dependency (including dev, optional
and peer entries). The nearest declaring ancestor wins; workspace package names,
workspace/file/link/Git/path specs and undeclared names remain unknown. Candidate
manifests use the same immutable source reader; no live node_modules proof is
used. Missing browser/runtime support still determines whether Web actually runs.

Selection reasons name importer triggers and phase fallback causes;
interactionTests lists every added file; optional batchTests masks execute the
selected T2/Web files while preserving already configured whole phases. Legacy receipts
without that optional field remain readable; cache reuse requires the same set.
Shared graph reads are bounded at 20,000 reads, 32 MiB total, 2 MiB per file and
200,000 traversals per file; each parser walk is bounded at 200,000 nodes. Task history
accepts at most 1,000 merges, scanning 1,001 to detect overflow. This adds no
pass/fail gate or role permission. New precision claims require measurement of
both direct syntax and transitive graph unknowns on a disposable source copy.

### Project package-base scanning (T-1510)

The scanner also supports const createRequire handles based on
`pathToFileURL(join(root, '<literal directories>/package.json'))`, using exact
`node:path` join and `node:url` pathToFileURL imports. Only resolve calls with
literal names or a const literal for-of list are supported for these bases.
Candidate dependencies/devDependencies/optionalDependencies prove resolve-only
registry packages; peer-only declarations do not prove installation. Dynamic,
shadowed or escaping forms remain unknown.

See [the retained fallback baseline](../agents/interaction-scanner-baseline.md) and its selection regression guidance.

### Local verify admission preflight

For projects containing `hub/test/run-suite.ts`, `cland verify` (including
`--dry-run` and the `suite` alias) checks HEAD and the caller's worktree before
sending `suite.start`. It calls the same exported `lintSuiteCandidate` used by
hub admission: tier/duration manifest validation (the `test:tiers` checks) and
frozen test-lint policy, including missing or displaced lifecycle headers.
Failures retain the admission cause and file/line locations; tier failures also
point to matching manifest rows in the rejected HEAD or worktree source, named
in the diagnostic. Report-only diagnostics do not
block submission. Other project stacks keep their configured hub-owned checks.
Queue, cancel, classify and help do not run preflight. The hub rechecks admission;
local success supplies no execution or review evidence and changes no wire frame.

### Suite provenance footer (T-1460)

After final local or droplet collection, every hub verification log ends in one
`suite provenance` JSON record. It names the admitted `head`, verification `tree`,
`executor`, measured `platform`, `occasion`, candidate-reported browser `binary`
and `version`, and recorded skip reasons. Null means unknown or unexecuted;
null occasion means an ordinary request. A browser version probe is metadata,
not proof that Web tests passed. The candidate runner invokes only the pinned
test binary with `--version` in an isolated environment, without a GUI.

Cache reuse carries `cached` original-run provenance, preserves original machine
and browser observations, and does not claim fresh execution. Finalization streams
the completed log into an atomic replacement, removing predecessor/shard footers;
report retries keep one footer. Legacy candidates without browser receipts show
null browser fields. The skip-reason check is **report mode**: a missing reason
increments `skipReasonCheck.missing` and never changes exit status or admission.
Existing skip, timing, progress and summary records remain compatible.

Legacy receipts may share a log path. Provenance finalization serializes that
path through artifact publication, so each artifact captures its own admitted
head/cache footer before another receipt can replace it. Independent paths
continue concurrently; the collector joins pending finalization before teardown.

### Telegram album transcripts

Eligible audio members of a Telegram album use the configured speech provider
and duration cap, with one 90-second download/transcription deadline per file.
General receives one message with every accepted file and transcript sections in
album order. Each section starts with `🎤 <file name>` on its own line; failures
read `🎤 <file name>: transcription failed (<cause>)` and do not stop later files.
The first non-empty caption follows the sections. Provider-off, missing-key and
empty results retain the file with a failure section. Over-cap or duration-less
audio remains an ordinary attachment. Standalone recordings keep their existing
format. Both workbenches preserve filename-labelled album sections as body text,
including when only one file survives size/download filtering; standalone
recording markers still move to their headers. Native album
mappings and durable ingress receipts remain unchanged.

