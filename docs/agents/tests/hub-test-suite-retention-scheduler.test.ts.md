# hub/test/suite-retention-scheduler.test.ts

Actual scheduler callbacks run on owned SQLite and filesystem fixtures behind
the shared counted native guard. Two eligible candidates beside 2,048 unrelated
artifact rows require two indexed title lookups and never artifactIndex.
The close rejection case holds an admitted artifact lookup, injects an earlier
cleanup rejection, and observes close only after the held filesystem owner joins.
All roots, callback continuations and seams belong to retentionCase, which keeps
the shared launch guard and filesystem seams until positive resource closure.
