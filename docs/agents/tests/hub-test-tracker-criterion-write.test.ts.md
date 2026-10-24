# hub/test/tracker-criterion-write.test.ts

`hub/test/tracker-criterion-write.test.ts` owns the criterion-write seams of
`task.criterion` at T2: one in-process `projectHub` with real socket edges and
the CLI as a subprocess only because the CLI is the subject. It covers done,
verify, fail, add, edit, remove and normalize, the role/claim limits of each,
the named-human CLI actor, malformed marks and fenced examples, conflict refusal
with its recovery source, capture/publication crash recovery, and the
`criteria normalized` event. Criterion parsing corner cases stay in
`hub/test/tracker-criteria.test.ts`, verdict-driven marks in
`hub/test/verdict-criteria.test.ts`, and the Web card in
`web/test/item-criteria.test.ts`; this file keeps the hub write contract only.

Normalization controls use three shapes. A mixed legacy/explicit-id body seeded
with `criterion_seq` gets ids for its id-less rows in list order above the
mark, keeps every other row's text and marks, persists the new sequence, and a
second normalize leaves the file and `updated` untouched. An item whose criteria
all have ids is a true no-op: no write, no `updated` bump and no event. A valid
hand-written file with quoted frontmatter, missing canonical fields, trailing
body spaces and repeated blank lines stays byte-identical after an all-ID
normalize, proving the no-op is the semantic answer (no id assigned) rather than
serialization equality with canonical output; this is the M1 regression from
the T-1105 source review. Start from a `task.create` body for canonical cases and
a raw `.cland/tasks` file before hub start for the noncanonical one.
