# hub/test/remote-docs.test.ts

The same wrapper imports `site/test/users-docs.test.ts`: source-only checks for
the Features links, all users-page headings, command/flag/config vocabulary with
invented controls, the scoped multi-user web section's exact controls, the
usage-derived five auth/user subcommands including duplicate/extra controls,
and setup/doctor descriptions. Run `node --test site/test/users-docs.test.ts`
for just these five cases. It imports no native module. The CLI walkthrough's
marked blocks share one extractor with the T2 users-docs-invite test; static
labels do not claim browser execution or passkey registration.

T1 imports `site/test/remote-docs.test.ts` into the existing hub suite. The site
test also runs in site's prebuild with only its own dependencies installed:
import only dependency-free CLI usage, and read the config template and
`SECRET_NAMES` declaration as source. The wrapper compares those extracted names
with runtime `configKeys()` (remote, speech and artifacts namespaces) and
`SECRET_NAMES` so extraction cannot drift silently. Keep the complete equality
check when expanding the site vocabulary, and run this importing wrapper locally.

The public source seam covers every backticked cland command and shell line in
Remote control and web-and-phone's Remotes section, dotted remote, speech and artifacts settings and
secret names. Keep the unknown-command/key/name positive control. Check the
Features sidebar group, both inbound links and the exact CLI-reference remote
and secret subcommand lists against usage, including extras. Run this file or
`node --test site/test/remote-docs.test.ts` alone; no browser or hub is needed.

T-1360's public catch-up paragraph is checked by
`remote guide distinguishes missed cards from outage replacements after 150 seconds`.
Keep missed cards/outcome edits after the gap distinct from replacement copies:
strictly over 150 seconds, every open card at the bottom with the press-again
note and old-copy marker without buttons; at most 150 seconds, no re-send of
already delivered cards. The wrapper imports this same case automatically;
no hub-only dependency is needed by the site's test.


The media guards check both pages for composer attachments and inline PNG, JPEG,
GIF and WebP, validate speech command environment names against its launcher, and
compare all three data-use lines byte-for-byte with `SPEECH_DATA_USE` read as
source. No provider runtime dependency is imported into the site's prebuild.

The source guard also requires the setup section to name the hidden ElevenLabs
key offer and the nonterminal secret command.

T-1443 extends the source seam to README's public secret/remote commands and
setup sections, including optional `--json` and an invented-flag positive control.
Both public remote pages name Discord media, voice, setup and local diagnostics;
the full guide distinguishes Discord fresh-Identify history (newest 500, oldest
first, replayed presses inert) from Telegram's 150-second card replacement rule.
Keep the built-in Discord factory/callback assertions in README so injection-only
wording cannot return. No platform calls or browser are involved in these guards.

The chat guard keeps typed ask-card answers Telegram-only. Discord typed replies
are topic messages; its buttons/modal and mapped voice replies answer asks.

T-1479 adds the landing carousel, root README feature summary and Features entry
to the source seam. All three name Telegram and Discord, General both ways,
ask/approval cards, photos, files, voice notes and local setup, with a Remote
control guide link. Keep the private-chat/server-channel scope and inspect claims
against `docs/spec/v0.3.md`; these source checks do not prove native transport.

## Site prebuild guards

The T1 entry in `hub/test/tiers.json` also imports
`site/test/onboarding-claims.test.ts` and `site/test/hosts-docs.test.ts`. Every mode-free task selection includes
this wrapper through whole T1, including docs-only and site-only changes; the
site prebuild still runs all site guards directly. The task-selection regression
checks the prebuild test inventory against the wrapper imports.

Onboarding keeps T-1274's accepted and rejected sentences unchanged. A condition
must qualify the committing Aide: current root Git write access or a harness
that can write the root. A later access condition does not excuse an
unconditional claim. Check each Aide subject separately: a conditional first
subject cannot excuse an unconditional second subject on the same line. A colon ends the subject clause, so the Coordinator's
commit is not attributed to an earlier mention of the Aide.

## Hosts, pools and logins

T-1833's `site/test/hosts-docs.test.ts` source contract runs through this shared
wrapper, not a separately registered wrapper. Keep the selection regression's
inventory assertion unchanged when adding a site guard. The hosts cases check
Features links and subject matter, command/flag vocabulary against pure CLI
help, pool/global keys against source declarations, defaults against the pure
pool parser and weight policy, and waiting/doctor/setup labels against emitted
source strings. Negative controls reject invented commands, settings and flags,
including partial flag spellings and keys in visible executable blocks.

Run `node --test hub/test/remote-docs.test.ts` and
`node --test hub/test/suite-task-selection.test.ts`. No browser, process fixture
or hub is needed. T-1833's original missing-page red had two failures and one
passing negative control; the first Linux verify also caught a missing shared
wrapper import, repaired without changing the inventory assertion. The T2
walkthrough is documented separately under `hub-test-hosts-docs-pool.test.ts.md`.
Closed-item wording T0 also scans the site Markdown docs against the tracker.

### Host pricing and CLI inventory

The same imported hosts file covers T-1834 C1–C3 with these generated names:

- `hosts price table dates public pool rates and computes default host-hours`
- `hosts storage table matches provider declared GiB-month rates without native imports`
- `CLI Hosts and logins lists exactly the built usage subcommands`

The first reads `agents` and `qa` sizes and the daily sub-cap from the pure
pool parser, compares the dated Regular Basic quote, and divides the built cap
by the table hourly quote to check the displayed host-hours. Both pool names
currently inherit the same size; neither is configured automatically. The second
reads the provider's storage declaration as text: never import that provider or
its native dependency graph into T1. The third derives the complete inventory
from HOST_USAGE and LOGIN_USAGE and compares the CLI section including duplicate
and extra-command controls. No API call, provider environment, browser or paid
resource is involved. These source contracts do not prove rendered browser layout.

For after-stage QA, run the shared wrapper above and read the Provider price
table on `/docs/hosts/` and Hosts and logins section on `/docs/cli/`. The public
Droplets, Volumes and Snapshots links record the quote's 2026-11-15 check date;
tests intentionally do not fetch mutable prices. Future quote refreshes check
those pages again. A storage discrepancy requires a decision from the item lead
before editing declared prices. The initial pricing red had two missing-content
failures; the initial inventory red had an empty list versus 16 usage commands.
