---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
metadata:
  origin: "mattpocock/skills skills/engineering/implement at 6d6a5b90; MIT, Copyright (c) 2026 Matt Pocock"
  changes: "CHANGES"
---

Implement the work described by the user in the spec or tickets.

## Merge-delta advisory comments

The hosting hub records clean reviewed-head/dev merges as report-only item
comments with path and shared-import-graph facts. The conservative rule treats
runtime/config/test/generated changes as potentially coupled. Unknown graph
facts are explicit. `patchIdCurrent` is freshness eligibility, not a gate receipt.
These comments never replace the Reviewer's merge-delta review before the next
verification under rule 11; existing patch-id carry-over stays unchanged. See
`hub/README.md`, "Merge-delta assessments (report mode)". No role clause changes
or additional permissions are needed.

Claude Code's managed Bash `PreToolUse` guard refuses computed rm/rmdir targets
(command substitutions, named variables and xargs) before native approval stalls
the session. Read its reason, print the path if needed, and retry with every path
written literally. Init/update install it for hand-started sessions when `cland`
is on PATH; hub launches/relaunches inject it. Literal paths, `git rm` and heredoc
bodies pass; the guard needs no running hub.

When working as a custom role, read `docs/agents/session-permissions.md#custom-roles` for the own-claim review/verification path and route completion to the Coordinator.

When editing a kept upstream skill, append the change and item as a new line in its sibling `CHANGES`; keep `metadata.changes: CHANGES` stable.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

For task CLI syntax, use `cland task <subcommand> --help` (or `-h`)
immediately after the subcommand: it prints its forms and shared options without
requiring a hub or valid project configuration.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

For binary human uploads, use `docs/agents/tests/hub-test-artifact-upload.test.ts.md`.
Keep bytes beside native frames, authority before ingress replay, and all files plus
one human message in the shared artifact queue and store transaction. Sessions have
no upload authority; refuse every MIME on exact registered-secret bytes through
the shared registry and preserve accepted bytes. Existing role clauses need no
additional permission lines.

For Discord REST pacing, use the loopback client/fake and production-frame seams
in `docs/agents/tests/hub-test-discord-api.test.ts.md` and
`docs/agents/tests/hub-test-discord-messages.test.ts.md`. Inject the same clock
into client and fake; assert native posts plus durable mappings. Keep callback
and original-response edits outside lanes, preserve the unchanged enforced nonce
on bounded native retries, carry the original attempt’s absolute nonce deadline
through every queue/wait and check it immediately before I/O, and drop definite
invalid requests without replay. Use the pre-registered exchange owner for
fake-clock native operations and preserve learned-bucket ownership through body
completion. Store-bearing exchanges use the owner’s project allocator and
successful-drain removal barrier for ordinary and signal cleanup; retain roots
and Stores after incomplete drainage until the real writer settles.
Existing role clauses cover this flow; no permission line is added.

For gateway routing, authority or remote failure isolation, use the sealed frame-protocol and
test-messenger seam in `docs/agents/tests/hub-test-gateway.test.ts.md`. Keep
authority before replay/actor resolution and resolve reply topics from stored
messages. Platform clients use the gateway's frame port, never a hub credential.
Messenger provenance is trusted per-request metadata, not a frame field; keep
remote messages, ask outcomes, approval outcomes and fallback denial notes in
step. Preserve optional-source compatibility for old ask outcomes; the headless
workbench regressions are `web/test/remote-via.test.ts` and
`nvim/test/remote-via.test.ts`.

For project secret storage or CLI input, read `docs/agents/secrets.md` and use
the T1 stream, T2 startup/CLI and native Git seams in
`docs/agents/tests/hub-test-secrets.test.ts.md`. Share `resolveSecrets(root, env)`
for hub/provider values (environment overrides win);
use `readSecretsFile(root)` for file-only CLI reads and edits. Filter all four remote
secret environment names with `withoutExecutorCredentials` after child overlays,
including the speech command launcher. Keep values in stdin or the private file
and diagnostics limited to fixed reasons.
Preserve custom ignore bytes and require a final literal secrets rule before
input. For validation, rotation registration or remote/speech output, use
`docs/agents/tests/hub-test-gateway-secrets.test.ts.md`: one project-owned registry
and the shared validation/registration boundary before provider activation. Use
the fixture's registered close/output barrier before root removal.
Import credential code inside daemon startup and reuse its resolver closure on
reload, passing the daemon environment and registering before gateway activation.
Keep `project.ts` import-free; preserve the CLI import budget and startup receipts.

For the speech seam and ElevenLabs transport, use the T2 loopback/fake-clock
boundary in `docs/agents/tests/hub-test-speech.test.ts.md`. Pass the project-owned
redactor and resolved key to the provider and the same registry to `transcribeNote`;
keep the original bytes, one note deadline, bounded attempts and only transient
retries. The fake records key presence only. Existing role clauses cover this
boundary; add no permission lines.

For command speech or provider selection, use
`docs/agents/tests/hub-test-speech-command.test.ts.md`: sealed test-written Node
scripts, literal argv, original stdin, the final credential filter, bounded
redacted stderr and native close after deadline escalation. Use `speechProvider`
with resolved secrets and the project registry; commands opt out of retries and
receive the whole note deadline. Existing role clauses cover this boundary.

For remote/speech configuration or reload, use the template/writer and frame/CLI
seams in `docs/agents/tests/hub-test-config-set.test.ts.md`. Inject
`gatewayMessenger` with the test messenger, resolve secrets inside the daemon,
and observe start/stop completion before claiming reload applied. Keep the
legacy `gatewayRemotes` seam and CLI import budget unchanged.

For setup's remote offer or hidden question, use the scripted runner and real
frame/fake messenger seams in `docs/agents/tests/hub-test-setup-remotes.test.ts.md`
and `docs/agents/tests/hub-test-setup-remote-component.test.ts.md`. Reuse secret
input/preflight and the config-set writer; release each terminal reader before
the next question. Keep nonterminal untouched `skip`, partial `open`, default-No
offers even with `--yes`, and pairing readback before `ok` or `done`. Setup
pairing uses the local CLI/fake Bot API seam in
`docs/agents/tests/hub-test-setup-pairing-component.test.ts.md`: inject Start
during the pause and observe its durable offset before reading the waiting row;
confirm its identity before approval, keeping no-code waits bounded and declines open.

For workbench remote state, use `docs/agents/tests/hub-test-remote-workbench.test.ts.md`,
`docs/agents/tests/nvim-test-remotes.test.ts.md` and
`docs/agents/tests/web-test-remotes.test.ts.md`: production Telegram, fake
Bot API, safe frame projection and the actual rendered headless rows. Keep
`sessions.remotes` optional, the prior hello/snapshot regression and local status
credentials/routing out of `remote.state`. Connection/pairing/mute changes are
immediate; only depth changes coalesce. Raw positional socket consumers explicitly
consume the connect event before their result. No new keys or role permissions.

For web composer file uploads, use the sealed HTTP/frame and isolated Headless
Shell seams in `docs/agents/tests/hub-test-web-upload.test.ts.md` and
`docs/agents/tests/web-test-uploads.test.ts.md`. Admit cookie/Host/Origin before
bytes, bound multipart wire and per-file sizes, and pass byte views beside the
web conversation’s artifact.upload frame. Transfer the private HTTP buffer through
trusted transport metadata; native callers keep a protective copy. Revocation and
edge close fence commit and join upload writers/rollback before returning. Register
request/control ownership before POST, bound exceptional drainage separately from
setup, and keep omitted/aborted setup controls. Keep existing artifacts optional for
old clients and restore failed file drafts in memory. No new role clause or key.

For web artifact image previews, use the sealed Playwright seam in
`docs/agents/tests/web-test-artifacts.test.ts.md`: observe decoded natural width,
the inclusive size boundary, folder children and download fallbacks.

For remote terminal commands, token rotation or messenger status/test callbacks,
use `docs/agents/tests/hub-test-remote-cli.test.ts.md`; retain lazy CLI imports,
legacy optional callbacks and previous-hub refusal coverage.
For public remote documentation, use `docs/agents/tests/hub-test-remote-docs.test.ts.md`
and `docs/agents/tests/hub-test-remote-docs-pairing.test.ts.md`: keep site-only
dependency isolation, vocabulary checks, executable pairing blocks and README's
built-in Discord and dual-messenger media/history checks in step.
For doctor's remote diagnostics, use
`docs/agents/tests/hub-test-doctor-remotes.test.ts.md`: local secret resolution
and Unix status frames only, with the shared General cause/fix table and optional
`stopCause` compatibility. Prove native Telegram stops at the liveness seam;
Discord structured test stops do not claim native transport coverage.

For Telegram Bot API or native messenger changes, use the T2 loopback/fake-control
and production-factory frame seams in
`docs/agents/tests/hub-test-telegram-api.test.ts.md` and
`docs/agents/tests/hub-test-telegram-messenger.test.ts.md`. Reuse secret validation
and the project redactor before constructing a token-bearing URL; keep raw fetch
errors inside the client. Arm held-request observers before triggering and join
native close receipts. The fake registers cleanup before bind; use its bounded
control helper and setup/close receipts. Forward the gateway's optional start
lifetime signal to startup I/O. Preserve explicit factory and legacy remote injection.
For Telegram media transport, the same client/fake seam covers `getFile`,
capped streaming `download`, `sendPhoto` and `sendDocument`. Keep token URLs
inside the client. Use `/control/media` with synthetic bytes or declared sizes;
a held-open chunked download must close at the byte cap. Upload captions are
plain FormData text (CRLF newlines), without entities or parse mode.
For card API calls, use the same client/fake seam and `/control/press` with explicit
chat/message ids, zero-based row/column and human/stranger identity. Observe the
queued callback before advancing the injected clock past 150 seconds. Keep
callback data within 64 UTF-8 bytes and use one button per row. Send ForceReply
as a separate prompt with `reply_parameters`; it can never be edited. Outcome
edits remove buttons with an empty inline keyboard and preserve the sanitized
`message is not modified` description. Callback acknowledgements go directly
after the hub stores the answer, outside the outbox. Preserve existing send
failure classes and test token-free receipts and echoed faults for both new calls.
For Telegram polling or update handlers, follow the filtered registry and durable
confirmation contract in `hub/README.md#telegram-polling-and-durable-confirmation`
and the component/crash guides in `docs/agents/tests/hub-test-telegram-polling.test.ts.md`
and `docs/agents/tests/hub-test-telegram-polling-restart.test.ts.md`. Inbound text,
replies, feedback and lost-result replay use `docs/agents/tests/hub-test-telegram-inbound.test.ts.md`.
Attach handlers to the registry; keep native identity/recovery outside frames,
reconcile feedback with durable session stages, and join replay-safe handlers on stop. Keep dedicated handlers before the terminal unsupported-input fallback; confirm unmatched input and retain its content-free id/kind diagnostic.
For abandoned Telegram fixture setup, retain the early native-close observer
but start its drain deadline at disposal; acquisition has a separate bound.
Keep the inbound omitted/aborted delayed-setup controls and their exact native
close, stopped writer, closed Store and zero observer/timer assertions.
For 📥 notices and plan/TUI General-reference routing, use
`docs/agents/tests/hub-test-telegram-notices.test.ts.md`; preserve the gateway's existing authority.
For Telegram liveness, use the production-factory/frame and fake-clock controls in
`docs/agents/tests/hub-test-telegram-liveness.test.ts.md`. Observe native poll close
at timeout plus 15 seconds, including zero-timeout offline polls. Preserve the
60-second 409 grace without signalling another token consumer; fatal 401/403/409
notices use `remoteNotice` and the project redactor, then the existing disable path.
Retain authenticated web service and unchanged-reload recovery for failed enabled
clients; configuration-disabled clients stay stopped. Existing role clauses cover
the same remote isolation and secret boundaries without new permission lines.
For Telegram catch-up, use the production frame/fake-clock receipts in
`docs/agents/tests/hub-test-telegram-catchup.test.ts.md`. Start an outage while
the scratch hub serves, keep the exact three-minute notice boundary and one
recovery, annotate retained input before store/confirmation, and send a gap
only above zero after input catch-up. Use
`docs/agents/tests/hub-test-telegram-gap.test.ts.md` for source deduplication,
held-send arrivals and stable-key recovery; acknowledge only the captured ids
on the matching send receipt and preserve the unknown-delivery fence.
Keep recovery joins scoped to an active outage: a healthy command's next-poll
confirmation must not await later ordinary queue work. Retain the existing
command-priority/own-receipt regression when changing these hooks.
Keep optional native callbacks compatible;
no frame or role authority expansion is needed.
For native Telegram `/start`, blocked membership and disabled bot-link facts, use
`docs/agents/tests/hub-test-telegram-pairing.test.ts.md`. Keep injected handlers
first; fatal membership records its sanitized cause/General notice before
consuming the update, so restart does not replay a kick.

For outage card replacement, use the frame/fake controls in
`docs/agents/tests/hub-test-telegram-cards.test.ts.md` and its approval counterpart.
Hold automatic cards, edits and their fallbacks until retained input and the gap
settle; keep explicit commands, callbacks and feedback progressing. Measure the
strictly-over-150-second boundary from the durable outage start to the first
recovered exchange, excluding queue pacing. Persist replacement identities and
old-copy ids before sends; retire old buttons only after the new native map.
Require the native edit receipt as well: a delivered fallback reply leaves the
original buttons intact and records incomplete retirement. Reconcile held
publication waiters on recovery's durable closed-source drops while still live.
Capture those waiters with the resumed lane snapshot; later sends on new lanes
must settle from their own receipts. Retain the pacing/reopen consumer controls.
Keep later all-copy outcomes and `/inbox`'s original live buttons. Unknown sends
and old-copy repairs stay fenced/incomplete while later recovery progresses;
an interrupted stop must retain the outage. Existing role clauses cover this
flow; add no command, frame field or permission line.

For Telegram ask cards, use the frame/fake seam in
`docs/agents/tests/hub-test-telegram-cards.test.ts.md`. Keep the card model
messenger-neutral and the Telegram renderer shared by sends and outcome edits.
Bind opaque keys to the mapped ask and chat, preserve every label, and clip only
the question at a word boundary with the full-question marker and outcome space.
Commit native callback identity with the answer before direct callback I/O,
defer publication/delivery until commit, and confirm the offset afterwards.
Treat a definite expired-press acknowledgement as terminal after the saved
result, while transient callback failures retry it. Keep the lost-result restart, cross-ask/unissued keys,
not-modified/failed-edit controls, and all four send-failure classes. Prove
Neovim/web outcomes, withdrawn/cancelled cards, departure-only declines, both
orders of the answer race on every mapped copy, and closure during an in-flight
send. Own authenticated web fixture HTTP/socket acquisition before the hub,
and retain missed/aborted setup plus native close/drain controls. A queued never-left card whose ask closes is dropped; unknown sends keep
their replay fence, while edits remain eligible. Test latest unattempted keyed
edit merging and priority ahead of General through the fake API. Existing
role clauses already cover the gateway authority and secret boundaries; add no
clause lines. Other/Decline use separate immutable ForceReply prompts after the
callback acknowledgement. Keep durable prompt/mode/next-text selection and exact
input routing across restart and lost results; prompt maps have no editable ask
id. `/cancel` clears only the wait and keeps the ask open. Explicit prompt/card
replies target their own ask, options-only replies require a number, and closed
asks consume no General message. Reuse inbound stored/delivered feedback;
feedback failures retry the saved answer rather than becoming stale-input notes.
An unknown prompt send records incomplete publication and releases the callback
cursor without retransmission; consume unmapped explicit replies with a note,
never quoted-text authority or a General post. Prove native accept-disconnect,
restart, reply/cancel and later-input progression. Confirmed answer feedback
recovery follows the messenger-scoped gateway.answer receipt to the current
message/stage; keep ordinary-id lookup, other-messenger isolation and prior-wire
refusal. A pre-offset replay alone does not prove confirmed-input recovery.
Known closures return Already answered without a hub frame and repair stale
buttons; retain saved callback receipts and callback-id dedupe across restart.
An unknown stale-repair fallback stays fenced and incomplete while the closed
callback cursor and later input progress; retain its accept-disconnect control.
Only bot-authored mapped cards admit a foreign press for a private show_alert
refusal with no hub frame or ask/card change. Keep other foreign input silent.
Late unthreaded text reaches General marked late and keeps the prompt wait;
explicit replies target only their own open ask. Retain the interrupted late
feedback/restart and silent non-card/forged-author controls in the card guide.

For Telegram approval cards, use the production-frame/fake-platform and scripted
native seams in `docs/agents/tests/hub-test-telegram-approvals.test.ts.md`.
Keep ask/approval keys and maps distinct, offered styles/choices, bounded command
and denial-note previews, and durable native outcomes before callback/offset.
Retain cross-kind substitutions, component lost-result replay, all-copy harness
closure and source-closed versus uncertain-send controls. Both headless inboxes
must show approved Codex and denied OpenCode outcomes via Telegram. Outgoing
hub frames may mask harnessId/attach metadata; incoming frame routing remains
strict. Preserve the native OpenCode producer regression and gateway-secrets
refusal. Apply the same known-closure/no-frame, private foreign refusal and
unknown-repair cursor handling to approvals. Typed approval replies only get
use-buttons/closed notes and never borrow an ask prompt; unknown note sends
stay fenced/incomplete while input progresses. Retain approval stale/foreign
restart, late prompt isolation and both accept-disconnect controls.
These are existing human actions with no added role-clause lines.

For Telegram phone commands or menu registration, use the sealed production-frame
and fake Bot API seam in `docs/agents/tests/hub-test-telegram-commands.test.ts.md`.
Keep status/inbox reads within gateway authority, force text/entities for replies,
compare the actual private-chat menu before writing, and fence native command
identity before queued sends. Keep replies at ordinary priority and preserve
entities, contiguous numbered parts and durable accepted ids. Preserve the committed-effect/lost-receipt restart
control. `/inbox` uses the card handler's shared renderer, maps live copies of
every open card and notice, and orders the combined publication by since/id.
Keep earlier buttons working, all-copy outcomes, pairing exclusion and the
one-line empty reply. Resend jobs use command-scoped keys under the existing
native command fence; preserve the unknown-resend restart control.
Draft cancellation state belongs to the card handler.

For Telegram General rendering, use the production frame/fake receipts in
`docs/agents/tests/hub-test-telegram-rendering.test.ts.md` and the T1 conversion
boundary in `docs/agents/tests/hub-test-telegram-render.test.ts.md`. Keep rich
Markdown free of automatic entity detection and previews, preserve plain text
on conversion failure, and budget numbering plus the header before splitting
by code points or entity count. Never clip an entity; retain UTF-16 offsets.
Wait for every accepted part's durable source mapping before shutdown.
For Telegram pacing, use `docs/agents/tests/hub-test-telegram-pacing.test.ts.md`:
every send uses the shared per-chat outbox, cards first, with one-second pacing
and a bot-wide 429 hold capped at five minutes. Delivery reactions share that
queue and ordinary priority; keep their existing inbound feedback/recovery bits
and complete each transport operation from its own durable settled receipt. Drive fake time after durable
attempt/accepted-map receipts. Only a rich 400 falls back; 429 retries the same
request, 401/403 stop the remote, and network/5xx/missing receipts stay fenced.
Persist absolute bot-hold and chat-start facts across adapter recreation.
Recheck current pairing at actual send/recovery, reserving bypass only for an
explicit pairing reply or old-chat notice. Commit all fallback parts and their
superseded proof together; retain definite-400 recovery if planning is interrupted.
Pre-own fixture Stores, setup and every recreated adapter before awaiting them.
Arm setup bounds before native acquisition; release held startup I/O before
joining it and stop any late hub before closing storage.
Preserve old Outbox clients without scheduling options and join every drain on stop.
Retain the rich 401/403 fatal controls in the Telegram liveness guide.

For Telegram mute, use `docs/agents/tests/hub-test-telegram-mute.test.ts.md`.
Count eligible General sources before rendering, keep hub notices and card paths
outside the gate, and apply `mute_default` only at a new pairing. Commit command
effects with chat/message-id receipts before external reply I/O; preserve the
post-commit/pre-offset interruption regression and fence uncertain replies.

For pairing codes or local approval lookup, read `docs/agents/pairing.md` and its
T1 service/T2 frame seams, including approval authority and replacement drainage. Keep `Inbox.pairings` optional for older hubs, and
strip pairing rows and counts at the remote boundary. Trusted pairing callbacks
invalidate read replay at persistence, before coalesced inbox publication.
Workbench pairing rows use `docs/agents/tests/web-test-pairing.test.ts.md`:
the sealed Web fixture and real headless Neovim share one hub with fake messengers.
Keep pairing entries in Asks and approvals; Neovim's card alone binds its approval
key, while the web offers selectable local command text. Remove departed codes
from retained visits and split detail pages on the authoritative snapshot, and
keep inboxes without the optional `pairings` field readable. Existing role clauses
already reserve pairing approval to Neovim and the terminal; add no clause lines.

For remote persistence and poller ownership, use `Store.remotes` on the existing
hub.db handle, with platform ids kept as strings/TEXT. The T1 storage/lease seams
and T2 frame/restart/stop receipts are documented in
`docs/agents/tests/hub-test-remote-state.test.ts.md`,
`docs/agents/tests/hub-test-remote-state-migration.test.ts.md` (T2 native DDL trace),
`docs/agents/tests/hub-test-poller-lease.test.ts.md` and
`docs/agents/tests/hub-test-gateway-state.test.ts.md`. Use fake native process
facts and fake time; retain live or unreadable holders, and release a lease
only after positive remote stop receipts. Never signal a token consumer.

For remote outbox changes, read `hub/README.md#durable-remote-outbox` and use
`docs/agents/tests/hub-test-outbox.test.ts.md` for client proof/attempt receipts,
`docs/agents/tests/hub-test-outbox-gateway.test.ts.md` for outage and source
closure through frames. Keep immutable attempted payloads, stable job identities
and the unknown-delivery fence. Re-read queue arrivals within the active drain;
use injected Clock/random for capped retryAfterMs and reconnect equal jitter,
with no independent hub timer loop. Keep legacy clients optional-field compatible;
stop cancels delays and aborts/joins reconnect before releasing storage.

For hub shutdown changes, use the real-process receipt tests described in `docs/agents/tests.md#implementer-test-selection`, including held fake-provider mutations and late-resource reconciliation; interpret `hub stop`'s released-lock/live-PID diagnostic and signal cleanup deadline through `hub/README.md`.

Reservation-lock shutdown uses the cheaper T1 ownership and T2 `projectHub`
seams in `docs/agents/tests/hub-test-executor-lock-liveness.test.ts.md` and
`docs/agents/tests/hub-test-executor-admission-lock.test.ts.md`. Join a late lock
acquisition before rejecting cancellation. Keep shard-release intents durable
through shutdown and prove next-hub settlement; no new process is needed for
these local wait boundaries.

For OpenCode Console login diagnostics, use the injected auth-list seam in
`docs/agents/tests/hub-test-doctor-harness-probe.test.ts.md` and the scripted
native failure seam in `docs/agents/tests/hub-test-opencode-native.test.ts.md`.
Keep default-store and selected-database logins separate; report the printed
standalone login command without reading or copying the human's credentials.

For PID ownership changes, keep legacy `pidStarted` fields alongside additive
`pidIdentity`. Stop, rollback and cleanup require native birth proof: Linux
boot-id/start ticks or macOS microsecond kinfo birth via the OS Perl syscall
bridge. Legacy rows upgrade once after a coherent matching lstart/native
observation, persisting proof before signalling; same-second reuse before that
first observation retains the previous risk. Mismatch/unreadable proof never
grants a signal or exit receipt; preserve live writer roots. A final native Linux
Z/X or Darwin SZOMB receipt establishes exit without signalling; keep uncertain
listed descendant branches until captured or refused. Parent PID reaping is a separate boundary. Test cleanup rechecks listed
descendants of a natively exited parent against their own captured births;
gone or changed births settle, while live or unreadable descendants retain the fixture. Use the
parser/persistence, native listing and
same-second signal seams in `docs/agents/tests/hub-test-process-identity.test.ts.md`
and its linked T3 files. Inject processStarted, processIdentity and coherent
processRows for synthetic-PID fixtures, including one-time migration checks.

For adapter shutdown, preserve both synchronous and promise-returning `close`
implementations. Drain transient native CLI callbacks before releasing storage;
use the scripted close/drain regression and held real-query resource check in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md` and
`docs/agents/tests/hub-test-scenarios-hook-bridge.test.ts.md`. Fence late resume
and identity-probe results before restarting supervision; use the held-result
matrix in `docs/agents/tests/hub-test-lifecycle-serialization.test.ts.md`.
For Claude Code crash regressions, follow
`docs/agents/tests/hub-test-claude-code-adapter.test.ts.md`: advance the injected
clock inside the bounded exited-row wait; one advance is not an exit receipt.

For Claude poll authority, use the 37-second scripted regression in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`; cover both pushed
idle delivery and the no-push unknown launch.

For Claude delivery confirmation, require the exact envelope-bearing turn-start;
the legacy mod `injected` frame proves submission acceptance only. Use the
re-exec bridge regression in `docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`
and the fake-clock alarm routing in `docs/agents/tests/hub-test-inject-stalled.test.ts.md`.
Coordinator alarms reach General and named Aides after five minutes of failed
confirmation; recover with the named session's `cland session resume <name> --relaunch`.
Codex injection alarms also wait for a fixed 120-second grace from the hub's
serving receipt (initialization time does not consume it);
use `docs/agents/tests/hub-test-codex-delivery.test.ts.md` for the scripted
app-server confirmation, startup anchoring and post-startup timeout regressions.

For local verification cancellation or compatibility recovery, use the sealed cancellation, recreated-root quarantine and blocked-queue seams in `docs/agents/tests.md`. Observe exact descendant death before root cleanup; retain the quarantine journal's old/new inodes and next-run admission receipt. Live machine locks are outside the fixture.

For inherited-stdio cleanup, follow `hub/README.md#inherited-stdio-writer-ownership`
and the fast-exit/denied-census controls in `docs/agents/tests/hub-test-suite-timeouts.test.ts.md`.
Keep reciprocal endpoint and native birth proof, restore stream reads after duplication,
and preserve unknown-writer warnings. Existing role permissions cover this cleanup.

For hung verifier fixtures, use the real-runner PID receipts and early-failure
controls in `docs/agents/tests/hub-test-suite-timeouts.test.ts.md`. Register
cleanup before the fixture closes its clients, cancel through the owning
verifier and wait for its terminal receipt before removing roots. The deliberate
phase-sweep leak is in `docs/agents/tests/hub-test-suite-runner.test.ts.md`;
parent emergency ownership must not substitute for the sweep's cleanup receipt.
For suite identity or lifecycle fixtures, take the worker from `launchWorker()`
before `hub.stop` or a saved-job edit (`docs/agents/tests/hub-test-suite.test.ts.md`);
`launch()` can return a queued snapshot with no PID.

For Git object accumulation or stale `gc.log`, follow `docs/agents/git-maintenance.md`; prove grace, owned fixture drainage and held-close recovery through `docs/agents/tests/hub-test-git-maintenance.test.ts.md`, serving-first bounded stop/restart through `docs/agents/tests/hub-test-git-maintenance-startup.test.ts.md`, normal CLI exit beside a live handed-off collector through `docs/agents/tests/hub-test-git-maintenance-cli.test.ts.md`, and identity/refusal policy through `docs/agents/tests/hub-test-git-maintenance-recovery.test.ts.md`.

For startup lease recovery and phase timing, follow the sealed T2 fake-provider receipts in `docs/agents/tests.md#implementer-test-selection`. The T3 retained-history scale guard counts suite checkpoints, explorer batches and per-item native reads through the first completed status reply; retain CPU/wall/step diagnostics, the gross hang guard and red count-based historical controls as `docs/agents/tests.md#startup-reply-byte-budgets-t-1038` describes.

For remote watchdog changes, use the executor-fake guidance in `docs/agents/tests.md#implementer-test-selection`: observe mirrored byte progress, the terminal timeout receipt and released resource; preserve the admitted stall limit across restart.

For detached droplet watchdog PID ownership, use the T1 OS/checkpoint seam in
`docs/agents/tests/hub-test-executor-watchdog.test.ts.md` and its native T3
launch/rearm controls. Arm retries unreadable proof for at most 10 seconds;
keep changed-birth refusal across retries and a late-reply deadline control.
Register arm-control disposal before launch, independently drive its setup-clock
bound, and retain missing/aborted setup controls that drain held replies and
arm/stop work through the same owner.
The sentinel lifecycle fixture expires both durable lease copies only after the
worker-start and hub-stop receipts. Saved-account fresh resume waits for the
stopped spoke's new journalled disconnect, not only native stop. Authorization
fixtures read existing credentials through a minimal SQLite connection, with no
schema/migration writer; retain the held-WAL-writer control in
`docs/agents/tests/hub-test-sqlite-contention.test.ts.md`.
Keep `pid`/UTC `startedUtc`, add native `pidIdentity`, and
persist a coherent one-time legacy upgrade before any signal. Retain same-second
reuse refusal, failed-proof/checkpoint controls and the release-during-probe case;
hold provider release across inspection and prove full lease writers retain the
durable upgrade and terminal state without a second legacy adoption. Register
held-writer disposal before launch, bound/abort setup separately, and drain the
underlying checkpoint as well as inspect's bounded reply before root removal.

Before writing or changing a test, read "Test levels" in `docs/agents/tests.md` and put each test at the lowest tier that proves its behaviour: no new real process without a lifecycle reason, and no wall-clock waits. A `[t3-lifecycle]` refusal at line 1 of an existing T3/T4 file means its lifecycle header was lost: restore that first comment block before reading process-helper allowances.

Platform-conditional skips supply a nonblank prerequisite reason on the skipping
branch and `false` on the running branch. The report-only `skip-reason` census
detects direct boolean skip options; see `docs/agents/tests.md#test-lint-reports`
and the prerequisite receipt fixture in
`docs/agents/tests/hub-test-durations-runner.test.ts.md` for `5/5 skipped` evidence.

On `cover-quiet`, an authenticated refusal registers a durable one-shot
`test-slot-available` hub report. Do other work or end the turn until it arrives;
never poll with sleep or `cland verify queue`. Retry the targeted command after
the report; it checks admission again. If the running hub still says "wait for
it to finish", report the missing wake-up capability to the Coordinator and
end the turn until its release notice or authorized restart.

For roles-file launch refusals, fix the named key before retrying; running sessions
keep their last-good grants. Prove launch/relaunch refusal before native stop and
correction through both reader implementations at the fake-adapter seam in
`docs/agents/tests/hub-test-roles-session-refresh.test.ts.md`.

For role-clause skill inventory changes, use the production configuration and
T-1220 synchronous-filesystem guard described in
`docs/agents/tests/hub-test-session-credential-io.test.ts.md`; snapshot refresh
receipts are in `docs/agents/tests/hub-test-config-reload-component.test.ts.md`.

For `web/` changes in this repository, follow the root AGENTS.md web rule and `web/README.md`. The root check builds the ignored bundle after typechecking, including on local verification; no separate development bridge is used.

For message or notes Markdown, read `web/README.md#message-markdown` for the pure
token contract, configured item prefixes, per-message fences and raw-HTML source
guard; use the T1 parser seam named in `docs/agents/tests.md#web-phase`.

For browser tests, follow `docs/agents/tests.md#web-phase` and `web/README.md#browser-tests`: use the isolated Headless Shell fixture, keep CSP enabled and observe teardown. `npm install` prepares the pinned shell; targeted browser files require a current bundle. The hub web-auth file builds its bundle through the shared helper before standalone tests; suites build before any installation-bundle reader in `hub/test/run-suite.ts`’s `installedBundleReaders` list, including real doctor CLI tests on shards without Web or an available browser. Targeted standalone doctor CLI runs require a current build. Task verification adds changed T3/T4 files and tiers.json mapped T4 read-path guards once for duration sampling (shared duration procedure in docs/agents/tests.md), plus Web outside T0–T2; merge batches add it after T1 for web/ candidate diffs. A machine-unavailable Web receipt is not passing browser evidence; see that section.

For network bind, tunnel and QR tests, follow `docs/agents/tests.md#browser-sign-in-fixtures`: bind only disposable loopback aliases or use scratch config; observe web and spoke addresses independently.

`[web]` settings are startup-only: reload and role auto-refresh refuse a changed
parsed web table and retain the loaded config/roles pair; `config set web.*`
saves for the next hub start. Apply with `cland hub stop` then `cland hub start`.
Use the sealed CLI/projectHub regression described in
`docs/agents/tests/hub-test-config-reload-component.test.ts.md`.

For Web load-race checks, use `resizePage` and the positive receipt guidance in
`docs/agents/tests.md#web-load-race-guards`. New Web files have a separate
report-only ten-file-repetition check with two workers and owned CPU load after
ordinary Web timing, under the same machine lease. Verify retains the exact
count. Host admission carries `webRepetitionFiles` from the HEAD/fetched-dev
merge base; the runner does no Git lookup. An absent field is missing proof,
while `[]` means checked none new. Before restart #54 absent-field reports are
expected; the Coordinator records post-restart droplet counts as landing
evidence, not a pre-merge gate. Incomplete or skipped receipts are missing proof. Do not run this CPU
check as an unleased local probe. No role-clause expansion is needed.

Task duration summaries count printed allowance JSON lines, which can contain
multiple identity entries; `no allowance stanzas` means no such line was printed.
Keep this distinct from T4's lack of a tier budget. See the shared task T3/T4
duration procedure in `docs/agents/tests.md`.

For Web hang-guard changes, use the fake-clock and held-child seams in
`docs/agents/tests/hub-test-web-phase.test.ts.md` and
`docs/agents/tests/hub-test-suite-runner.test.ts.md`; the Web phase procedure
defines the progress window, projection ceiling and cleanup receipts.

For missing droplet browser libraries, report to the item's lead: the human or Coordinator rebuilds the prepared snapshot after restarting the hub onto the provisioning change. See `docs/agents/tests.md#web-phase` for the root provisioning and lockfile-key boundary.

For browser sign-in probes, follow `docs/agents/tests.md#browser-sign-in-fixtures`: `cland web` is human-only; use a disposable project and test client, with scratch browser opener stubs. Cookie sessions persist for 30 days from creation; `web --sessions` and `web --revoke <id>` are also human-only Unix-socket commands. Test clients use those frames on disposable projects, never the live session actor. `web.session` reads only the sign-in bound to the authenticated web socket, with no cookie or identity selector; `session.history` is a bounded human-client read across topics, separate from spoke `history`. Web launches refuse every own `cwd` field; local launches keep it. Web authority changes update the explicit deny-by-default policy and its protocol conformance test; use the same section for T1 policy and T2 web/Unix fixtures.

For install metadata, Inbox start URLs, app badges or phone QR sign-in, use the T2 edge and sealed phone seams in `docs/agents/tests.md#web-phase`; real installability and badges stay in QA's full-Chromium demo.

`artifact.url` is a web-only human client frame: test minting through an authenticated `/ws` connection, then request `/a/<capability>/<file>` without cookies. Use the disposable T2 fixture in `web-artifacts.test.ts` for confinement, sandbox headers and cookie-session lifetime; no agent permission or CLI command mints capabilities. Artifact iframes must never combine `allow-scripts` with `allow-same-origin`.

For artifact creation races and rollback, use the T1 concurrent-create seam in
`docs/agents/tests/hub-test-artifact-create-unit.test.ts.md`, including automatic
suite-log callers that bypass the dispatcher's tool queue. For nested artifact/post
rollback, use `docs/agents/tests/hub-test-artifact-lifecycle.test.ts.md`: refuse
a pre-commit record/admission write, preserving subscription/directory/id assertions.
Human-send diagnostic failures are post-commit operator `publication-failed`
records; separately prove the message and bytes remain stored with one publication
and delivery. A logger throw is not a pre-commit refusal seam.

For item clients, consume hub-computed summaries and roll-ups from snapshots and deltas. The first payload contains open rows and their ancestors. Neovim reads them as `paged:true` open summary pages: accumulate every page and replay buffered task events only after the complete traversal; a reply without `next` is a complete legacy list. Fully closed containers and tasks load in bounded per-parent `task.list` summary pages; follow newly loaded containers and deduplicate retained ancestors by identity. Card-only dates/branch/relations/compact verification travel in snapshots and by-id pages; ordinary summary lists and parent pages omit these extras to protect the native first-payload budget. Closed card facts and a complete compact tree row are fetched in bounded by-id `task.list` summary pages; item links use the canonical id and parent to load and unfold missing ancestors without reading the body; fetch the body through `task.view` only when agents’ text or the criterion editor is opened; preserve the 1 MiB snapshot cap and Lua differential guard. See `hub/README.md` (summary projection) and `docs/agents/tests.md#connection-snapshots`.

For web card criterion edits, use `task.criterion` with the authenticated human and no `as` field. Keep one-line text separate from the `Ck.` id label, preserve ids and drafts, disable offline writes and never replay mutations after reconnect. Legacy criteria with null ids stay read-only until Add or a CLI write returns persisted ids; explain this in a tooltip and never guess an id. `e` is scoped to the criteria block through the shared key map. Labels, body and other item fields stay read-only in Items. Use the three Web/CLI seams in `docs/agents/tests.md#web-phase`; no protocol or role permission expansion is needed.

For explorer container cards, keep descendant verdict facts in loaded summaries and
read their reason only from existing detail cache; selecting a descendant owns its
body fetch. Use the settled-card T2 and mapped twenty-case T4 seams in
`docs/agents/tests/nvim-test-explorer-component.test.ts.md`.

For Neovim recording refreshes, follow `docs/agents/tests.md#neovim-recorded-frames`: audit every reduced slice before changing its stored expectation. The named local-only summary/decoder checks are excluded from full discovery; every selected file retains the zero-frame guard.

For early Neovim plan navigation or launcher role defaults, use the delayed
snapshot seams in `docs/agents/tests/nvim-test-plan-component.test.ts.md` and
`docs/agents/tests/nvim-test-launcher-component.test.ts.md`. Hold the initial
reads and observe the resulting view or form after release without another key.

For human marks changes, preserve the forward-only timestamp/plan-history ordering and the durable one-time import acknowledgement before removing `events.last_look` or `plan_seen` from `ui.json`. Use the real-frame and recorded-headless seams in `docs/agents/tests.md#human-marks-fixtures`; no role-clause expansion is needed for these human-only UI frames.

For human topic kinds and queued withdrawal, use the public-frame/fake-spoke seams in `docs/agents/tests.md#human-kinds-and-queued-withdrawal`. Only a human Question starts a wait; withdrawal succeeds before adapter submission and returns the text. Preserve the durable submission fence and held notes.

For the web composer, use the sealed browser/peer-frame seam in `docs/agents/tests.md#web-phase`: fake Coordinator and second session, physical-code keys, same-topic available artifact chips, per-topic reload/disconnect drafts and a held real send/refusal. Keep pending state across mounted thread copies, preserve newer typing on either receipt, never replay writes on reconnect, and let the hub's successful send mark read through that message.

For web Withdraw, use the same sealed Web/public-frame seam with a busy fake session and a test-controlled idle step. Hold the receipt before asserting draft restoration; preserve newer typing and shared pending state through navigation. Prove refusal through the real hub after injection, with its tooltip reason and unchanged draft, then release the held delivery delta.

Withdrawal eligibility reads the optional authoritative `withdrawable` fact; preserve aggregate stages and queued-only fallback for older hubs. Test one injected broadcast recipient with another still queued through hub frames and Web. If a newer send is pending when older text returns, hold its actual success/refusal and uncertain reload to prove older/pending/newer draft order without losing the restored text.

For Web Events changes, use the sealed Events/public-frame seam in `docs/agents/tests.md#web-phase`: hub-side filters on subscription and pages, local-day folds, receipt-backed shared last look, live coalescing focus and gap-free older pages. Keep Inbox summaries unfiltered even beside Events in a split. Shared key routing changes also run the Sessions launch/archive and shell files with the actual focused rail target: rail digits navigate, other rail keys retain their active area and Events row digits filter.

For open-page browser notifications, use the pure rules/text seam and sealed Web Notification/visibility/focus stubs in `docs/agents/tests.md#web-phase`. Keep the Accounts Profile switches in the shared browser store unchanged, with no palette actions; test Finished off after reload and first-enable permission through stubbed Web controls. Request permission directly from an enabling gesture, seed snapshots without replay and use pre-transition task layers. Open the Inbox list explicitly in either pane and observe exact row-id focus, including from an open palette; hold browser animation time to prove row focus follows committed DOM rather than elapsed frames; retain receipt-based suppression; keep notifications stubbed. Phone worker changes use `docs/agents/tests.md#phone-notificationstestts`: opt-in worker contexts, real root registration, stubbed showNotification, worker click/no-fetch contract and T2 edge headers; real notifications stay in QA's demo.

For Inbox drawer, reply, visit and archive changes, use the sealed Web/fake-sender seam in `docs/agents/tests.md#web-phase`. Select action rows explicitly; observe the exact departure before asserting leave/re-entry, including focus into another area while Inbox remains mounted. Keep drawer history reads separate from exact-id recovery reads, and retain the fake sender's reply receipt while split remains open. Retained approval detail identities resolve current native authorization and recovery state. Archive reads consume hub departures without replacing live rows or counts. For read-outcome races, keep the controlled reply-first and departure-first orders in `docs/agents/tests/web-test-inbox.test.ts.md`.

For approval records, use the sealed frame and recorded-client seams in `docs/agents/tests.md` (Approval record changes). Retain the existing inbox fields, the session-scoped native id, the 64 KiB subject allowlist and the explicit outcome; Claude Code's record stays TUI-only. For `approval.answer`, use the same doc's scripted fake adapter and authenticated web-cookie checks: only the human answers, Aides are refused, the first answer reserves `answering`, and delivery failure restores `pending` with a warning. Keep Deny intact and verify the native note or human message fallback; nothing answers by default. Neovim approval keys use the recorded-headless inbox seam in the same section: assert the outbound choice/note, live delta, attributed fold, race archive lookup and TUI-only no-send/attachment boundary.

For Web approval cards, extend `web/src/ApprovalCard.tsx` for Inbox and drawer reuse. Use the sealed Web/native-record seam in `web/test/inbox.test.ts`: complete subjects and session facts, offered choices, optional denial notes, Escape without an answer, held delivery/failure, and the exact archived race winner. Keep TUI-only cards button-free and route reusable card keys through the shared map and shell dispatcher. The approval drawer reads bounded `session.history`; retain an exact rendered message receipt.

For Codex long-thread reattachment, use the scripted native and Unix WebSocket seams in `docs/agents/tests/hub-test-codex-native.test.ts.md`: metadata-only resume, older-server compatibility, frame-limit classification and the CLI payload-limit reason. No harness process is needed.

For Codex provider-capacity replay, use the fake-clock/native-readback seam in
`docs/agents/tests/hub-test-codex-delivery.test.ts.md`: exact input, bounded
backoff, ownership cancellation and one terminal lead report. Preserve ordinary
failure notices and the explicit human retry for uncertain admissions.

For the Codex approval relay, use the scripted native frame seam and explicit fake-binary contract receipt in `docs/agents/tests.md` (Approval record changes). Prove native decisions and shared request ids, including replay, external resolution across readback/disconnect and malformed or oversized subject TUI fallback; file approval subjects come from the matching turn/item. The contract receipt must show that Deny continues without running the command.

For OpenCode relay changes, follow `docs/agents/tests.md` (The OpenCode relay) for scripted native reply, child/reconnect/shape checks and the targeted fake-binary Deny-with-note receipt, separate from mode-free task coverage.

For Discord REST changes, use the fetch/fake seam in
`docs/agents/tests/hub-test-discord-api.test.ts.md`: string snowflakes, nonce
deduplication, mention suppression with a raw default-mention positive control,
provider faults and bounded hold/abort receipts. No real platform or token.

For spoke stdio framing, use the owned-byte-stream seam in
`docs/agents/tests/hub-test-spoke-stdio.test.ts.md`: cap each input line at
1 MiB before JSON/schema decoding, emit a JSON-RPC cap error with unknown id,
discard the oversized remainder and retain a successful next-request receipt.
No hub connection or process is needed for this boundary.

For approval race/restart changes, keep the existing native/frame seams and run `hub/test/approval-restart.test.ts` explicitly for the T3 scratch hub-process receipt. Codex's observable race boundary is resolution before its response-write receipt; its own echo follows delivery. Later matching item execution after Deny or declined completion after Approve corrects the archive and live record to `answered in the harness` with a warn event; retain the scripted native regression and unrelated-item controls. Telegram corrections require native delivered-first and held-first edit receipts with ordered final card text and unchanged replay fences. Without that evidence the protocol limit remains. OpenCode confirms through the HTTP result, not an equal choice in an event. Recover persisted OpenCode child owners before reconciliation, and wait for the exact `approval-rebuilt` native-validation receipt after a held recovery before answering in the restart test. Treat persisted authorization as display metadata until current native validation completes: hold/malformed replay tests must refuse without any endpoint call, and validated fields replace old subject/choices/routing while keeping id/since. Preserve allowlisted persisted ids/subjects and archive outcomes, and label unobserved off-stream choices `answered in the harness`. See `docs/agents/tests.md` (Approval races) and the protocol limitation in `hub/README.md`.

For ask outcomes, a declined ask is a decision and never consent. Human `topic.answer {ask, declined: true, reason}` requires a non-empty reason, delivers `declined: <reason>` and leaves the topic open; return the unchanged decision down the lead chain with `ask.answer`. Use the public-frame and recorded-headless decline seams in `docs/agents/tests.md`; Neovim does not initiate declines in 0.2.0.

For copied-tracker tests, copy the pinned shape corpus by default
(`docs/agents/tests/hub-test-pinned-tracker.test.ts.md`); the full live-body Lua
comparison stays at T4 and the 1,000-item scale guards stay generated. Derive
live ids from the scratch copy; name the seeding
owner beside seeded literal ids with `cland-allow-tracker-id`. Read the T0 guard
scope in `docs/agents/tests.md` when adding copies or exceptions. Keep payload
caps above measured copied-state bytes with growth headroom, alongside synthetic
fixtures.

For Neovim frame refresh admission, use the T1 capture/TAP publication seam in
`docs/agents/tests/hub-test-nvim-frame-refresh.test.ts.md`; completeness follows
successful consumer tests and nonempty captures, not historical frame counts.

For native child launches in `hub/test` and `nvim/test`, use the complete `fixtureEnvironment`
or `accountFixtureEnvironment` result after explicit owned extras. Fresh runner
children use `runnerFixtureEnvironment` to filter inherited paths while keeping
execution/admission controls. Read the T0
child-environment guard scope in `docs/agents/tests.md`; intentional seams need a
nearby `cland-allow-child-env` comment naming the sealing owner or native contract.
Run the guard's `--inventory` when reviewing exemptions. It prints no environment
values.

For executor fixtures and partial environment overlays, follow the scratch-ledger
proof in `docs/agents/tests/hub-test-suite-accounting.test.ts.md`; publish the sealed
environment after the final options spread. Registration and missing-project
sweeps use `docs/agents/tests/hub-test-executor-spend.test.ts.md`.

Periodic dev T3 and nightly soak queue/heartbeat rows and artifacts name `hub`; ordinary human shell runs keep `human` ownership (automatic chips in read-only Agents remain hub notices). Attribution uses existing occasion facts after restart, with no new wire field or role permission. Periodic dev T3 uses the admitted commit's Git objects and checks remotely at that detached head; later root commits cannot invalidate it. Bundle/delivery failures before execution retain `outcome.notRun: "infrastructure"` and publish `result: "not-run"` with the cause. They supply no green/red cover, release evidence or culprit search, and retry the next eligible tip after the interval. Provider capacity refusals at size/spend admission or acquisition use `notRun: "provider-capacity"` and retain the original cause; periodic notices say "not run: provider capacity", task results say "unavailable: provider capacity" and latest verify result is `unavailable`. No executor/region/size fallback applies. Such a receipt is missing runtime evidence, not a criterion failure or passing proof; report the blocker to the item lead. For historical or Web culprit-search changes, use `docs/agents/tests/hub-test-dev-t3-search-component.test.ts.md`. Report boundary confirmation cost: at most two extra droplet probes per failing file, or one for an absent predecessor; only the boundary pair repeats. Historical probes log skipped hosting lint and retain candidate commands in standalone detached repositories whose tracker is pinned, including allowance owners. Current local dev gets a file probe before history and after any tip movement before filing; a complete pass reports already fixed only with intervening source-change evidence. Tracker (`.cland/tasks/`), docs (`docs/`), QA briefs (`qa/briefs/`) and `hub/test/durations.json` alone report `not reproduced (intermittent)` with both red/green receipts to the Coordinator; missing history is inconclusive. Bugs retain the current tip red receipt. Report this tip-probe cost separately from the boundary pair; no integrated/stage cache is reused. Known platform exclusions remain partial evidence; use the component guidance for exact exclusion/platform comparisons and negative controls. Use the sealed bundling and fake-executor seams in `docs/agents/tests/hub-test-suite-soak-component.test.ts.md` and `docs/agents/tests/hub-test-suite-soak.test.ts.md`.

For coverage selection, pointer retention or shard merging changes, follow
`docs/agents/tests.md#coverage-ancestry-and-fallback`: prove parsed/retained map
counts and retained pointers at the loader seam, with named expiration events.

Manual selection replay uses a disposable mirror clone with sealed HOME/XDG/Git
configuration and filtered inherited credentials and Git redirects. Historical
checkouts use committed sources; maps, timings and logs stay read-only inputs
from the caller. Preserve the CLI isolation and replay assertions described in
`docs/agents/tests/hub-test-suite-selection.test.ts.md`.

An explicit `--size` override absent from the provider catalog is invalid input:
submission exits 1 with an "unavailable" error and creates no job or droplet.
Listed unavailable sizes or sizes absent from configured regions retain the
provider-capacity outcome; configured catalog absence remains a capacity refusal.
For sharded cover outcomes, use the sealed scheduler and public-notice seams in
`docs/agents/tests.md`: preserve each unexecuted shard's cause, distinguish an
entirely unexecuted group from partial execution, and retain executed results.

Shell CLI calls claiming a session require its own credential: the adapter's `CLAND_LAUNCH_TOKEN`, otherwise the private session-id-bound fallback file provisioned by its own MCP spoke reconnect. An invalid environment token never falls back. A named credential refusal calls for reconnecting that session's own spoke or `session resume --relaunch`; legacy running shells migrate on reconnect without relaunch. Relaunch rotates the credential; archive removes its private directory. The hub uses its stored role. Keep credentials out of argv, logs and artifacts. See `hub/README.md` (Task CLI trust model).

Automatic run reports and verify/executor-prepare defaults go to Agents, addressed to the Coordinator; log chips follow the report topic. Item workers keep explicit `--report <item-topic>` and Reviewer/claimant recipients. General retains Coordinator exit/vacancy recovery notices for the human.

Before local tests or typechecking in cland, check `node --version` against
cland's root `package.json` engine range. For provisioned QA skills, use
`.agents/skills/qa/node-engines.json`, shipped from that same contract; the host
project's manifest is not cland's runtime authority. With nvm, source `"$NVM_DIR/nvm.sh"` (or
`"$HOME/.nvm/nvm.sh"` when NVM_DIR is unset), then `nvm use 24`; confirm the
selected version meets the full range, including its minimum patch. Otherwise
prepend an installed supported Node's `bin` directory to PATH for the command;
an absolute `node` alone does not select the runtime for its child commands.
Targeted admission prints one warning per admission on unsupported Node,
including standalone runs; treat that evidence as unsupported and rerun on the
supported version. This warning does not replace cover-quiet admission.

Run typechecking and targeted single test files while implementing. Merge batches run T0 before configured tiers and add Web after T1 for web/ diffs; use the receipt/bisection seams in `docs/agents/tests.md#queued-merge-batches` for changes there. In a hub session, run the full suite only after a clear source review, as described below; outside the hub, run it once at the end.

For README/docs edits, run `node hub/test/lint-closed-item-wording.ts` against the
candidate tracker. Fix landed-work claims; document any historical or unrelated
runtime wording with the reason-required line exemption in
`docs/agents/tests.md` (closed-item wording guard).

When changing dictionary membership or prototype checks in this repository's
`hub/src`, read the T0 dictionary guard scope and exemption rules in
`docs/agents/tests.md`.

Once done, request the hub Reviewer as described below; outside a hub session, use the "code-review" skill.

Task claim/launch links absent worktree `node_modules` to the root install.
Read `worktree.warning` for stale own installs or links; never replace an install
under running readers. A host check's `dependencies out of date: run npm install`
means a locked package is missing: report it to the item lead so the Coordinator
can arrange a root install after shared readers stop.

Commit your work to the current branch.

On a tool result with `code: "invalid_argument"`, correct the named fields using its accepted values and retry. A `forbidden` result is a permission refusal: stop that action and follow the lead-chain escalation in your role clause. See `docs/agents/session-permissions.md`.

In a hub session, use the claimed item's existing topic; if it has none, open it with `cland topic create "<title>" --item T-<n> --json` or the `topic.create` tool. An Implementer may open only its own item's topic.

In a hub session, mark every acceptance criterion done with `cland task criterion T-<n> done C<n>` before requesting the final review. Read `task view` for the criterion ids. Done marks are separate from Reviewer/QA verification; ready needs both. If only done marks are missing, the hub notices the claimant in the item topic, repeating only when that claimant’s missing set changes. A replacement claimant receives its own first notice.

The `send` tool accepts `to` as one recipient string or an array of strings (`string | string[]`); for review, use `to: "reviewer"` or `to: ["reviewer"]`. Other shapes are validation errors; omitted `to` or `[]` addresses the human.

In a hub session, set your claimed item to `review` and send `review request T-<n>` to `reviewer` in the item's topic with the committed branch/head and criteria. Inspect the send outcomes: `resolvedTo` names the selected Reviewer; a `queued` outcome waiting for the next free verifier means the hub will assign it automatically and send you an assignment or refusal notice. Wait for that notice instead of resending the same request. A refusal names the retry rule. When no verifier is live, report the staffing blocker to `lead T-<n>` so it can launch one; the queued request remains pending. For verifier routing or pending-marker changes, use `docs/agents/tests/hub-test-verifier-routing.test.ts.md`, including its ready-transition reservation and legacy `{item,kind}` restart recovery cases.

Before requesting review, fetch and merge `origin/dev`, then commit and push the head to review. After a clear source verdict, run `cland verify` at the exact reviewed head and wait for its hub result. A fix or later merge that changes the head needs a new review before a new run. An unchanged head may reuse an earlier green run through the tree-hash cache. The Reviewer settles the final verdict when the same-head result arrives; see `docs/agents/tests.md`.

A verify queued locally after a remote-budget fallback can reclaim a free remote slot in its original queue order, including after a hub restart; the hub reports the move in its topic. Wait for that request rather than resubmitting. Explicit `--executor local` stays local.

Cache evidence names the original occasion and executor. Release reuse requires
full matching coverage on the effective executor/OS, including configured defaults;
a local macOS stage receipt cannot satisfy a droplet release request. See
`docs/agents/tests.md` for receipt identity and provenance.

## Verifier request procedure

- Inspect request outcomes: `resolvedTo` names the verifier; `queued` waiting for a free verifier means the hub will deliver automatically and notify you. Wait instead of resending. If no verifier is live, report the staffing blocker to your lead; a refusal notice names the retry rule.
- Text after the item on the request's first line is detail: `review request T-12 — branch, head, scope` resolves one verifier exactly like the bare form, so a detail placed after the id never turns the request into a role broadcast. A letter glued to the id (`review request T-12abc`) is no request at all.

## Review/QA request procedure

Clause procedure (defaults implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build after the `qa` skill’s lint preflight; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

Clause procedure (project implementer):

- When the source is ready for review, set `task.edit` status `review` on your claimed item. Request review yourself with `send` kind `report` to `reviewer`, in the item topic: first line `review request T-<n>`, then branch, head, criteria and scope. When the Coordinator supplied `qa/briefs/T-<n>.md`, request QA yourself with first line `qa request T-<n>`, naming that committed brief and build; without a brief, request review only unless task.view’s qaPolicy has a non-none scope and when: per-item, or qaCriteria still need QA verification. In those cases report the missing brief to the Coordinator.

## Verdict procedure

- On a not-clear verdict, fix the findings, commit and push a new head, then request review again before a new verification run and request affected QA again yourself. A clear source verdict starts verification; the Reviewer settles the final verdict on its same-head result. A final clear verdict needs no relay to the Coordinator: the hub checks freshness and sends the nearest supervising Lead (or the Coordinator) the one `ready` status event. Keep your claim until merge; report only if blocked.

For the native Discord connection, use the sealed frame/loopback REST/ws seam in
`docs/agents/tests/hub-test-discord-messenger.test.ts.md`. Keep gateway URL
validation before socket construction, API v10 JSON/intents 33281 and token-only
Identify/header boundaries. Connection status requires READY plus a recent ACK;
keep deterministic jitter, immediate opcode-1 heartbeat and per-messenger notices.
Stop joins socket close and cancels heartbeat, reconnect and offline timers.
For resume/liveness changes, retain the guide’s zombie close, twelve-resume,
invalid-session delay and exact three-minute notice receipts. Keep settled REST
health separate from socket ACKs and job-local edit 404s; retain the paired-send
recovery receipt and the guide’s client-refusal and cleanup ownership boundaries. Existing frame shapes, optional
callbacks and role clauses remain unchanged.

For Discord command registration and pairing, use the sealed production-frame,
CLI and loopback REST/ws seam in
`docs/agents/tests/hub-test-discord-pairing.test.ts.md`. Compare global command
writable fields before writing; callbacks remain private and bypass message lanes.
Keep interaction tokens only in adapter memory with a 15-minute expiry. The
optional pairingApproved hook follows the committed local grant; Telegram and
older adapters may omit it. Existing role authority and frames remain unchanged.

For Discord phone commands and ephemeral deferral, use the production-frame/fake
REST/ws seam in `docs/agents/tests/hub-test-discord-commands.test.ts.md`.
Read the shared identify reservations and fetch platform remaining starts; reuse
neutral phone replies and mute receipts. Arm the two-second acknowledgement
before hub work, join a started defer before editing the original, and cancel
requests/deadlines on stop. Existing wire and role authority stay unchanged.

For Discord General delivery, use the sealed frame/loopback and native receipt
seams in `docs/agents/tests/hub-test-discord-messages.test.ts.md`. Reuse mirrorOut,
record attempts before I/O and commit the native mapping with sent settlement.
Keep nonce proofs within the documented conservative window; old unknown sends
stay fenced. Serialize inbound text and advance its cursor after the hub result,
with durable message-id deduplication and unchanged ingress frames. Existing role
clauses already cover this boundary; add no permission lines.

For external tracker saves, use `reindexedAfter` (or `removedAfter` for deletion)
from `hub/test/tracker-reindex.ts` before checking projections. Healthy native
watching has a 5 s safety stamp check; failed watching uses 500 ms. Receipt waits
allow 15 s for loaded hosts and keep final semantic assertions.

For Telegram outbound artifacts, use the sealed production-frame/fake-platform
seam in `docs/agents/tests/hub-test-telegram-artifacts.test.ts.md`. Keep the
planner messenger-neutral, batches durable before draining, and file jobs limited
to artifact ids and captions. Bind upload contents to the shared descriptor-based no-follow opener at delivery,
with bounded reads and finally-closed descriptors. Preserve plain
CRLF-budgeted captions, messenger-scoped once keys across pairing changes,
started-publication priority, safe same-chat sent-above native replies, and
General missed/unknown-attempt fences after timeout/restart. Existing role clauses
and wire frames cover this behaviour; add no permission lines.
For Telegram inbound media, use the sealed production factory/frame/fake Bot API
seam in `docs/agents/tests/hub-test-telegram-inbound.test.ts.md`. Persist native
file facts before confirming the offset; recover per-chat FIFO workers, queue
ordinary text behind media, and keep commands/prompts/presses independent. Pass
bytes beside artifact.upload frames and reuse the native ingress and stored/seen
receipts. Unsupported paired messages and edits receive the terminal one-line
reply. No additional role-clause permission is needed.

For deferred remote media, retain the captured paired numeric identity across
native I/O and recheck it at upload and commit. Join fatal-media poll shutdown
before surfacing its stop cause to Gateway. Exercise owner handoff, held native
I/O revocation, file-preparation revocation and omitted/aborted setup controls
with pre-owned observers and exact close/completion receipts.

For speech doctor and status output, use the sealed CLI/fake speech seams in
`docs/agents/tests/hub-test-doctor-remotes.test.ts.md` and
`docs/agents/tests/hub-test-remote-cli.test.ts.md`. Doctor resolves presence only when a remote is enabled; unused/off speech is
`ok` with its detail. Plain status computes data use from local config, keeping JSON/wire unchanged.

For Discord application checks and terminal stops, use the sealed frame/REST/ws
cases in `docs/agents/tests/hub-test-discord-messenger.test.ts.md`. Keep both
Message Content flags, empty endpoint validation before Identify, one fresh
Identify for 4003, structured fatal causes and one General notice. API error
observers retain only sanitized errors and numeric channel ids. All REST paths
stop on 401/40001/50014; test reads the application and sends one paired line.
Existing role authority and optional wire fields remain unchanged.

For Telegram reaction receipt authority, retain captured numeric pairing identity
and check it before and after native I/O. Keep the optional-field legacy recovery
control and held-feedback unpair/replacement cases in the Telegram inbound guide.

For Discord replies and reaction feedback, extend the production-frame cases in
`docs/agents/tests/hub-test-discord-messages.test.ts.md`. Keep mapped topic/reply
routing, foreign-author rejection and legacy inbound tombstones. React through
the durable outbox with idempotent PUT recovery; reconcile delivery receipts
only after the gateway conversation opens. Observe sent settlement before a
restart and retain both native emoji state and HTTP attempt assertions.

For Discord mirror rendering, use the production-frame/loopback receipts in
`docs/agents/tests/hub-test-discord-render.test.ts.md`. Render and fall back before
durable enqueue; commit all numbered parts in one synchronous transaction before
starting a drain. Persist the rendered bytes and optional silence flag, keeping
historical payloads readable. Preserve empty allowed_mentions on creates and
edits, SUPPRESS_EMBEDS, and original source mappings for every numbered part.
Split by Unicode code points with headers and fence closures in the budget;
prefer complete blocks and reopen split fences with their language. Existing
role clauses cover these paths; add no permission lines.

For Telegram albums, keep the opaque media grouping in the durable FIFO: commit
each item before offset confirmation, close on two injected seconds of quiet or
the chat's next update outside the group, and reset open-group quiet time on
restart. Retain ordered files, first non-empty caption, first-item ingress and
all native reply/feedback mappings. Confirm restart setup through the native
getUpdates cursor receipt. Recover committed uploads from the durable ingress
receipt before downloads so a lost result plus expired files cannot drop maps.
Only album receipts carry target lists and per-target progress; preserve the
legacy single-message receipt shape and its prompt-recovery regression.
An oversized member must not drop its peers.
Use the album cases in the inbound guide, including legacy single-input recovery.

For Telegram voice notes, use the sealed production-factory/frame/fake Bot API
and fake speech provider in `docs/agents/tests/hub-test-telegram-voice.test.ts.md`.
Keep original bytes, MIME/suffix, one human transcript and one native reply,
including missing/off/quota/empty outcomes. Keep the native hub.reload command
provider switch at T3 in `docs/agents/tests/hub-test-telegram-voice-command.test.ts.md`.
The optional fourth MessengerFactory argument carries the speech provider; old
three-argument factories remain valid. Preserve legacy frames and receipt shapes.
Existing role clauses cover voice uploads; add no permission lines.

Voice echo delivery owns a separate ready intent and terminal outcome from the
inbound FIFO. Preserve bounded numbered parts, stable part keys and unknown-send
fences, and prove held accepted-echo close/restart plus later General input.
Empty/missing speech commands keep audio and name command setup.

For Discord Identify admission use the native factory/frame/fake cases in
`docs/agents/tests/hub-test-discord-messenger.test.ts.md`: persist reservations
before socket I/O, pre-arm the bounded client admission-scheduled observer before restart/close
and observe its exact socket ordinal before injected-clock spacing checks, and keep
failed-only equal-jitter backoff separate from resumes. The existing
identify-budget stop cause carries the UTC reset time; no role permission or
public frame changes are needed.

For Discord cards, modals, approvals and `/cland inbox`, use
`docs/agents/tests/hub-test-discord-cards.test.ts.md`. Bind every custom id and
modal submission to its mapped native message and user; that mapping is the only
action authority, never button text or an id of another kind. Refuse stale or
foreign interactions privately before any hub write. Commit the hub outcome
(`topic.answer`, `approval.answer`) before the callback, defer at 2 s, and join
callback work before the Store closes. A closed card or approval closes every copy;
resend keys stay scoped to the interaction, apart from live publication. Validate
approval-model and native-map keys, link plans only from the configured origin,
and keep General reference prefixes and the previous command and outbox shapes.

For Telegram voice admission and answers, use the telegram-voice fixtures in
`docs/agents/tests/hub-test-telegram-voice.test.ts.md` and
`docs/agents/tests/hub-test-telegram-voice-answers.test.ts.md`. Freeze the answer
target before speech I/O, assert no native `getFile` after a durable refusal,
keep MIME, name and caption, and keep the two-audio album regression. A matched
answer keeps no audio; failed or unmatched notes upload to General.

For setup speech keys, use the sealed runner and prompter fixtures, share
`SPEECH_DATA_USE`, preflight before hidden input and resolve environment overrides
before offering a key. For Telegram workbench marks, use
`web/test/telegram-marks.test.ts` and `nvim/test/telegram-marks.test.ts` with their
guides; keep the persisted prefix and wire shape and assert header marks and
attached audio separately.

For Discord resume, replay and fresh-Identify history catch-up, use the restart
and history cases in `docs/agents/tests/hub-test-discord-cards.test.ts.md` and the
native kill case in `docs/agents/tests/hub-test-telegram-polling-restart.test.ts.md`.
Hub stops close 4000 and keep the durable session and handled sequence; a
configuration disable closes 1000 and clears it through the optional
`Remote.disable` hook. Persist a replay cursor or bounded history selection only
after its dispatch effect has settled. Replayed messages keep their written and
return times, commands are dropped and presses never answer. Gate live text and
publication until history settles, then send the silent source-counted gap and
re-send only mapped open cards, with stable keys and old copies retired after the
sent receipt. Outbox reads select pending states or exact ids; never decode the
whole ledger per input. Advance fake clocks by observed sent receipts, not by
mapping counts, and keep an independent hub request bounded during catch-up.
Keep the previous adapter, wire and outbox shapes.
For both remotes in one hub, use `docs/agents/tests/hub-test-scenarios-remotes.test.ts.md`:
a graceful stop persists a planned recovery boundary, keeps the 150-second card
rule and emits no failure outage (`docs/agents/tests/hub-test-telegram-graceful-restart.test.ts.md`).
Observe native close and Discord invalid-session persistence before advancing the
fake clock across a restart.

For Discord files and voice in either direction, use
`docs/agents/tests/hub-test-discord-inbound-media.test.ts.md` and
`docs/agents/tests/hub-test-discord-artifacts.test.ts.md`, and reuse Telegram's
paths: `artifact.upload`, `voiceNote`, `artifactPlan` and `artifactBody`. Inbound,
keep original MIME, name and bytes, admit voice by duration before any CDN
download, and refuse redirects, foreign hosts and credentials on CDN GETs; a
refreshed URL repeats every check of the first download. Outbound, queue ids and
captions, bind bytes through no-follow descriptors at delivery, and keep each
request within ten files of 20 MiB and 25 MiB encoded, multipart envelope
included; fakes check the whole encoded body, not only file sizes. Keep the
original enforced nonce and its deadline, an empty `allowed_mentions`, and old
JSON callers and persisted payloads.

For setup's Discord step, use `docs/agents/tests/hub-test-setup-remote-component.test.ts.md`
with the fake Discord application; read the effective API root back and require
loopback before any synthetic token I/O. For doctor's Discord stop causes, drive
the native fake's close codes; for the Remotes row, voice, approval and pairing
marks, use headless native inputs in both workbenches through
`hub/test/discord-workbench-fixture.ts`. Keep at least one native-input case per
supported messenger for every messenger-neutral workbench criterion.

For bounded Discord history commits (T-1436), preserve the synchronous native
batch port and post-commit frame results. Keep the frozen selection and ingress
identity across both group rollback and the commit-to-adapter-receipt gap.
Keep each reaction attempt and settlement fenced; never hold a transaction over
an await. Use indexed source, last-row and depth reads and the full-scale decoded
row guard; exact durable source lookups also bound test observers. Keep replies
and media outside ordinary-text batches so reply mappings exist before routing. Preserve
legacy optional callbacks, nonce fences and final durable assertions. The restart
guide owns process-kill coverage; apply throughput thresholds in the external
measurement probe, not as wall-clock assertions in suite tests. No role clause
or CLI permission is added.


## Claude lifecycle

For Claude Code launch identity changes, use the settings/environment,
sealed frame and native lifecycle seams linked in
`docs/agents/tests/hub-test-claude-code-sessions-lifecycle.test.ts.md`.
Keep stable session/conversation ids separate from `CLAND_LAUNCH_ID`. Relaunch
needs a native stop or captured-job absence from a query invoked after the failed
stop, including after PID exit; drain earlier shared queries before that proof.
Require generation after resolved admission identity, revoke existing
spokes/bridges at rotation, and preserve legacy rows without generation metadata.
Native inspection distinguishes duplicate, positively same job and unavailable;
only same-job proof permits `/clear`. Supplemental native fixture spokes, hooks
and bridges explicitly use `claudeLaunchIdentity` from
`hub/test/claude-launch-fixture.ts` to read their recorded immutable settings;
never infer a generation inside transport helpers or alter omitted/legacy
controls. Partial-settings fault injection targets the new generation directory. Join deferred checks on shutdown and fence
them against newer hooks, generation and lifecycle changes. Use the single
`#hookRevision`/`#activity` and directory observation owner for both retirement
and pending native-identity inspection; ordinary same-conversation hooks retain
independent verified PID acquisition. New component regressions compose the
shared pre-registered acquisition/observation owner through
`hub/test/claude-component-fixture.ts`; follow its
[setup cancellation and removal controls](../../../docs/agents/tests/hub-test-claude-component-fixture.test.ts.md).
Bound full setup separately, join late clients/spokes and observations, and keep
a successful-drain guard on root removal. Existing role clauses
cover these boundaries; add no clause lines.


For Claude daemon retirement, use the fake-clock/native-CLI seam in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`. Only fresh successful
job observations retire a listed launch; retain known live PIDs behind missing
listings. Preserve re-exec grace and newer hook identity, pin terminal decisions to the admitted job, and fence native queries
against newer same-conversation hooks and watched launch/job replacement while
allowing verified late PID discovery. Recheck the captured job after native
identity probes before publishing a PID. Keep the `coordinator-retired` inbox kind compatible with generic message clients,
key its remedy by session and native job, and retain restart, reconnect and
failed-query controls. No role-clause or command changes are needed.

## Retained history and hub memory

For startup history changes, use the suite summary/by-id and recovery controls
in `docs/agents/tests/hub-test-suite-persistence.test.ts.md` and the journal's
bounded input-work/prior-selection controls in
`docs/agents/tests/hub-test-journal-subagents.test.ts.md`. Preserve legacy full
receipt storage and history replies, one in-flight journal scan per path, and
escaped or unterminated records. Keep CLI/wire shapes unchanged.

For hub memory investigations, use `hub/test/measure-memory.ts --plan` before a
Coordinator-granted local measurement slot. Follow
`docs/agents/tests/hub-test-measure-memory.test.ts.md`: sparse artifact bodies,
sealed child, independent swap supervisor, startup-only coarse allocation
sampling and per-stage counts. Report synthetic and copied live-scale evidence
separately. Name each checkpoint and any unexecuted later stages; require the IPC
stop outcome plus native close. Publish aggregate analysis only, distinguish
sampled allocation from retained size/RSS, and delete
any raw snapshots by literal path before review. For payload attribution without
a hub run, use `measure-history-storage.ts` on its fresh disposable backup and
publish only aggregate field/row sizes. Existing role clauses cover both flows;
add no permission lines.

## Local verify preflight

`cland verify` (also `suite` and `--dry-run`) runs the shared hub tier/duration
and frozen test-lint admission before sending when the caller has
`hub/test/run-suite.ts`. Repair the named cause and file/line on HEAD or disk;
report-only findings remain nonblocking. Other stacks retain configured hub
checks. Preflight success is not verification evidence. See
`docs/agents/tests/hub-test-suite-preflight.test.ts.md` for the disposable CLI seam.
Existing role clauses already require these checks; no new clause is needed.

## Periodic dev T3 fresh-cover skips

Periodic dev T3 skips a due admission when a full T3 integrated dev cover passed
within the last hour at the captured tip or a descendant. The notice names its
run id and head; the attempt cursor persists across restart. Red, partial,
cached, diagnostic and subset receipts never qualify. This does not replace
an item's exact-head verification or source review. Regression guidance:
`docs/agents/tests/hub-test-suite-soak.test.ts.md`. Existing role clauses cover
the flow; no permission line is added.

## Packaging and Web prerequisite reports

`npm run test:lint` includes report-only install-shaped CLI imports and site test
dependency checks (`node hub/test/lint-prerequisites.ts --help`). Read their findings
as advisory evidence. Web runners and standalone probes report source-stamped
web/dist and resolvable node_modules before existing build/availability handling;
missing prerequisites supply no new refusal or skip during this rollout.
Use the disposable controls in docs/agents/tests/hub-test-prerequisite-guards.test.ts.md;
no local full suite or browser is needed to diagnose these reports.

## Repository auto-maintenance configuration

Init/update write local `gc.auto=0` and `maintenance.auto=false` for the common
project repository and existing territory; doctor reads and reports both keys.
Use the disposable init/update/doctor/native-fetch seams in
`docs/agents/tests/hub-test-init.test.ts.md` for changes to this policy. Ordinary
worktrees inherit common config unless explicit Git overrides supersede it.
Do not apply configuration to the live project as a test. Existing role clauses
cover this flow without adding permission lines.

## Rest memory measurements (T-1478)

Use the sealed memory probe with `--rest-seconds 600` for diagnostic idle runs
and `--rest-seconds 1800` for the final record, only within a Coordinator-granted
measurement slot. The default remains startup only. Require rest-start/end,
heap/RSS/footprint samples and both worker/native disposal receipts. Missing
footprint readings remain unavailable; sampled surviving allocations are estimates,
not exact retained sizes. A guard-interrupted run is partial evidence.

For the separate synthetic load phase, add `--stream-runs 6` to the timed probe.
It uses fake executor receipts through production suite checkpoint/log/result
collection. Require all durable synthetic results and cleaned records in
streaming.json; label these slopes separately from idle. Seed after sealed-copy
preparation, never from live unfinished recovery capabilities.


## Copied memory probe suite recovery (T-1483)

Use prepareCopy before starting a copied-state measurement hub; its backup seal
must precede synthetic streaming job seeding. Preserve manifest.sealing row counts
and disclose excluded suite execution/recovery payloads in memory comparisons. A copied code-0 worker outcome is unavailable until reporting, cleanup and accounting have all completed.
Preparation also seals artifact-index paths and redirects. Fixture isolated verification validates final resolved evidence paths and requires stable native birth/owned cwd for live recovered PIDs, including a positively bound legacy ps-start receipt. An observed dead worker may recover its report without new signal authority; LocalExecutor still validates every live recovered tree/group signal target against native identity and owned cwd before signalling, including recovery SIGCONT (unknown proof retains/fails cleanup); outside files remain unavailable and are never read. The sealed fixture builder grants its scratch allocation alongside the project root; older environments grant only the project.
Never bypass that refusal to recover live jobs. Audit past effects from saved
outputs only and label absent file/signal traces unknown. Existing role clauses
cover this flow without new lines.

Fresh local launches keep a nonpersisted authority bound to the exact lease and
captured native leader birth. The signal fence can extend that authority only
through positively observed native ancestry, retaining captured child births
across leader exit so owned detached children in nested phase roots can drain.
Restore, copied/replaced leases, PID reuse and a group number alone grant none
of that authority; those targets still require the recovery cwd/birth fence.
Lease binding is rechecked after awaited scope proof and at the native signal
boundary. No generic temporary-directory grant is added. The original cancellation and
setup-failure cleanup controls and native no-inherited-authority cases must pass
alongside outside-group refusal and ordinary restart recovery.

## Additive interaction selection (T-1454)

For cland-runner candidates, `[merge] batch_interaction = "report"` defaults to
recording proposed additions without changing configured batch tiers or Web.
Explicit `"run"` executes those additions. Existing or generated configs omitting
the key inherit report; config set/reload uses the same parser. Task-verify
widening remains active. Changing the batch default to run is a separate item
based on recorded batch lines. No role permissions or clause lines are added.

Merge batches compare pinned member heads with the
prepared candidate and follow runtime imports through helpers and re-exports.
Importing or individually unknown T2/Web graphs add those files, retaining
configured batch tiers. Only unavailable scan machinery or phase-wide read/byte
budgets add the whole affected T2/Web phase. Per-file traversal exhaustion adds
that file. Unknown batch graphs never add unrelated T3/T4. Task verifies retain test
files hidden by first-parent dev merges plus roles/area guards. Unavailable or
over-limit task history retains full T1–T4/Web through final command planning.

The graph lazily uses TypeScript's parser, separately from the legacy tokenizer.
Literal import/export, import-equals, require and dynamic-import edges are
resolved, including calls in templates and escaped literals. Non-literal module
specifiers, escaping loaders, eval/Function/vm forms, parse errors, unavailable
TypeScript and unsupported source extensions remain unknown. Bounded direct
createRequire(import.meta.url)(literal) calls and const handles used only in
direct literal calls use the same resolution; other uses remain unknown.

Built-ins are external. A bare package is external only when an ancestor
candidate package.json declares a registry dependency (including dev, optional
and peer entries). The nearest declaring ancestor wins; workspace package names,
workspace/file/link/Git/path specs and undeclared names remain unknown. Candidate
manifests use the same immutable source reader; no live node_modules proof is
used. Missing browser/runtime support still determines whether Web actually runs.

Selection reasons name importer triggers and phase fallback causes;
interactionTests lists every added file; optional batchTests masks execute the
selected T2/Web files while preserving already configured whole phases. Legacy receipts
without that optional field remain readable; cache reuse requires the same set.
Shared graph reads are bounded at 20,000 reads, 32 MiB total, 2 MiB per file and
200,000 traversals per file; each parser walk is bounded at 200,000 nodes. Task history
accepts at most 1,000 merges, scanning 1,001 to detect overflow. This adds no
pass/fail gate or role permission. New precision claims require measurement of
both direct syntax and transitive graph unknowns on a disposable source copy.

## Verification log provenance

Read the final `suite provenance` record when citing a hub verification log on
local or droplet. Name its head/tree, executor/platform, occasion and browser
binary/version; null means unknown or unexecuted, and cache metadata names the
original run. The version-only browser probe is not Web execution proof. Missing
skip reasons remain report-only and never alter the exit status. See
`docs/agents/tests.md#verification-log-provenance`. Existing role clauses cover
this flow; no additional permission line is needed.

## Browser fixture wall time

For a hub FakeClock with browser time windows, use the Date-only synchronization
in `web/test/harness.ts`; extra pages call `fixture.syncPageClock(page)` before
navigation, and release their Date writers with `releasePageClocks` before
native close. Native browser timers keep running. `advance` joins Date updates;
follow a `block` jump with `advance(0)` when its browser receipt is needed.
Use `pausePageClock` for explicit test-owned browser time. Record clock audits as item comments and hub artifacts; keep per-test guide
directories limited to their indexed test guides.

Date observation cleanup still disposes native transports after a drain failure;
register `guardDirectoryRemoval` to retain the fixture root until writers settle.
Use `clockControl` for held-write probes so setup, abort, release and joining are
owned before launch, with separate bounded setup and effect observations.

## Executor lifecycle interface

For executor interface work, call `prepare` with optional progress options and
`reap` with optional authorization options. Backend image keys stay inside the
backend; local operations return typed `not-applicable` results. Local startup
recovery uses `reconcile`, including fixture interception of that boundary.
Keep droplet CLI/frame output and concrete legacy overloads compatible. Use the
scripted interface checks in
`docs/agents/tests/hub-test-executor-prepare-retry.test.ts.md`; native image and
CLI evidence remains in the existing executor tests. No role clause is added.

## Telegram album speech

For album transcription, use the production-frame/fake Bot API and speech cases
in `docs/agents/tests/hub-test-telegram-voice.test.ts.md`. Keep one General upload,
ordered filename-labelled transcript sections, per-file failure isolation and the
first caption. Reuse `voiceNote` and `transcribes`; preserve standalone text,
native ingress maps and the legacy receipt shape. Preserve filename headings in
both workbench bodies; exercise the shared native Telegram marks fixture,
including a filename beginning `not transcribed: ` and a single surviving file
after an oversized peer is refused. No role permission changes.

## Installed verification without the development compiler

For compiler-backed duration identity or test-lint admission, preserve the shared
lazy capability boundary in `hub/src/typescript-capability.ts`. A pruned install
refuses with a single line naming TypeScript unavailable and the unknown check.
Preserve `TypeScriptUnavailableError` through duration validation; only source
findings receive provenance and location lines at admission;
use a source install with development dependencies for verification. Missing
compiler capability is no passing evidence. Keep TypeScript dev-only and ordinary
startup compiler-free. The native installed CLI fixture is documented in
`docs/agents/tests/hub-test-suite-admission-native.test.ts.md`.


## Held-delivery supervision

For queued human input and acknowledged agent reports, use the memory Sessions,
fake-harness and transport-clock seam in
`docs/agents/tests/hub-test-human-hold.test.ts.md`. Retain minute rechecks,
repeated-idle drainage, stale poll-only busy expiry and push-busy controls;
limit repeated-idle/timer replay to durable never-attempted deliveries. Attempted
unconfirmed input keeps its busy-to-idle/reconnect trigger and backoff; explicit
uncertain input stays fenced.

## macOS cover rerun reports

A single recent-green load-gate repetition failure in an integrated or occasion
macOS cover can receive one automatic advisory rerun. Keep both receipts and the
flaky-rerun finding; a passing rerun never changes the original red cover. Recent
means the last five completed covers within seven days with explicit pass evidence.
Report the executed prefix and named unexecuted tail, as described in
`docs/agents/tests.md#macos-cover-load-gate-reruns-report-mode`. Task runs are
excluded. Existing role clauses cover the flow; no permission line is added.

## Claude fallback liveness fixtures

For synthetic Claude resume identities, follow the injected fallback observer
and positive-controlled spawn guard in
`docs/agents/tests/hub-test-claude-code-schedule.test.ts.md`.
Keep the native-default real-PID control in T3 as described in
`docs/agents/tests/hub-test-system-processes.test.ts.md`.

For an explicit Coordinator-granted used-swap waiver, pass the granted ISO end
through `--quiet-slot-until ISO`. Parent/worker enforce its load, pressure,
no-new-swap-out and expiry predicates through the shared machine checker.
Record the Coordinator's baseline/waiver and all machine receipts, and allow
copy/rest/disposal time before slot expiry. Source changes still need fresh
review before measurement. Without a grant, keep the default swap thresholds.

The quiet-slot pressure predicate uses `kern.memorystatus_vm_pressure_level <= 1`.
The transient `vm.memory_pressure` counter and free-memory percentage are context
only; retain original aborted records rather than relabeling their raw counters.

The manual memory probe defaults to the human-agreed256MiB heap/768MiB RSS
report-only limits (ask53ad10db); flags provide explicit overrides. Preserve
prior unconfigured diagnostic receipts and record the agreement with final evidence.

## Operator retry of queued input (T-1473)

`cland session retry <name> [message id]` is human-only. It forces one human
message queued over 60 seconds through busy, requiring transport acknowledgement
before native injection. Omit the id to select the oldest eligible queued or
uncertain delivery; older hubs require the id. Refusals retain the legacy
`no uncertain delivery` phrase and report recipient stage and queue age.
Preserve attempted-unconfirmed recovery and the uncertain fence.
Use the memory/fake-harness controls in
`docs/agents/tests/hub-test-human-hold.test.ts.md`; no new role clause is needed.
