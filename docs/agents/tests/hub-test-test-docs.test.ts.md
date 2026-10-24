# hub/test/test-docs.test.ts

T1 reads the per-test index and repository documents, checks every indexed source and relative Markdown link, and preserves the historical tests.md anchors used by skills, briefs, READMEs and role clauses. It starts no hub or child process.

Index membership is order-insensitive and one-to-one: missing, duplicated and dangling Notes entries fail. Literal fixtures exercise each rejection and both row orders; the scratch Git regression reuses the same guard on union-merged indexes.
