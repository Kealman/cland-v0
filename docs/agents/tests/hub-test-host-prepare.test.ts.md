# hub/test/host-prepare.test.ts

T2, in-process `projectHub` and real CLI entry point. No provider network, native
host, GUI browser or harness binary. Every root and CLI environment uses the
shared fixture seal. Run `node --test hub/test/host-prepare.test.ts` on supported
Node with inherited CLAND variables stripped. Run one light file at a time during
stage preservation work; respect the host load ceiling.

Cases:

- `pool prepare CLI publishes an image and then reports current`: C1.
- `pool prepare invalidates harnesses and names the changed part`: C2 harness pin.
- `pool prepare invalidates lock and names the changed part`: C2 lock bytes.
- `pool prepare invalidates provision and names the changed part`: C2 hook bytes.
- `pool prepare selects all configured pools and unknown pool names the choices`:
  C3 and C4 help.

Additional cases: `fake image build joins the configured build receipt and records its key`
proves the configurable build wait and persisted key; `pool harness pins use
renderer ids and exact release versions` rejects unknown ids and nonexact pins.

C4 authority evidence also lives in host-secret-admission's `C5 human revoke
closes host peers and refuses subsequent hellos` (remote host and session refusal)
and web-authority's `signed-in web refuses pool preparation`.
CLI completion is observed through the exited process and successful hub reply;
no elapsed-time readiness proxies. Companion regressions: host-provider-fake,
prepare-key, host-ssh-registry, cli-identity, cli-help and cli-help-pure (if present).
Stage QA can rerun these on the stage head using the same disposable fixtures;
no real DigitalOcean token or API is required. Report platform, Node and exact
head, and label any unexecuted heavy test as pending.
