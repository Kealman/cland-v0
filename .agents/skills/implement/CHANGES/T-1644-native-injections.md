# T-1644 forced native-boundary test edit

Coordinator message 366ab9de authorizes migrating only six stale OpenCode fault
injection points in adapter-native-boundary.test.ts after single-member batch
cbf4407c failed. Local red reproduction: 69 tests, 63 passed, six failed.

The Host owns a staging descriptor and uses appendFile, so the old writeFile
mocks no longer reached those effects. Creation and partial metadata faults now
intercept the actual staging FileHandle.writeFile; append faults intercept
appendFile. Concurrent-editor injection follows completed native staging bytes.
All assertions, test identities and production code are unchanged. This is a
forced test edit, added to the Host consumer inventory missed by the initial
migration. The entire native-boundary file is a required preservation check.

Coordinator 2b605f3c additionally requires per-case positive controls. All six
relocated cases assert an incremented injection counter while retaining every
original assertion unchanged.
