# hub/test/events.test.ts

Events subscription tests use the same frame seam: `events.test.ts` covers a
warning filter's first page and live rows beside an unfiltered client;
`connection-snapshot.test.ts` changes kind/subject filters without reconnecting,
checks inherited pagination and snapshot fallback, and verifies contiguous live
and replay cursors via row-free `model.advance` deltas. An omitted filter resets
the subscription; an explicit `events.list` filter overrides only that read.
