# hub/test/cli-session-credential.test.ts

T2 uses a sealed `projectHub`, in-process harness adapters and the real shell CLI.
Launch two independent sessions and take each credential from its own adapter
request. Assert attribution through `task.view` comment receipts, and refusal
without any additional write for missing, invalid or unowned credentials. Use
raw clients from `harness.ts`; the authorization-fixture wrappers deliberately
provision credentials and are unsuitable for these admission checks.

Pin the identity-free human path and own MCP path independently. Restart the hub
on the same disposable store and prove native resume and relaunch preserve usable
credentials, rotating on relaunch. A pre-upgrade Coordinator database has no credential table: after restart its own spoke reconnects and the same tokenless CLI writes as that Coordinator without a relaunch. Pin file identity, private mode/owner, invalid-env-no-fallback and archive directory cleanup. Check errors, logs and public replies with boolean containment
assertions, so even a failing assertion never prints credential values.

A freshly launched onboarding Aide must run its first raw CLI using the token
from its own adapter request before its spoke connects. Its fallback file does
not exist yet. After the own credential-ready welcome, repeat a CLI write with
ID/name and no token, assert the 0600 file and both author receipts, and check
that logs contain no credential. Keep this admission test outside synthetic
authorization wrappers.

A second pre-upgrade fixture retains the launch token already present in the existing shell/MCP environment but removes the old credential table. Reconnect must adopt that accepted own-spoke token before testing the unchanged shell; minting a replacement would incorrectly invalidate its explicit environment.
