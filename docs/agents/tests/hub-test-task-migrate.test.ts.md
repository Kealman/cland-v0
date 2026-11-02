# hub/test/task-migrate.test.ts

Offline migration liveness uses the identity-free authenticated handshake probe,
independent of a parent shell actor or status permission. Keep the running-hub
refusal assertion under an inherited test-runner identity; no session claim
belongs on this read-only probe. Migration fixtures remain fully disposable.

Embedded hubs that interact with the native offline CLI carry captured `lockHostIdentity()` even with fake probes and harnesses. A synthetic fixture identity is a foreign holder to that CLI; keep the existing running-hub refusal assertions.
