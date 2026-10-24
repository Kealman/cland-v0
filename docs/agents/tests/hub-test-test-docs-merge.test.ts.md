# hub/test/test-docs-merge.test.ts

T3 copies the shipped per-test documents into a sealed disposable Git repository, appends independent paragraphs to the palette and topics files on two branches, and performs a native merge. It retains the no-conflict assertion and both landed paragraphs. Every Git child has a bounded lifetime and a complete fixtureEnvironment; teardown waits for each command before removing the scratch root.
