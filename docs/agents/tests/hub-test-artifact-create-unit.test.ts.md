# hub/test/artifact-create-unit.test.ts

T1 calls the public `createArtifact` module boundary with an in-memory SQLite
`Store` and scripted asynchronous filesystem operations. It uses no hub,
subprocess, browser, live project paths or wall-clock waits.

Two calls start before either file write can complete. The historical code
prepares both paths with A-1 and fails registration with `artifact reservation
moved`. The regression requires both returned promises to fulfill, distinct
registered ids, exact bytes, both publications and no unregistered prepared paths.
Serialization belongs to `createArtifact` per Store, so suite-child and batch
uploads share it even when they bypass the dispatcher's tool queue.

The refusal case queues two same-title creates, rejects the first publication,
and requires the second to reuse A-1 only after cleanup. Its exact path and bytes
must be the only retained file and index entry. Existing T2 artifact tests retain
real-filesystem, topic-authority and send-limit coverage.

Run `node --test hub/test/artifact-create-unit.test.ts`. The scripted filesystem
methods restore their built-in ESM bindings after each case.
