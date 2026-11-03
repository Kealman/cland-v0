# T-1650: users-mode remote regression evidence

Tests only; no product or shared fake API changes. Read T-1573 (6fbf5412),
T-1574 (b3b9330a), their users-mode cases and native card handlers. Both native
remotes expose `Already answered`; detailed hub refusal text is not exposed.

C1: `Discord users slash commands preserve invocation attribution and first answer across inbox copies`
checks both paired users' help, decision/question attribution, each invoking
channel's inbox copy and all four folds. C2: that case plus
`Discord users refuse a second paired approval answer and preserve every folded copy`,
the existing Telegram ask case and the paired approval case assert first-answer
identity/outcome, one answer request, final copies, exact refusal and one native
REST fold per copy. Telegram ask and Discord ask also count durable answer rows.
Conflicting second choices make accidental overwrite visible. Native callbacks
are observed with bounds; no fixed sleeps, processes, credentials or browsers.

The existing tiers.json entries assign both files T2 and include all their
new/generated identities; no manifest change is required. Existing fixture
owners join the hub, transport and async observers before project removal.

Local supplemental evidence on the candidate tree: darwin arm64, Node24.21.0,
local executor, no browser: 19/19 users-mode tests passed; both new Discord cases
under0.15s in the observed run. This excludes queued tiers and Linux/load proof.
Tier manifest lint passed. Final typecheck and source lint are recorded in the
review artifact; an intermediate frame-recorder type error was corrected. Source review and mode-free verification are
required separately; local timing is not the enforced load-budget receipt.

## Source review correction

A-16287 / rev-35-1650-source-1 found that native refusal acknowledgement precedes
owned-handler completion. All final assertions remain, now behind exact durable
Telegram update and Discord interaction completion markers. Each second press
holds its per-instance native API method after a successful acknowledgement,
checks that completion has not happened, releases and waits for completion.
Discord shutdown follows final assertions. Shared native-reply-hold owns a
bounded gate and cleanup release. discordCardsFixture's optional nativeApi flag
exposes its injected API without changing existing callers. Telegram's additive
/control/callback registers fresh callback IDs; raw /control/update stays intact.
No product code or processes changed. Corrected users tests19/19 pass locally;
source review and queued verification still pending. The earlier failed local
hold experiment reported `executor operation deadline reached` in two Telegram
cases because raw injected callback IDs are expired; the explicit fresh control
fixes this fixture setup without changing the existing expiry behavior.
