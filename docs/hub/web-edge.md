## Web edge

The hub also owns an independent **web edge**, an HTTP listener defaulting to `127.0.0.1`.
It serves the installed `web/dist` bundle. Its stable port is `webPort` in
`.cland/hub.json`; `port` remains the spokes' WebSocket port. With `[web] port = 0`
(the default, also when unset), the first start chooses a free port and keeps it
in the volatile, ignored `.cland/web-port` file across restarts. An explicit
`[web] port` (1–65535) overrides that file without replacing the kept automatic
port. A taken port never causes a move to another origin: the hub starts with
its spoke and Unix-socket edges, logs `web-unavailable` with the port and reason,
and reports `{ port, bind, available: false, reason }` as `hub.status.web`.
`cland hub status` shows the web URL or that reason in its hub block, before
`sessions: N` and the connected session rows; `cland doctor` warns. Free the port or
change the setting and restart the hub. A running edge reports
`hub.status.web = { port, bind, available: true }`; stdio-only hubs omit it.

The composer’s **Attach a file** opens the file picker. It keeps chosen files in
memory per topic, shows their names and byte sizes, and sends them with the text
as one human message. Existing artifact chips can accompany new files. Failed
sends retain the files for retry; a page reload requires choosing files again.
Oversized files show Refused with the configured limit in a tooltip. No file
shortcut is added; existing Enter, newline and artifact-picker keys still apply.

`POST /upload` on this listener accepts multipart `topic`, `text`, `kind`, optional
JSON-array `to` or `replyTo`, optional JSON-array `artifacts` (existing ids in that
topic), and 1–10 file parts. It requires an active web cookie, allowed Host and
exact page Origin before reading bytes. It returns 401 without the cookie, 403
for Host/Origin refusal, 405 for other methods, 400 for malformed multipart and
413 on declared/streamed body overflow or per-file overflow. File bytes are capped
by `[artifacts] max_upload_mb` (50 MiB by default); total wire bytes, including
multipart framing, are capped at ten times that setting. The streaming reader
uses one bounded wire buffer and transfers its private file views without copying
payloads again; native callers retain their protective copy. This ownership bit
is trusted transport metadata, never a frame field. It passes bytes beside
`artifact.upload` through an authenticated web conversation, retaining its human
authority, auditing and registered-secret refusal. Cookie admission and open
conversation state are checked again before writes and commit. Revocation and
edge shutdown close HTTP upload admission, stop streaming reads and join native
writers plus rollback before returning; disconnected uploads cannot commit. The JSON response is the normal
result frame, whose successful `value.message.id` identifies the committed message.
`X-Upload-Max-Bytes` on bundle HEAD responses supplies the composer’s current
per-file limit; older hubs without that header leave file selection unavailable.
The optional `artifact.upload.artifacts` array adds existing topic artifacts;
omitting it keeps the previous request shape and behaviour. Existing artifact
availability is checked before preparation and again at commit. These routes
require an available listener; stdio-only hubs have no HTTP uploads.

### [web] configuration

All four keys are optional in `.cland/config.toml`:

| Key | Default | Accepted value and effect |
| --- | --- | --- |
| `bind` | `"127.0.0.1"` | IPv4 or IPv6 address, without a zone id; binds only the web edge. |
| `origin` | `""` | Empty or an HTTPS tunnel origin, with an optional port and no credentials, path, query or fragment; admits that Host and exact Origin and supplies QR links. |
| `port` | `0` | Integer 0–65535; zero chooses and keeps the first free port, a nonzero value fixes the listener port. |
| `dist` | `""` | Bundle directory path without NUL; empty uses the installation's `web/dist`, otherwise relative to the project root or absolute. |

For development, `[web] dist = "path/to/bundle"` serves another bundle; relative
paths resolve from the project root, absolute paths are accepted, and the empty
default uses the installed bundle. Apply `[web]` changes with `cland hub stop`
followed by `cland hub start`; reload refuses changes to the parsed `web` table
with `web changed: restart required` and keeps the loaded config and roles.
Equivalent parsed values still permit a reload. The defaults are:

```toml
[web]
port = 0
bind = "127.0.0.1"
origin = ""
dist = ""
```

`[web] bind` accepts an IPv4 or IPv6 address. A LAN address opens only the web
edge there; the spokes stay on `127.0.0.1`. Wildcards `0.0.0.0` and `::` expose
local interfaces, whose addresses join the Host allow-list at startup. Loopback
Hosts (`127.0.0.1`, `localhost`, `[::1]`) and the bound address require the exact
web port; foreign Hosts and duplicate Host headers are refused. `hub.status.web.bind`
reports the actual bound address; `hub.status.spokeBind` reports the spokes’
listener address from its server. On a wildcard bind, a normal link uses loopback;
on a concrete bind it uses that address.

`[web] origin = "https://phone.example"` names the human's HTTPS tunnel, with an
optional port and no path, credentials, query or fragment. Its Host joins the
allow-list, and that exact HTTPS Origin is required when upgrading with that Host.
The tunnel must preserve Host and Origin. The last hop may be plain HTTP: forwarded
headers (`Forwarded`, `X-Forwarded-*`) are never trusted. A cookie issued when
both Host and Origin match this configured origin carries `Secure`; other requests
do not gain `Secure` from a forwarded header. A top-level GET may omit Origin, in
which case this rule does not set Secure. The tunnel and its TLS are human-managed;
cland starts no tunnel service.

### cland web options

Run these from a human shell in the project, with its hub already running:

| Option | Effect |
| --- | --- |
| No option | Print a one-time sign-in link and open it with the platform browser opener. |
| `--no-open` | Print the link without opening a browser. |
| `--qr` | Print the phone link and a terminal QR code without opening a browser; may accompany `--no-open`. |
| `--sessions` | List unexpired browser sign-ins with public id, creation, last use and socket count; mint no link. |
| `--revoke <id>` | Revoke that browser sign-in and wait for its server-side sockets to close; mint no link. |
| `--help`, `-h` | Print command help without contacting a hub. |

`--no-open`, `--sessions` and `--revoke` are mutually exclusive. `--qr` cannot
combine with `--sessions` or `--revoke`. Revocation requires a nonempty id.

`cland web --qr` prints the one-time link and a Unicode half-block QR code with a
four-module quiet zone and explicit terminal colours. It never opens a browser;
`--no-open` may accompany it. The link uses `[web] origin` first, otherwise the
concrete LAN bind (for a wildcard, the first usable non-internal local address).
Selection skips loopback, unspecified/multicast and IPv6 link-local destinations
(`fe80::/10`): a link-local zone belongs to each device, so the hub’s scope id
cannot be put in a phone URL. With no usable LAN address, QR mode refuses with
the reason and suggests a tunnel or a LAN bind.
Loopback alone refuses with a reason: a phone cannot reach it. QR encoding uses
the vendored MIT-licensed Project Nayuki encoder, with no runtime package dependency.
The QR and printed URL contain the same five-minute single-use token: treat both
as sign-in credentials. `cland doctor` warns when a network bind has no tunnel:
plain HTTP carries the cookie in clear and gives phones no notifications or install.

### Browser sign-in and protocol

In users mode, local admins approve a remote code with
`cland remote approve <messenger> <code> --user <name>`; Neovim's pairing card
asks for the user. Omitting the selector is refused. `user_remote_pairings`
stores the project `user_id` separately from `messenger_user_id`. A replacement
changes only that user's messenger binding. Existing single-mode rows remain in
`remote_pairings`; on entering users mode their ownership expands to the first
user without changing those rows. Input identity comes from the native pairing,
never from frame fields, and passes the shared user-role check as well as the
gateway's existing transport restrictions. An allowed users-mode gateway request
without native pairing identity is refused with "Remote input requires a pairing
with a project user" before its role is checked. Stranger presses on mapped
bot-authored Telegram cards get only their private refusal alert; that path
does not need a paired sender and sends no hub request. The pairing journal event records
`userId` and `approvingUserId`, never the code.

`cland remote unpair <messenger> --user <name>` removes only that user's binding
in users mode. Without the selector it lists paired users and refuses; a session
shell cannot manage pairings. Single mode keeps its existing command behavior.
Auth reset keeps the first user's current binding for each messenger and revokes
the others in the same reset transaction. Outbound publication currently uses
the first user's destination; fan-out is a separate stage.

In users mode `/invite?token=…` opens the registration view, offering a passkey first and a password fallback. Invitations
expire after 24 hours; unknown, expired, used and revoked tokens receive distinct
refusals without a cookie. Single mode returns 404 for all invite routes.
Navigation GETs accept an absent Origin; an Origin supplied on navigation must
match exactly. `POST /invite/details?token=…` reads the invited user's name;
`POST /invite/register` accepts only a bounded JSON body `{token, password}`.
Both API routes require the exact page Origin, and every route checks Host.
Passwords require at least 12 characters (maximum 1024 UTF-8 bytes) and are stored
as independently salted scrypt records in `user_passwords`, never sent as frames
or written to logs/journal. Registration rechecks admission after hashing and
commits credential, activation, invite consumption and user-bound session in one
transaction. A failed commit leaves the invite usable. Edge shutdown drains
registration work before closing storage.

In users mode an unauthenticated root navigation redirects to `/signin`.
`POST /signin/password` takes bounded JSON `{name, password}`; wrong passwords,
unknown names and invited-only names receive the same refusal. Admission and
credentials are rechecked after scrypt completes. After five failures, per-name
and per-client-address retries have an exponential delay capped at 15 minutes;
these bounded, volatile counters reset on hub restart. These APIs require exact
Origin and admitted Host. Profile's `POST /signout` revokes only the authenticated
cookie's session, drains its uploads and closes its sockets before returning;
other browser sessions remain active. Revoked tabs use `/signin/status` to return
to sign-in. Single mode retains its disconnected strip and one-time link flow;
credential and sign-out routes return 404. There is no new CLI command or role
permission.

Passkeys are offered only where WebAuthn is available in a secure context. Plain
HTTP LAN pages offer the password and explain availability in a tooltip. The RP
ID is the hostname of configured HTTPS `[web] origin`, otherwise `localhost`;
user verification is preferred. In users mode without a configured HTTPS origin,
GET `/invite` and `/signin` at `127.0.0.1:<port>` redirect to the same path/query
at `localhost:<port>` with no-store/no-referrer headers. Browser navigation and
cookies remain on localhost; an authenticated `/signin` navigation returns to `/`; exact-Origin APIs refuse cross-host origins in both
directions. Single-mode links are unchanged. No dependency or CLI command is added.
`POST /invite/passkey/options` takes `{token}`; `/signin/passkey/options` takes
`{name}`. Their `/finish` siblings take `{challenge, response}` with canonical
base64url credential and response bytes. All require admitted Host and exact
Origin. Options and response bodies are bounded; only HTTP carries responses,
never frames, logs or journals. Challenges are volatile, capped at 1000 pending,
expire after two minutes and are consumed on every finish attempt. Restart,
edge close and auth reset discard them. Registration uses the shared WebAuthn
verifier with attestation `none`, ES256 or Ed25519, atomically committing invite
consumption, activation, public credential and session. Sign-in checks credential
ownership and signature, then advances the counter synchronously before issuing
a cookie. The `passkeys` table contains only user ownership, credential id,
public key and counter; multiple credentials per user are supported.

Every edge cookie goes through `webSessionCookie(auth, token, request, origin)`
in `web-auth.ts`, including `/auth`, invite registration and password sign-in: Path=/, HttpOnly,
SameSite=Strict and a fixed 30-day lifetime. The current Secure condition requires
configured web origin, matching Host and exact request Origin. Existing local
one-time links retain their behavior. No new CLI verb or session permission is
introduced; password sign-in and passkey ceremonies use this same cookie seam.

In users mode ordinary queued messages can be withdrawn only by their persisted
user id's author. The authenticated connection supplies the caller id; names and
`userDisplayName` never grant ownership. Legacy null-user messages retain the
first-user display projection and carry optional `legacyUser: true`; any admin
may withdraw them. `withdrawable` describes delivery eligibility, while the web
applies the shared ownership predicate with `web.session.user.id` and `role`.
The existing `userAuthorityRefusal` role check runs before dispatch on web and
local withdrawal requests; local withdrawal uses the first user without `--as`.
Single mode and older hubs without user attribution retain the `from: human`
fence. No new role permission or keyboard binding applies.

In users mode local human writes default to the first user. `--as <user>` on
`cland topic create`, `topic answer` and `artifact create` selects an existing
active user's exact name; display names are never selectors. The `topic.send`
and `approval.answer` frames use the same local `as.name` resolution (there are
no CLI verbs for these frames). Both the first user's and the selected user's
stored roles pass through `userAuthorityRefusal` before replay. Unknown or
invited-only users are refused with their name. Outcomes, posted messages,
artifacts and journal/audit records retain the selected user's id. The topic-created
journal receipt includes the user's name in `by` and the optional `userId`. Single mode
keeps the previous stand-in answer attribution and artifact shape. A shell with
`CLAND_SESSION_ID` or `CLAND_SESSION_NAME` set keeps its session identity despite
`--as`; authenticated web and gateway identities retain their transport rules.

Human messages in users mode persist `messages.user_id` and expose the user's
name in `from`, with `fromKind: human`. Local human sends use the selected user;
web sends use the authenticated cookie user, never an identity from the frame.
Legacy human rows without a user id read as the first user while users mode is
active. Single-mode sends retain `from: human` and omit `userId`. The optional
message `userId` supports older clients and hubs; agent delivery envelopes use
the existing `from` attribute. The content-free `human-send` journal record
includes `userId` for new users-mode messages; earlier journal rows stay unchanged.
The optional `userDisplayName` is resolved from the users table on every message read in users mode; both threads compare `userId` with the authenticated viewer (the first user in Neovim) for “you”, otherwise show that display name, retaining “you” for single mode and older payloads.

The spokes' authentication and refusal of client hellos are unchanged.
Paths stay inside the bundle,
including symlinks; extensionless routes fall back to `index.html`. Missing
bundle/index responses name `npm run build --workspace web` (503, plain text).
Every ordinary HTTP response has CSP (including `frame-ancestors 'none'`),
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
Entry files, manifest, service worker and icons use `no-cache` and an ETag
(matching `If-None-Match` returns 304); existing `/assets/*` files use
`public, max-age=31536000, immutable`. SPA fallbacks keep `no-cache`.

`cland web` asks the running hub for a one-time sign-in link over its Unix
socket, prints `http://<bind-address>:<webPort>/auth?token=…` (loopback by default
and for wildcard binds), and opens it with
`open` on macOS or `xdg-open` on Linux. `cland web --no-open` only prints the
link; `cland web --help` describes the command. It does not start the hub.
This is a human-shell command: a session's shell is refused, including an
unknown session identity; do not unset its actor variables to bypass that check.

In `auth.mode = "users"`, CLI and Neovim human connections act as the first
user. `cland web` binds its one-time link to that acting user; redemption stores
`web_sessions.user_id`. WebSocket and upload conversations resolve their user
from that authenticated session, never a frame field. Web `as` remains refused.
`web.session` adds `user: {id, name, displayName, role}` in users mode, and Profile
shows the display name. Human request audit records add `userId`; single mode
omits both optional fields and keeps the existing link and cookie flow. Agent
session identity and role permissions are unchanged.

Ask and approval outcomes add optional `userId` and set `by` to the authenticated
user name in users mode. The posted ask-answer message carries the same user
id through the human-message producer. A second ask answer is refused with the winner’s name.
The `ask-answered` journal event carries `userId`; `inbox-departure` retains it
in `outcome.userId`. Web approval cards and the Neovim inbox show that name.
Single mode keeps `human` (displayed as “the human” on approval cards) and
stand-in attribution; outcomes from older hubs may omit `userId`.

Human artifact creation and uploads in users mode persist `creatorUserId` and
use the authenticated user's name as `creator`; artifact journal events carry
`userId` alongside the human request audit. Local human CLI connections use the
first user, web uploads use the cookie user, and gateway uploads use the acting
human connection. Agent artifacts carry no creator user id. Single mode keeps
`creator: "human"` and omits `creatorUserId`. Artifact source paths still use the
session's Host; uploads retain their transport-owned bytes.

In users mode, `cland user add <name> [--display <name>]` creates an admin
in state `invited`. Names must be unique lowercase ASCII slugs and cannot be
`human`, `hub`, `all`, a role or a current session name. The local human CLI
prints a 24-hour one-time `/invite?token=…` URL at the configured `[web] origin`,
or the edge's bind address and port (wildcard binds use loopback).
`cland user invite <name>` replaces that user's open invites, including for an
active user adding a device. `cland auth mode users` also prints the first user's
invite when the web edge is available. An unavailable edge refuses user creation
and invite commands; the mode switch still works without an invite.

All auth/user handlers refuse authenticated session shells before reads or
mutations. Mode/reset and invite renewal require a local human socket; creation
and listing also admit an authenticated web user in users mode. Invite commands
share WebAuth's admission fence and refuse during
held or failed sign-in transitions, before changing users or replacing invites.
The first-user invite is minted after successful mode publication releases the
fence. The `user.invite` frame requires local human socket authority. In users mode,
`user.add` and `user.list` also admit authenticated web admins through the shared
role check; agent sessions remain refused. Single-mode web requests name users
mode in their refusal. Accounts shows a Users fold with the complete count, name,
display name, role and state. Creating a user shows the invite for copying until
dismissed or the view is left; it is never stored in browser settings. Minting replies alone carry the
URL. SQLite keeps SHA-256 digests, user ids, expiry timestamps and open/used/revoked
states. `Users.checkInvite` validates without consuming; `consumeInvite` checks
and spends synchronously, and can join the registration owner's transaction.
The hub clock defines the 24-hour boundary. Unknown, used, expired and revoked
invites have distinct refusals. `Users.onReset` revokes all open invites in the
same transaction as the return to single mode; user rows remain for attribution.

In users mode every admitted web request also passes `userAuthorityRefusal` in
`hub/src/hub/web-authority.ts` before replay or actor resolution. It resolves the
transport's user id from the users table for each request. The same table holds
web restrictions and user-role grants: existing plain rows default to `admin`;
an explicit `{ web, roles }` row lists permitted user roles. Only `admin` ships.
A denied role returns `forbidden`, naming the stored role and request.
The reusable check accepts `(users, userId, frame)` for CLI and gateway callers;
those callers retain their own transport restrictions. Single mode bypasses
user-role checks and preserves the existing `cli-neovim-only` refusals.

The client frame `{type: "web.link", id: "…", qr?: boolean}` returns a normal `result` with
`value: {url: "http://127.0.0.1:<port>/auth?token=…"}`. It requires the local Unix
socket and human authority, so isolated test clients can mint links without
opening a browser. `qr: true` selects the phone origin and refuses loopback alone. The token is 32 random bytes, encoded as 64 hex digits; the
hub retains only its SHA-256 digest and accepts it for five minutes, once.
`GET /auth?token=…` atomically spends it, sets a fresh browser session cookie,
and sends a 302 redirect to `/`. Unknown, expired and spent tokens return 401;
HEAD returns 405 without spending the link. Auth responses use `no-store` and
`Referrer-Policy: no-referrer`.

The cookie is `cland_<key>`, where `<key>` is the first 12 hex digits of SHA-256
of the project's canonical root, with `Path=/`, `HttpOnly`, `SameSite=Strict`
and `Max-Age=2592000` (30 days). Its value is a separate random credential,
stored only as a SHA-256 digest in `hub.db`'s `web_sessions` table, with a separate
public UUID, creation time and last-use time. Cookie names differ across projects
because cookies are not isolated by port. Restarting the hub clears unused links
but keeps browser sessions. A session expires exactly 30 days after creation;
using it never extends that lifetime. Last use records a successful `/ws` admission.
The additive table/index migration does not rewrite or backfill message history.

`cland web --sessions` prints `ID`, `CREATED`, `LAST USED` (UTC ISO timestamps)
and `SOCKETS` for each unexpired cookie session, including sessions with no open
sockets. `cland web --revoke <id>` deletes that session's admission and terminates
all its sockets, waiting for their server-side close events before returning.
The process log records `web-session-socket-closed` with the public session id
after each server socket closes and its conversation is cleaned up.
Other sessions stay connected; the deleted cookie is refused immediately and
after a restart. Unknown ids fail. These commands never open a browser or mint
a link; `--no-open`, `--sessions` and `--revoke` cannot be combined.

Like `web.link`, `{type: "web.sessions", id}` and
`{type: "web.revoke", id, session: "<uuid>"}` require the human's local Unix
socket (not browser, spoke or stdio). Their result values are
`{sessions: [{id, createdAt, lastUsedAt, sockets}]}` and `{revoked: "<uuid>"}`.
No cookie or digest is returned by listing. Session shells are refused.

The web-only human request `{type: "web.session", id}` returns
`{createdAt, lastUsedAt, expiresAt}` for the cookie session authenticated at
that socket's upgrade. It accepts no identity selector: extra fields cannot
select another browser. Times are UTC ISO timestamps; last use is the latest
successful `/ws` admission with that cookie, and expiry stays 30 days after
creation. An expired or revoked sign-in has no readable record. No session id,
cookie, digest or other browser's record is returned. Local Unix and spoke
clients cannot use this request; listing and revoking remain local-only.

Every `/ws` upgrade checks an allowed Host and its exact port, an Origin exactly
matching `http://<Host>` (or the configured HTTPS tunnel origin for its Host), and the project's unexpired cookie before accepting
any frames. Missing, foreign and `null` Origins are refused with 403; a missing
or invalid cookie gets 401. An authenticated socket accepts only a client hello
`{type: "hello", protocol: 2, client: "web"}` without a secret, welcomes it as
`human` regardless of the client label, and dispatches human requests such as
`hub.status`. A spoke hello is refused and its socket closed. Server pings keep
idle browser connections alive. Every 30 seconds the edge terminates sockets
with at least 60 seconds of silence; pongs and incoming bytes refresh that
deadline. The hub secret remains in local machine processes: it is never
sent in bundle files, auth responses or browser frames. The browser uses its
cookie for every socket; no bearer secret belongs in its JavaScript or storage.

The cookie carries the human's authority subject to the web policy in
`src/hub/web-authority.ts`. The table has an explicit row for every human
`ClientRequest`, `TaskRequest` and `SessionRequest`; typecheck's conformance test
fails if a frame is missing a row. Unknown or unclassified frames are refused
by default, including prototype names. The dispatcher checks this policy before
cached replies, actor resolution or any handler runs. Refusals are ordinary
`result` frames with `ok: false`, `code: "cli-neovim-only"` and an error naming
the CLI and Neovim.

In 0.2.0, these actions stay in the CLI and Neovim:

- `hub.stop`, `hub.reload`, `release`, `sync`, `push`, `publish`;
- `config.set`, `crew.set`, `executor.prepare`, `executor.reap`,
  `executor.retire-legacy`, `task.migrate`, `web.link`, `web.sessions`, `web.revoke`;
- `session.signal`, `worktree.prune`, `artifact.delete`, `suite.forced`,
  `task.import`, `demo.start`, `demo.exec`, `demo.stop`, `demo.status`;
- `artifact.create` carrying a `path`, including alongside `content`;
- `session.launch` carrying a `cwd` field, even an empty or malformed value;
  a web launch without it uses the project root, or the item's task worktree
  when `item` is supplied. Local CLI and Neovim launches retain `cwd`;
- every frame carrying an `as` field, including the initial hello, regardless
  of its value.

Every other classified human request continues through normal dispatch,
including `merge`, queued `suite.start`, `suite.slot`, `suite.cancel`,
`suite.classify`, `session.resume`, `session.bridge`, `executor.status`,
`artifact.promote` and `artifact.move`. Topic messages and inline artifacts are
recorded as the human's. Unix-socket clients retain their existing authority and
handler preconditions. There is no `hub.restart` protocol frame.

An authenticated web client mints an artifact bearer URL with
`artifact.url {artifact: "A-3"}`; the result is `{url}` on the same page origin,
for example `http://127.0.0.1:<webPort>/a/<random-capability>/index.html`.
This frame requires a cookie-authenticated web connection; Unix sockets, stdio
and agent sessions cannot mint it. Each mint creates an independent random
256-bit capability tied to that connection's cookie session and one artifact.
Every mint returns a new capability. Only its SHA-256 digest, session id and
artifact id are persisted in `hub.db`; the URL survives a hub restart. Capability
rows cascade away when their session is deleted or pruned. A URL stops working
immediately when its cookie session is revoked or reaches its fixed 30-day
expiry, including on an already-open minting connection.

`GET` and `HEAD /a/<capability>/<file>` require no cookie. A file artifact exposes
only its file name; a folder exposes its regular files, with the entry file in
the minted URL. Relative references such as `style.css` retain the capability
and resolve from the page's directory. Moved artifact ids resolve to their file
inside the owning folder, without granting the rest of that folder. Unknown,
deleted, expired or revoked capabilities return 404; dot segments, traversal,
backslashes and symlink escapes are refused. MIME types follow the extension
(with `application/octet-stream` for unknown extensions). Responses use
`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer` and `Content-Security-Policy: sandbox allow-scripts`.
The web viewer previews PNG, JPEG, GIF and WebP only when HEAD declares a size
of at most 10 MiB, retaining the download link; larger images show their byte
size and download. Unknown lengths keep the download view, and decode failure
adds a one-line note. Folder children follow the same rule; SVG stays sandboxed.
For a `.mmd` file, `?render=mermaid` serves a text-escaped HTML wrapper at the
same capability, with strict Mermaid rendering inside the opaque-origin iframe.
The original URL still serves raw bytes. The renderer and its CSS load only on
frame opening; their separate build is never a shell import or preload. The
rendered response keeps `sandbox allow-scripts` and adds `default-src 'none'`,
origin-scoped scripts/styles/fonts, inline SVG styles and data images only.
Physical `s` in the frame toggles source through the shared key map; parse errors
show the error and source. See `web/README.md` for the dependency audit and
initial-bundle size check.
HTML can run scripts and load its own relative assets in an opaque origin;
never combine `allow-scripts` with `allow-same-origin` on an artifact iframe.
The web edge resolves its trusted project prefix once, so symlinked project
ancestors (including macOS `/var` and `/tmp`) work. Artifact suffixes stay
lexical: file opens reject symlinks below that prefix. Linux walks directory
descriptors from the resolved prefix through `/proc/self/fd` (procfs is required),
while macOS uses `O_NOFOLLOW_ANY` on the resolved prefix plus lexical suffix,
without combining it with the incompatible `O_NOFOLLOW` flag. Artifact paths
outside the lexical project prefix retain full-path no-follow checks and are
never canonicalized.
A directory renamed after admission cannot redirect an opened Linux parent;
macOS checks the entire path during open. Other platforms refuse artifact reads.
Treat the whole URL as a bearer credential and avoid sharing or logging it.

The spoke finds its hub through `.cland/hub.json` (`CLAND_HUB_FILE` names it, else the nearest one walking up from its cwd), and reads it again before every reconnect, so it follows a restarted hub to its new port. `CLAND_HUB_URL` and `CLAND_HUB_SECRET` override discovery. `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE` are optional; on a project's hub `CLAND_ROLE` is only a request (see Roles). `CLAND_HUB_RECONNECT_MS`, `CLAND_HUB_KEEPALIVE_MS`, `CLAND_HUB_REQUEST_TIMEOUT_MS` and `CLAND_HUB_WELCOME_TIMEOUT_MS` set the timings, for tests. A session an adapter launched sets `CLAND_DELIVERY=adapter`: the spoke then only accepts deliveries and the adapter injects them. Otherwise the spoke delivers into the session as a Claude Code channel notification (a research preview, kept small and isolated in `spoke.ts`). `CLAND_TEST_TASK_WRITE_GATE`, read by `cland hub serve`, names a test-only directory: the next tracker temporary write consumes its `armed` file, writes `entered`, and waits until the test creates `release` before proceeding to rename. Tests arm it after fixture setup, then release it after the competing operation; nothing else sets it. Also for tests only: `CLAND_QUEUE_TTL_MS` shortens the queue TTL (how long a queued message and a remembered name last), and `CLAND_TEST_CRASH_AT=handover-committed` kills the hub right after a handover's transaction committed (`launch-reserved`: right after a launch reserved its role, before the spawn).

The spoke's `session.launch` tool takes `name` and optional `role`, `model`, `harness`, `effort` and `cwd`. `cwd` is an absolute path or a path relative to the project root; omitting it runs the session at the project root. For example, `session.launch {"name":"impl-45","role":"implementer","cwd":".cland/worktrees/T-45"}` launches the Implementer in that worktree. A missing, inaccessible or non-directory path is refused before launch with `{"ok":false,"code":"invalid-cwd","error":"…"}`. With `item` instead (`session.launch {"name":"impl-45","role":"implementer","item":"T-45"}`), the hub makes or reuses the item's task worktree first and starts the session there (Task branches and worktrees, below).

Optional `brief` gives the session its first task: literal text, or an artifact id `A-<n>` whose current file content is read at launch. For example, `session.launch {"name":"impl-45","role":"implementer","item":"T-45","brief":"Implement T-45 and report to the Coordinator."}` or `cland session launch impl-45 --role implementer --item T-45 --brief A-12`. A string consisting only of an artifact id names that artifact; an unknown or unreadable artifact, an empty brief, or text over the ordinary message size limit refuses the launch before a harness starts.

The role clause is delivered before the brief on Claude Code, Codex and OpenCode, so the first turn can start work without another `send`. When `role` is omitted, the launch uses the role already assigned to the name, including its launch defaults and clause. The brief keeps its own message id, journal `send` record and delivery stage. It enters the durable queue before spawn, so a hub restart before the first hello preserves the first task. It belongs to that launch; a failed launch cancels its undelivered brief during cleanup. Claude Code and OpenCode receive the initial clause and brief as one delivery batch after the spoke's welcome; Codex carries both in its launch first turn, settling the queued brief as injected when the native input is accepted. With OpenCode's default role instructions enabled and the instruction write successful, the clause is installed as `cland-role` and only the brief becomes a prompt. Without a brief, that clause delivery starts no turn and produces no turn usage; a later ordinary `send` can start work. The opt-out and safe fallback paths described under OpenCode delivery keep the clause in the prompt. Reconnect and hub restart deliver the role clause again, never a new brief; an unacknowledged initial delivery retains the ordinary queue's retry rules. A resumed or relaunched conversation does not carry the launch brief again.

A spoke discovering a project hub without `CLAND_SESSION_NAME`, an existing session-id role mapping or a hub launch credential stays disconnected. It serves its MCP tools with an error explaining how to bind the session and appends one `spoke-connection-skipped` record to the project's journal. `CLAND_ROLE` alone grants no connection. Named sessions with a human-assigned role and hub-launched sessions still connect; a nameless spoke of a mapped session still joins or recovers its identity, and an explicitly configured standalone hub retains generated names.

#### Users and sign-in mode

Managed init/update configs default to `[auth] mode = "single"`; missing settings
also keep single mode. `cland auth mode users` creates and prints the first admin
from Git's user.name, with OS user-name fallback. `cland user list` prints names,
display names, roles and states. `cland auth reset` returns to single, retains
users and revokes browser sessions and links. Mode changes and reset are local
human-only. In users mode authenticated web admins can list and create users in
Accounts; the gateway and agent sessions have no authority for these commands. Generic config writes cannot change the mode.
See [sign-in mode](../agents/auth.md) for the durable mode fence, startup
recovery and reset revoker seam. Config's `[auth]` is independent of secrets'
`[auth]` login key storage settings.

### Spoke stdio input limit

Every local MCP input line is capped at 1 MiB (1,048,576 UTF-8 bytes, excluding
the newline), before JSON parsing or SDK schema validation. This fixed cap
applies with or without a connected hub and has no configuration override.
On overflow, the spoke emits a JSON-RPC `-32700` error naming the cap with
`id: null` (the rejected JSON is never parsed to recover its id), discards the
rest of that line and continues serving subsequent messages. An unfinished
line is refused as soon as it exceeds the cap. Multiple valid lines sharing
one read are bounded individually. Ending stdin still ends the session.

### Spoke readiness and deadlines

MCP initialization and tool listing do not wait for the hub. A tool called while its spoke is connecting waits for that connection's welcome up to `READINESS_TIMEOUT_MS` (20,000 ms), then sends its request. The wait applies on initial connection and reconnect. A timeout returns `{ok:false, error:"the hub did not become ready within 20 s (waiting for welcome)"}`. Expired calls are removed and never sent on a later welcome. A disconnect, refusal or stopped spoke fails waiting calls immediately; an already disconnected or refused spoke reports its outage immediately.

After the wait, the spoke re-reads the live connection and the identity and role accepted by its welcome. No identity or permission is captured before awaiting; the hub checks each request's permissions under that connection. Concurrent waiting calls share the welcome, with a separate deadline for each call.

`WELCOME_TIMEOUT_MS` is a separate 20,000 ms liveness bound measured from sending hello; `CLAND_HUB_WELCOME_TIMEOUT_MS` overrides it for tests. Previously, a silent hub that completed the WebSocket upgrade was cut off after 10 s; it now costs up to 20 s to detect that silence. The WebSocket handshake still has its 10 s deadline. Socket close fails waiting calls immediately and uses the existing reconnect path, including capped backoff and name retries. Ordinary reply deadlines remain `REQUEST_TIMEOUT_MS` (10,000 ms), overridden for tests by `CLAND_HUB_REQUEST_TIMEOUT_MS`; the reply clock starts only when the request is sent.

The readiness bound is below the harness tool-call deadlines: [Codex defaults to 60 s per tool](https://developers.openai.com/codex/config-reference/), and [OpenCode v2 defaults to 12 hours for execution](https://opencode.ai/v2/docs/mcp-servers). OpenCode's 30 s startup/catalog bounds apply to initialization and listing, which remain callable while the hub connects. The MCP SDK test client defaults to 60 s. cland's adapters leave these execution defaults in place. A normal tool can therefore spend at most 20 s waiting and 10 s awaiting a reply; `merge` and `session.launch` retain their existing separate 60 s reply bounds.

`artifact.create` has a separate 120 s reply budget because folder publication queues behind other creations and copies files serially. `artifact.list` keeps the ordinary 10 s budget. The creation budget starts when the spoke sends the request; readiness can add up to 20 s before that. The outer harness/MCP tool deadline still applies and can expire before this longer spoke deadline. To receive the full creation budget, the caller must allow more than 120 s for a ready spoke, or more than 140 s including readiness and transport overhead. This override does not raise the outer deadline or cancel hub copying. If either deadline expires, publication may still finish: inspect `artifact.list` in the destination topic before retrying, since a new create can publish a duplicate. Durable operation ids and idempotent retries are not provided by this budget override.


<!-- Implementation guidance moved from the implement skill. -->

For network bind, tunnel and QR tests, follow `docs/agents/tests.md#browser-sign-in-fixtures`: bind only disposable loopback aliases or use scratch config; observe web and spoke addresses independently.

`[web]` settings are startup-only: reload and role auto-refresh refuse a changed
parsed web table and retain the loaded config/roles pair; `config set web.*`
saves for the next hub start. Apply with `cland hub stop` then `cland hub start`.
Use the sealed CLI/projectHub regression described in
`docs/agents/tests/hub-test-config-reload-component.test.ts.md`.

In users mode, local admins approve a remote code with
`cland remote approve <messenger> <code> --user <name>`; Neovim's pairing card
asks for the user. Omitting the selector is refused. `user_remote_pairings`
stores the project `user_id` separately from `messenger_user_id`. A replacement
changes only that user's messenger binding. Existing single-mode rows remain in
`remote_pairings`; on entering users mode their ownership expands to the first
user without changing those rows. Input identity comes from the native pairing,
never from frame fields, and passes the shared user-role check as well as the
gateway's existing transport restrictions. Missing native pairing identity is
refused as a missing pairing before the role check in users mode. Stranger
presses on mapped bot-authored Telegram cards receive only a private alert,
without a paired sender or a hub request. The pairing journal event records
`userId` and `approvingUserId`, never the code.

`cland remote unpair <messenger> --user <name>` removes only that user's binding
in users mode. Without the selector it lists paired users and refuses; a session
shell cannot manage pairings. Single mode keeps its existing command behavior.
Auth reset keeps the first user's current binding for each messenger and revokes
the others in the same reset transaction. Outbound publication currently uses
the first user's destination; fan-out is a separate stage.

For install metadata, Inbox start URLs, app badges or phone QR sign-in, use the T2 edge and sealed phone seams in `docs/agents/tests.md#web-phase`; real installability and badges stay in QA's full-Chromium demo.

## Sign-in mode storage and commands (T-1558)

For passkey invite/sign-in integration, use the isolated Headless Shell CDP
virtual authenticator seam in `docs/agents/tests/web-test-passkeys.test.ts.md`.
Use `webPasskeys` as the bounded, volatile single-use challenge owner and
T-1559's byte verifier; every cookie uses `webSessionCookie`. Keep ceremony
responses inside bounded HTTP bodies, outside frames/logs/journals. Persist only
user ownership, credential id, public key and counter. RP ID follows configured
HTTPS origin or localhost, with preferred UV. Auth reset/edge close clears pending
challenges. No new dependency, key binding or role permission is needed.

For invite password registration, use the HTTP and credential seams in
`docs/agents/tests/hub-test-web-signin.test.ts.md`,
`docs/agents/tests/hub-test-passwords.test.ts.md` and the isolated browser form in
`docs/agents/tests/web-test-signin.test.ts.md`. All edge cookies use
`webSessionCookie(auth, token, request, configuredOrigin)` from `web-auth.ts`;
change cookie policy there once. API requests require exact Origin and admitted
Host; navigation permits absent Origin. Recheck admission after asynchronous
hashing, then commit invite consumption, hash, activation and session together.
Shutdown drains registration before storage closes. Keep passwords in HTTP POST
bodies and independently salted scrypt storage, outside frames/logs/journal.
Single mode keeps invite paths at 404 and the existing link flow. No new role
permission applies.

Password sign-in and Profile sign-out use those same HTTP/browser test seams.
Keep wrong-password, unknown-name and invited-only refusals identical, and the
per-name/address exponential retry delays after five failures capped at 15 minutes.
Use the edge's session revoke owner to drain uploads and close only that browser's
sockets before replying to sign-out. A revoked sibling tab returns through the
optional `/signin/status` probe; an older hub's missing route retains reconnect.
Keep single-mode connection and phone-disconnected tests unchanged. No CLI or
role permission is added.

For user invite work, use the public Store and disposable frame/CLI seams in
`docs/agents/tests/hub-test-invites.test.ts.md` and
`docs/agents/tests/hub-test-user-invites.test.ts.md`. Keep raw tokens only in
minting results and digest/expiry/state in SQLite. Replacements and reset revoke
open invites; use the hub clock and retain distinct refusal reasons. Registration
validates via `checkInvite`, then consumes inside its credential transaction.
All five auth/user handlers share the local-human guard. External invite
commands check WebAuth admission before mutation; mode switching mints the first
invite only after successful reload releases its fence. Keep session-shell and
held/failed-transition refusal regressions. No role clause changes are needed.

## Unix spoke edge (T-1592)

Use `docs/agents/tests/hub-test-spoke-unix-edge.test.ts.md` for the scratch
projectHub/WebSocket seam. Unix spokes share the loopback bearer admission and
dispatcher identity; preserve client-hello refusal, mode 0600, byte-budgeted path
fallback (including URL compatibility of root and TMPDIR) and inode-owned cleanup.
Keep local discovery unchanged and leave
per-host credential/principal admission to its owning module.

## WebAuthn byte verification (T-1559)

Use the pure registration/assertion seam in
`docs/agents/tests/hub-test-webauthn.test.ts.md`. Generate keys locally with Node
crypto; no real authenticator or account is needed. Preserve nonthrowing bounded
parsing and distinct ceremony/signature/counter refusals. Sign-in integration
owns challenge consumption, user/credential binding and atomic counter updates;
module tests alone do not prove those flows. No new role permission applies.
