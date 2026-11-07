# hub/test/host-destroy-native.test.ts

T3 native fake SSH/OpenCode destruction. Cases `C1/C2/C3 destroy settles native session after confirming deletion; tunnel down=false` and `tunnel down=true` prove reachable and disconnected destruction, exited rows, removed key, and two host-destroy log reads. The disconnected case closes the host and invalidates the pinned key while the worker remains live; ignoreDelete leaves the machine present and session fenced, then a second CLI destroy retries. Uses host-create-fixture.ts and joins all fixture writers before directory removal. Run under the preservation lock, without inherited CLAND_* variables or real provider credentials. The fake provider models machine deletion by its native absence receipt; fixture census cleanup stops physical scripted workers. No real DigitalOcean API, browser or Linux-container claim.

Run: `node --test hub/test/host-destroy-native.test.ts`.

`destroy joins an admitted held acquisition and prevents ready resurrection` holds
a provider acquire after its machine is durable but before its result reaches
create. Destroy checkpoints intent, joins aborted creation and confirms deletion;
no ready registration can resurrect. The old source returned incomplete before
acquisition joined (red). Twelve sequential load-scaled setup allowances plus
120 seconds for the fixed 30-second CLI behaviour bounds and cleanup size the
outer timeout; individual setup waits keep SETUP_MS and behaviour bounds remain
the harness's exact 30-second CLI limit.
