# web/test/item-criteria.test.ts

`web/test/item-criteria.test.ts` owns T-1078's three card-edit seams and T-1105's
normalize seam, one Web case per criterion against one sealed scratch hub and
Headless Shell. C1 adds, edits and removes with `cland task view` readback,
preserving other ids and proving a removed id is not reused; fields exclude the
`Ck.` label and refused text retains its draft. Mixed legacy/explicit-id and
retained high-water fixtures keep id-less rows read-only until an Add receipt
supplies persisted ids; subsequent edit/done/remove CLI readbacks preserve the
untouched row's id, text and marks. The normalize case arms the two assigned
input rows before pressing the block's `Assign ids`, then reads both new ids and
the explicit row's marks back through `task.view`, saves an edit without an Add
frame and asserts exactly one `normalize` frame. C2 observes the rendered done
receipt and reads the `human` writer through the CLI, checking the outgoing
frame has no `as` field. C3 checks the available fields, read-only agents' text
and inert `e` outside the block, unchanged full item readback and absence of
other item write frames. Rendered acknowledgements are armed before actions and
retain final assertions; fresh contexts and observed browser/hub teardown use
the shared fixture.
