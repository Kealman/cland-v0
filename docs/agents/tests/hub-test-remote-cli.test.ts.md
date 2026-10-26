# hub/test/remote-cli.test.ts

T2 uses sealed `tempProject`/`projectHub` and CLI subprocesses, with
`testMessenger` as the platform. Rotation uses the registered stdin/close owner
in `secrets-fixture.ts`; every token is fabricated and no platform call occurs.
Run this file alone with `node --test hub/test/remote-cli.test.ts`.

Approval checks the persisted code's name and numeric id for both messengers.
Status checks loaded token presence/fingerprint, pairing, client-reported
connection and exchange times, durable outbox depth, mute and a public bot link.
A legacy adapter without status proof reports disconnected; its missing test
callback refuses without stopping the adapter. Remote, attributed and unrelated
local clients cannot manage remotes. The authenticated web denial cases live in
`hub/test/web-authority.test.ts`.

Test sends check the client even without a pairing and send exactly one fixed
line to the current stored destination when paired. The error control injects a
fabricated token, checks the exact sanitized frame error, disabled state and
healthy other messenger, then inspects the drained log/journal. The held test
registers its release owner before starting the hub, arms bounded setup before
the action and retains actual platform completion before accepting hub shutdown.

Both rotation cases use `cland secret set` through stdin and `cland hub reload`.
They retain the old client's stop, replacement frame exchange, changed
fingerprint, exact numeric pairing, mute state and the replacement client's
actual test-line receipt. A new pairing applies the loaded `mute_default` once;
rotation does not reset it. The older-hub fake keeps the previous `{pairing}`
approval shape and rejects unsupported management frames, proving a current
CLI reports the old refusal instead of assuming new reply fields.

Changing the wire union also requires `npm run test:nvim-fixtures` and
`nvim/test/scenarios/workbench.test.ts`. Keep `hub/test/cli-imports.test.ts` and
`hub/test/project-hub-lifecycle.test.ts` green: remote management remains a lazy
CLI module, and active tests drain before the gateway releases its store/lease.

The legacy-hub fixture registers listening, error, native close and peer-close
observers before binding. Its setup is abortable with a one-second injected-clock
deadline; close, peer streams and discovery writes drain under independent
one-second live bounds through the same idempotent disposer. Missing-listening,
aborted-setup and native-bind-error controls retain actual listening/closed,
empty-peer and drained-writer receipts. The missing-receipt negative control
fails under its independent 1.5-second live bound if the setup deadline is removed.

The name-collision rotation regression stores a new opaque token equal to the
already-paired display name. The callback must receive a masked name and the
unchanged numeric destination. A subsequent token equal to a numeric id must
refuse before invoking the client; its diagnostic and drained log/journal remain
safe. Keep this content-versus-routing distinction in the test callback as in
pairing issuance and replacement notices.
