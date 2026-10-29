# hub/test/discord-cards.test.ts

T2, production hub frames and native Discord REST/ws through the sealed exchange
owner. Run this file alone: `node --test hub/test/discord-cards.test.ts`.
No browser, real platform or real credential is used. The exchange owns hub stop,
native drainage, Store close and fixture removal, in that order.

The generated cases cover nine short options in rows of five/four plus the two
secondary actions; numbering and an intact option list for long labels; native
content budgeting for a large question; a stored Discord answer observed at the
native type-7 callback boundary; a held topic.answer deferred at exactly 2000 ms
and completed through a settled outbox edit; coalesced publication oldest first
while General is muted; foreign/unissued/out-of-range button refusal; modal answers and declines; and stop before and after deferral with no late edit or timer.

Advance the shared fake clock 250 ms after committed asks to publish the inbox.
Wait for the durable remote message mapping before pressing. `interact` accepts
`message_id` and `custom_id` to emit a component interaction, and defaults to the
paired human; `user: "member"` selects the foreign member. Its state contains
callback arrival timestamps and enforces a strictly-under-three-second initial
callback. Type 7 updates the original fake message. The optional onCallback
observer sees only interaction id/type and proves the durable hub-result receipt
exists before native callback acceptance. Interaction tokens stay in adapter/fake
memory and never enter frames, outbox payloads or exported receipts.

Existing command interaction shapes and historical Discord outbox payloads remain
valid. Restart tests must respect the persisted five-second Identify reservation;
the restart cases below assert successful resume catch-up.

`Discord lost defer response still settles the committed outcome without a second callback`
uses `interact` with `lose_callback_response: true`: the fake accepts the initial
callback, then destroys its native response. The production hub result must still
produce a settled outbox edit, remove buttons and retain exactly one type-6
callback. Enqueue the owed edit independently of defer success and join both
owners on stop.

Modal and shared-gate coverage uses both production messenger factories and both
loopback fakes in one sealed project. `interact` with `modal_text` emits a type-5
Label/Text Input submission; component clicks still use the previous shape.
Assert type 9 with question Text Display before Label/paragraph input, then the
stored outcome, native update and Telegram edit. Use `driveTelegram` only from
durable pacing waits. Web and Neovim frames, Telegram presses and racing native
presses check the same outcome; closure cases assert REST settlement and removed
buttons. The held-channel case arms `waitForHold` before publishing, observes a
queued card, closes its ask, releases the native request and checks `dropped`
plus absence of any native card mapping. No browser is used by these frame tests.

Accepted-but-unmapped cards survive closure and adapter restart: hold the native
POST after storage, answer through a workbench, stop the adapter to lose its
response, then restart after advancing the persisted five-second Identify budget.
Assert the original native id is mapped, exactly one native copy exists, the
same enforced nonce is used on recovery, and its durable edit removes buttons.
Unattempted closed cards still drop. Recovery outside the original two-minute
nonce window remains fenced; no new send window is granted by closure.

`holdRequest` registers the rejecting hold observer with the exchange before
producer setup can yield. Setup failure aborts and joins the observer and releases
holds. Omitted and pre-aborted setup controls check intended bounded failure,
zero exchange work/observers/holds, then native close, handlers, sockets and fake
clock timers. Node's test runner treats any unhandled rejection as a failure.

The post-map/pre-fold interruption control uses the public native outbox seam
and an injected throw immediately after the real `writeOutbox` completion/map
transaction returns. It keeps the actual accepted fake message, durable closure
and pending General job, stops the first owner, then closes and reopens SQLite.
The new owner must reconstruct the owed edit before draining General. Assertions
retain the original native id, one card copy, removed buttons, outcome, durable
edit settlement, native PATCH-before-General-POST order and a no-I/O second resume.
This models the persistence checkpoint; it does not claim OS process-crash timing.


Private-refusal and inbox cases (T-1410) assert an answered-elsewhere click's
exact ephemeral Already answered callback with no topic.answer frame, settled
button removal, foreign clicks and modal submissions with no frame or native
card change, and unissued/cross-ask ids. The inbox case checks empty output,
oldest-first durable mappings, fresh keys on repeated commands and closure of
every mapped copy. Advance the fake clock by five seconds between bursts to
respect the fake's learned channel bucket; this is pacing setup, not a timing
measurement. No wire or persisted payload shape is changed.

The losing-answer cases hold topic.answer while a workbench wins. Before
deferral they require the private callback; after the exact two-second type-6
acknowledgement they require an ephemeral follow-up. Both retain the winner's
settled outcome with no buttons. A deferred update alone is not refusal evidence.

The accepted-type6/lost-response loser still owes an ephemeral follow-up;
assert its native receipt independently of defer transport success. Held
inbox.list controls revoke or replace the admitted pairing before releasing
the frame and require command settlement with no newly enqueued card. The
command rechecks its captured numeric guild/channel/user before publication;
outbox admission continues to guard later native I/O.

The restored-delivery control seeds the durable unavailable checkpoint with a
healthy fake REST endpoint, then requires /cland inbox's mapped native resend.
Only explicit resends probe availability; original attempt receipts, source
closure and nonce deadlines still apply. This models the persisted checkpoint,
not the preceding outage's network timing.

The initial-ack ordering control holds type6 before fake acceptance through an
async onCallback barrier. The content-free remote log event
`discord-card-refusal-ready` is emitted after the losing inbox result is consumed.
Only that owned receipt releases the native hold; the final trace must be
ready → accepted → followup, alongside the native refusal receipt. The
`discord-card-refusal-followup` event marks invocation immediately before I/O.
Removing the acknowledgement join must produce ready → followup → accepted.
No elapsed delay selects the boundary. Initial acknowledgement settlement is
joined with a caught transport error before follow-up I/O; a lost response still
permits the owed refusal. The trace carries no identity, token or message text.

Approval and notice coverage (T-1411) keeps production frames and fake native
Discord I/O. The generated Codex/OpenCode approval cases use
`fakes/remote-approval-harness.ts` and observe each scripted command receipt.
A 5000-character command must fit the native 2000-code-point budget with the
workbench marker, correct session/harness and offered Success/Primary/Danger
choices. The native callback observer checks the durable approval outcome's
Discord provenance before acceptance. A second case rejects cross-kind,
unoffered and foreign keys, resends via `/cland inbox`, and requires settled
REST edits on every copy after a Neovim answer and private stale refusal.
Existing direct outbox tests retain historical ask payload compatibility.

Notice cases run with and without a fictional HTTPS `.invalid` public origin;
the fake preserves only that exact declared origin, still scrubbing credential
URLs (including paths/queries on the same origin). Plans, review requests,
item messages and Claude Code terminal approvals have durable native mappings
and no components. Request replies retain their topic and replyTo; plan replies
reach General with the plan reference. Advance five seconds between native
reply bursts for learned bucket pacing; this is setup, not a latency claim.
No real browser or platform is used.

Long-plan-title controls repeat the notice/reply cases with 2500 supplementary
Unicode characters. Both configured-origin and unset-origin cases retain the
complete workbench instruction; the configured origin remains intact, with a
visible ellipsis in the variable title and at most 2000 native code points.


T-1412 restart cases use the production factory, persistent SQLite and the same
loopback fake across fully joined hub lifetimes. A 30-second injected restart
must close with 4000, send RESUME and spend no further Identify. Native buffered
MESSAGE_CREATE reaches durable General once with the written and return HH:MM;
the setup crosses a minute boundary. A buffered component press answers nothing,
has zero callbacks and produces only its mapped card's second durable copy;
the original native edit removes components and reads “↓ Re-sent below”.
The unpressed peer stays single. CLI config disable plus reload must close with
1000; re-enable plus reload spends a fresh Identify with zero resumes. Set the
fixture-local verification lock before startup so the managed config survives
harness isolation. Session, interaction and replay-intent keys are additive;
previous wire and outbox fixture shapes remain unchanged. No browser is used.


Source-review corrections retain seven additional native controls: real scripted
colon-bearing approval IDs, long fenced approvals, full numbered Unicode option
explanations, handled stale-topic refusal followed by valid input, interrupted
held ingress confirmation, minute-crossing live resume, full replay-input drain
before resend, and fatal close followed by full owner shutdown. The approval case
combines the identity and long-content checks. Budget the warning before rendering
variable content. A handled refusal has a durable inbound tombstone and keeps the
hub/remote live; cancellation has no tombstone and replays after restart.

For replay ordering, hold the exact later topic.send frame after buffering a press
first. The content-free `discord-replay-drain-waiting` diagnostic marks RESUMED
entering the input join; the test retains mapping count one and no inbound receipt
before release, then asserts General content, second native mapping and old-copy
edit. No live interaction callback waits on this replay join. The socket captures
the return time per RESUME connection. Fatal 1000 disposal clears both persisted
and in-memory session facts so subsequent stop cannot resurrect them.


Every RESUME closes recovery admission before native RESUME I/O,
independently of replay event kinds. The no-new-press control seeds one owed
resend intent, holds buffered MESSAGE_CREATE, and triggers a separate inbox
publication. Its peer card's durable mapping proves publication completed while
the owed card remains single. After release, wait for the durable stored-reaction
settlement before advancing the250ms reaction bucket; then retain input, resend,
zero-new-interaction and old-copy edit assertions. The warning-rendering and
sessionless-ledger case-name migration retains the owning exact duration key at
0.115632; no timing totals or allowances change.

M8/Linux load correction: the buffered-press ordering control closes its old
coordinator and reconnects before releasing input, with the exact delivery observer
already owned. Hold the native stored reaction until delivery is durably recorded,
then release it, observe its durable sent settlement and advance the250ms reaction
bucket. Without that advancement the same deterministic setup times out at input
then resend completion; early feedback can also strand the old-copy edit. Preserve
the original bounds, no-early-resend assertion, exact General text, native resend
mapping and old-copy content/components assertions. Native pacing time is fixture
setup, not elapsed performance evidence.

T-1413 fresh-Identify recovery uses the same production frame/fake seam. The
fake's `say` control retains history without emitting live events; `contents`
adds a batch in one owned request, retaining the previous single-message shape.
The fake channel projects its newest retained id and pages newest-first with
`before`. The cap fixtures set a zero reaction window to avoid simulating separate
pacing waits; other cases retain the native 250 ms reaction bucket.

The fresh history cases retain ordered late input, no zero-count gap, replacement
mappings and old-copy edits. The interruption case stops a joined in-process hub
with its second ingress held after the first commits; it proves the persisted
batch checkpoint, rather than claiming an OS kill. The gap fixture seeds missed
General jobs while the hub is down, including two parts of one source, and checks
the silent source-counted native line precedes replacement cards.

Source-review corrections cover a genuinely resumable stop during a fresh history
batch, with no recovery-session deletion, and a live drop/RESUMED while its later
input is held. Require the frozen batch before replayed text, replacement maps
and old-copy edits; retain the original ordered inputs exactly once. Recovery
joins the history owner rather than a snapshot of the current inbound tail.

Gap and cap-warning controls inject a POST-only definite refusal or hold after
native acceptance. The overflow control seeds the frozen warning checkpoint;
the T3 620-message case separately proves full-scale selection and forwarding. Both keep
the saved obligation until that exact durable job is sent. Stop/restart beyond
the original nonce window must keep the original source count or frozen batch,
admit no replacement card and make no second warning POST. Assert native silent
flags, enforced nonce, one accepted copy in the lost-response case, and no
accepted copy after definite refusal. A drained queue is not acknowledgement.


The T2 cap control injects20 through the native adapter's optional historyLimit
seam and runs25 real frame inputs; it checks ordered durable newest20, exact
silent overflow settlement, then the source-counted silent gap and a separate
bounded topic.send during active catch-up. The production constant is500,
asserted once without the full T2 workload. The native fixture lives in
`hub/test/discord-cards-fixture.ts` and is shared with the full-scale T3 case in
`telegram-polling-restart.test.ts`; no test definitions are imported by it.
Existing constructors/factories omit the optional seam and retain500.

Full-all correction: a replacement mapping is earlier than old-copy retirement.
Late delivered reactions can own the same lane after the final mapping; stopping
FakeClock there strands their 250 ms bucket and the queued old-copy PATCH.
The completion helper waits for both mappings and each exact old-target edit's
`sent` receipt. It advances one 250 ms bucket per newly observed durable native
reaction completion, without repeatedly advancing time through in-flight I/O.
The original 3 s recovery and 2 s native-content bounds remain unchanged.

The late-feedback control holds the second replacement after native acceptance,
connects the Coordinator and observes a real delivered human message while that
send is held. Card ids are sorted to match the persisted replay-intent order.
After releasing the held send, retain exactly two mappings per ask, every old
copy's native retirement text and empty components, and exact edit settlements.
With the old map-only driver this reproduced the peer-edit timeout in all five
local runs alongside two busy workers: reaction sending, later reactions queued,
peer edit queued. With the receipt driver both the control and original identity
passed five times under the same load. These local CPU-load samples do not claim
a slow-disk or Linux pass; configured verification and full-all remain required.
