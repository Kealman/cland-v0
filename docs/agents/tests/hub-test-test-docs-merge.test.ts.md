# hub/test/test-docs-merge.test.ts

T3 copies the shipped per-test documents into a sealed disposable Git repository, appends independent paragraphs to the palette and topics files on two branches, and performs a native merge. It retains the no-conflict assertion and both landed paragraphs. Every Git child has a bounded lifetime and a complete fixtureEnvironment; teardown waits for each command before removing the scratch root.

The parallel-addition regression copies the shipped `.gitattributes` into its scratch repository at the real documentation paths. Native merge, rebase and the exact `merge-tree --write-tree --name-only -z` invocation used by cland retain separate new documents, shared add/add guidance and shared existing-document extensions. Each merged index passes the same one-to-one membership guard without a follow-up edit; both branches’ paragraphs remain present.
