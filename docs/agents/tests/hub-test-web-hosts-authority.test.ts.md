# hub/test/web-hosts-authority.test.ts

T2: `node --test hub/test/web-hosts-authority.test.ts` on supported Node.
Uses projectHub, an authenticated HTTP link/cookie WebSocket, FakeClock,
injected sign-in handles and a directory-only FakeHostProvider. No browser,
real provider or harness credentials. The fixture owners drain the hub before
closing storage and deleting roots.

Generated cases:
- `web add codex returns its persisted card before completion`
- `web signin codex returns its persisted card before completion`
- `web add claude-code returns its persisted card before completion`
- `web signin claude-code returns its persisted card before completion`
- `web login reads reach local handlers and forbidden host and key frames name their rule`
- `users-mode web host actions audit the transport-resolved user in log and journal`
- `every host and login frame refuses sessions and messenger ingress`
- `web snapshot and removal retain the local success shapes and durable storage receipts`

The result identifies an already persisted login-signin-code card. Claude's
captured write handle observes the answer before durable ready; Codex's close
receipt drives ready without an answer. The legacy local reply is compared for
list and failure cases. Snapshot/removal prove stored snapshot and confirmed
provider absence. Audit checks independently read both log and journal user ids,
including failed actions, ignoring caller-supplied identity fields.

`hub/test/host-stop.test.ts` additionally runs its confirmed and incomplete
fake deletion scenarios through authenticated web as well as local ingress,
retaining exited-session, lease and disk-release assertions. Native runner proof
lives in `hub/test/login-card-signin.test.ts` under the preservation slot; it
covers card-native linkage rather than the web transport. Stage QA can repeat
these cases on dev without opening a GUI or using a real provider.

Extra-field controls: `web add projects declared fields with hidden renewal mode: existing true` retains the signed-out Codex disk and refuses a duplicate add; `existing false` creates a new Claude disk and verifies the persisted intent contains only declared public add fields. Both send hidden signin/type/id/extra properties; only the explicit login.signin path selects internal renewal mode.
