# web/test/hosts-view.test.ts

The held boot transition waits for the rendered waiting-host reason with the
shared load-scaled 15-second setup budget. The provider stays gated until that
positive row receipt, retaining the booting, placement and departure assertions.

Web tier, disposable projectHub and lockfile-pinned Chrome Headless Shell with
its own user-data-dir. Run on supported Node with inherited `CLAND_*` variables
removed: `node --test web/test/hosts-view.test.ts`. The before hook builds missing
or stale web output. No real provider, SSH, credential or harness login is used.

`Hosts Stop preserves cancellation and reports native deletion outcome: confirmed true`
and `confirmed false` drive the real authenticated web `host.stop` handler, using
the directory-only fake provider, test Hosts and the in-process Codex adapter.
It reads the named host and session count in confirmation, observes ready
inventory after Cancel and folding, then observes durable destroyed inventory
before advancing the hub FakeClock for the coalesced push. It keeps final
assertions for the detached host row and the exited process in `session.list`.
The incomplete control returns a native provider refusal to confirm deletion,
retains destroying inventory, and checks its native state/reason on that host row.
Both lock process dependencies are fake. Fixture owners join the hub and browser
before directory disposal; the fake machine directory has an explicit owner.

`Hosts login binding swap with equal pool totals renders from the durable mutation
within one second` captures the hub-owned HostRecords at the registry factory.
It swaps the bound login without changing the pool summary, retaining a literal
deep-equal check of those totals. The observer precedes mutation and the exact
one-second bound includes production coalescing, the socket replacement,
login.list refresh and DOM rendering. No carrier frame is injected. The final
rows must read ready/unbound and in-use/bound respectively. This control failed
before the producer's login invalidation fix.

`Hosts view lists login metadata and refreshes pushed changes (desktop)` and
`(phone)` seed two disk logins and compare the rendered metadata with the local
human `login.list` response. A fake socket carrier supplies two hosts and
`hosts.state` pushes; login reads still go through the real authenticated handler.
These cases prove push-to-render within one exact second for bound, released and
signed-out metadata, rather than measuring producer coalescing. They check the
warning token, a refused Stop on the affected host line, and no `host.status`
request. The phone case checks document and view width at 320px.

Existing `web/test/hosts.test.ts` retains production projection/coalescing,
uptime, counts, outage recovery, folding and previous-hub snapshot coverage.
No wire, native lifecycle, authority or keyboard contract changes. Native T3
receipts remain with the merge occasion; T4 and real stage QA run on dev under
the epic brief. Mode-free Linux verification after source review supplies
T1/selected T2/Web evidence; local targeted macOS results are partial evidence.

`Hosts Remove confirms and cancels disk login deletion` covers C1: a real fake
volume with a snapshot remains after Cancel and fold/reopen, a fresh confirmation
names the login and volume/snapshot deletion, and confirmed removal commits an
empty local-human `login.list` before the DOM row disappears. Provider inventory
then proves both resources gone. The key variant checks no Snapshot action,
confirmation of key-file deletion, retained encrypted file after Cancel/folding,
and removal of that file with an empty `login.list`.

`Hosts Remove hides bound actions and keeps hub refusal on the retained login`
covers C2: after startup reconciliation completes, the view-boundary fixture
creates a fake-provider disk and binds it through LoginRecords, keeping the
FakeClock still. Both current `login.list` state/binding and rendered in-use/host
text are positively asserted before checking that Remove is absent; a creating login receives the same
running-sign-in refusal through the web as the local human socket. The login list
is deep-equal before/after refusal and the row remains rendered.

`Hosts Snapshot reports durable success and provider window refusal on the disk
line` covers C3/C4: the authenticated web action commits one snapshot id visible
in `login.list`, the provider confirms that snapshot, and the line names the id.
A second action inside the fake provider's window displays its `rate limited`
refusal and retains the exact snapshot id set. The hub and page Date share one
FakeClock; no real provider or sign-in runs. These four added cases are Web-only;
no hub producer, connect order, wire shape, authority or native lifecycle changed.

T-1827 adds the following generated Web cases:

- `Hosts Add shows the shared codex card and clears sent input`
- `Hosts renew shows the shared codex card and clears sent input`
- `Hosts Add shows the shared claude-code card and expires without input`
- `Hosts renew shows the shared claude-code card and clears sent input`
- `Hosts Add moves the real inbox login wait through booting to placed`
- `Hosts native codex Add completes the fake harness disk sign-in`
- `Hosts native claude-code Add completes the fake harness disk sign-in`

The first four use projectHub's real web/card handlers and injected preparation
and interactive input/close owners. The FakeClock also sets browser Date. They
prove inline links/codes, disk renewal, ready metadata via the local-human
`login.list`, exact Claude input, expiry, and no submitted input in page text,
storage or console. Expiry observes signed-out state after the injected close.
The waiting case uses the actual pool runtime, a directory-backed fake volume
and machine, in-process Codex adapter and real inbox frames; no socket carrier is
injected. Its waiting line must show the login wait, then the named host boot
wait, then leave after session.list contains the exact process/host and the
inbox list is empty. The injected creator stays held until the readiness trigger,
and its release is registered before hub construction for failure cleanup.

The two native cases use login-native-fixture, fake SSH/SCP, FakeHostProvider
and the fake Codex/Claude binaries. Each adds a disk from the browser, observes
ready and one snapshot, expires the retained fake credential, clicks Sign in
again, and proves the same volume and host plus two native closed/code-0 receipts.
They never authenticate a real account. Run this file under the epic's native
preservation slot, one file at a time; inventory hc-, ct- and cland-h- entries in
/private/tmp before and after, retaining known cland-h residue. No GUI browser.
The shared observer returns bounded redacted snapshots without importing the QA
skill policy. These Web cases select only native close receipts for publication;
the native integration reporter separately scans its entire diagnostic. The
unchanged `hub/test/typecheck.test.ts` proves the Web compiler inputs still work
in a scratch linked worktree whose commit contains the workspace closure.

Neovim's half uses the unchanged inbox frame and renderer; the pool/inbox
producer is exercised here and the existing Neovim waiting-launch regressions
cover its rendering (`nvim/test/inbox-sections.test.ts`, generated case `waiting launches render facts and replace reasons without needs-you or departure rows`).
No new Neovim action or wire shape is introduced. Linux mode-free verification
supplies T1/selected T2/Web; local native results name their exact head; remaining
T3/T4 and integrated Neovim QA belong to their stage/epic occasions.

Source-review correction controls: every injected sign-in case now captures the
returned card id, folds/reopens and reloads, and requires the same id/link/input.
`Hosts renew shows the shared claude-code card and clears sent input from another
surface` keeps an inline draft, answers the captured card from the local-human
socket, then checks the folded input, ready metadata and secret absence. Only
captured login/card ids enter tab sessionStorage; answers never do. Terminal
cards are pruned. The existing hub/wire replies remain unchanged.

`Hosts Add harness choices use only pool roles and actual logins: actual false`
and `actual true` assert the exact role-only or role-plus-disk choices, exclude an
unrelated regional login, prove a pool with no relevant role/login has disabled
Add, and prove a login-only pool contributes its harness. The all-zero summary
still carries all three keys and must contribute no choice.

Native cases configure the pool role through real `role.launch` hot-apply before
opening the browser. Their preparation wrapper captures the actual hub-owned
HostRecords and every returned plan's host/name/renewal flag. Before renewal,
the browser observes the real prior ready `hosts.state` publication (one usable
login, none signed out), so the previous coalescer callback has completed. The
fixture changes the credential file and marks signed-out through that captured
hub owner; a separately observed signed-out publication and the anchored DOM
state/reason precede the renewal click. Both admitted plan.host receipts must
match the sole host. The separate Store is read-only for assertions; no fabricated
push or cross-Store invalidation is used. Real socket observers arm before page
navigation and the Add trigger. Native close/same-volume assertions remain.

`Hosts Add shows the shared codex card and clears sent input after slow preparation`
and `Hosts renew shows the shared codex card and clears sent input after slow
preparation` hold the injected preparation before card publication. Setup observes
one admitted preparation, then advances the hub FakeClock and paused browser
clock together by exactly 10,001ms. The control must remain disabled beyond the
old generic command deadline. A real mouse click on that disabled control must
leave exactly one outgoing Add/renew request and one preparation. Releasing the
registered gate produces a real hub result; its captured name/card must match
the inline card before and after fold/reload, then the durable ready login.
The gate's failure release is registered before hub construction. The red
controls failed with an enabled control at the old deadline. No wall-clock
10-second sleep is used; both clocks stay aligned and native fixture cleanup is
joined. Other web commands retain the 10-second default; only these two command
types receive the named 16-minute receipt window. Missing receipt is unknown,
never an automatic resend or a native failure receipt.

Authoritative association controls add `before receipt fold` and `before receipt
reload` to both slow Codex Add and renewal cases. They remount or reload while
preparation is still held, then release it and assert the inline id equals the
persisted trusted code card. The reload case explicitly has no captured result
callback. A second post-publication reload proves flattened InboxAsk restoration.
`Hosts Add shows the shared codex card and clears sent input at previous wire
shape` strips only the optional signInLogin field from real frames to exercise
new-client/older-hub compatibility for already captured receipts. It does not
claim pre-receipt recovery against an older hub with no authoritative metadata.
The T1 signin-card-identity control proves only persisted hub metadata can project
the login name and retains the exact ordinary previous shape. The hub-cards T2
control proves fresh inbox, persisted history and terminal frames retain that
identity without native payload fields. Native login-card-signin remote frames
assert the new safe identity; secret-answer rules remain unchanged.

The connection maintains the active sign-in index incrementally at every live,
inbox, message and recovered-card ingestion point. Hosts rows use the production
constant-time selector and react to index identity changes. The one-second
uptime render does not enumerate retained terminal/history cards. The T1
synthetic work-count controls for selector and publication are documented in
hub-test-web-area-state.test.ts.md.


`retained cards keep Inbox, Hosts sign-in and remote thread order across delta
and inbox publication` uses the existing scratch hub and isolated Headless Shell
with scripted socket frames. It seeds two real scratch login metadata rows and
four open cards, with deliberately different insertion, Inbox-row, login-row and
remote-message orders. Actual Inbox card headings, Hosts sign-in card ids/text,
and Discord/Telegram topic card ids/headings/provenance are asserted before and
after live deltas. A subsequent flattened inbox publication carries stale text;
newer retained card text and each surface's caller order must remain intact.
The changed remote heading is observed before republication. The final inbox
frame carries a unique stale question in its flattened row preview: a bounded
observer is armed before pushing it, and its rendered preview is positively
asserted before rechecking all three surfaces. Retained card headings must keep
the newer delta text while that row preview proves exact publication consumption. This is rendering coverage; the T1 radix budget test remains the work
count evidence. It does not exercise a real remote provider or native sign-in.
Existing terminal, reconnect, competing-answer, and previous-wire tests remain
unchanged.


That case registers `caseDeadlines` with the shared `beforeDirectories` and
`guardDirectoryRemoval` adapters before any fixture acquisition. Its whole body
runs through `owner.run`; webFixture, preparation and pageCase receive the
proxied `owner.fixtures` context so their teardown hooks are captured, including
late acquisitions. The project factory adopts the root before returning it.
Shared steps fence subsequent admission; normal and signal cleanup join the
complete acquisition/page callback before invoking captured native/root and
environment teardown. An incomplete join retains the root. The unchanged T2
`hub/test/case-deadlines.test.ts` controls exercise held acquisition/writers and
startup/teardown expiry; the normal browser census alone is not cancellation
coverage.
