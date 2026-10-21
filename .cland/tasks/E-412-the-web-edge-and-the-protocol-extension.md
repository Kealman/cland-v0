---
id: E-412
kind: epic
title: The web edge and the protocol extension
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-773
branch: null
created: 2026-10-14T15:59:14.015Z
updated: 2026-10-21T14:02:51.811Z
closed: 2026-10-21T14:02:51.811Z
---

## Summary

The hub gets a web edge of its own: a stable loopback listener that serves the web bundle, trades a one-time link from `cland web` for a 30-day cookie, and carries the frame protocol to browsers over a WebSocket as the human. The protocol gains a snapshot at connection, numbered deltas with resume after a drop, and history in pages, with the eight reservations that keep a later terminal from needing a redesign.

## Goal

A browser reaches the hub as the human without ever holding the hub's secret, and stays live at little cost: one snapshot at connection instead of eleven reads, deltas that carry only what changed and resume after a drop, and history in pages. Today a browser cannot get in: the TCP port in `hub.json` is the spokes' WebSocket, chosen anew at each start, opened only with the bearer secret, and refusing client hellos on purpose, because every session holds that secret. Pushed frames carry no sequence numbers, so every client re-reads everything after a drop. The Q-405 prototype's first full tree waited about two seconds for eleven reads queued on the hub's one loop: 1.15 MB per connection, of which `hub.status` was 336 kB (308 kB of it suite history) and `task.list` 539 kB (46 percent of it verdict history).

## Contents

- **§3.1 Clients and transport.** The web client speaks the frame protocol the Neovim client speaks, with the identity `human`. The hub accepts several human clients at once, Neovim and any number of browsers, and all see the same state. No separate backend and no database of the web's own. Localhost and the local network first; remote access only through the human's own tunnel or VPN, never a cloud service.
- **§3.7 Serving and security.**
  - **The edge.** A separate listener inside the hub process on `ws`, on a stable loopback port recorded in `hub.json`, serving `/` (the bundle from `web/dist`), `/auth` and `/ws`. The spokes' edge stays as it is and keeps refusing client hellos.
  - **The entry.** `cland web` prints a one-time link and opens the browser; `--qr` prints it as a QR code for a phone, carrying the tunnel's address when `[web]` names one, else the local network's. The browser trades the token at `/auth` for an HttpOnly, SameSite=Strict cookie named per port that lives 30 days, as `opencode pair` does.
  - **The checks.** Every upgrade checks Host and Origin, and only a client hello is accepted, so a page can never connect as a session.
  - **The authority.** The cookie carries the human's authority except four actions that stay in the CLI and Neovim in 0.2.0: stopping the hub, restarting it, releasing, and creating artifacts from arbitrary paths of the machine. The web edge refuses them.
  - **The wire types** move into a module that imports nothing from the hub, so the browser's typecheck stays free of Node globals.
  - **`[web] bind`** opens the edge to the network, with an amendment of ADR 0003 and the same Origin and Host checks; the spokes' edge stays on loopback.
- **§3.3 The live model, the protocol.**
  - **The snapshot.** On a client hello the hub sends a snapshot: the tracker levels, the items, the sessions, the topics, the inbox, the first page of events and the accounts, without the suite history, stamped with an epoch and a sequence number. It replaces the reads at connection.
  - **Deltas.** Every pushed delta carries the next number and only what changed: a `task` delta carries the changed item and only the layers that changed, never every item's layer, and the verification queue is pushed only when it changes.
  - **Resume.** A reconnecting client sends `resume` with its epoch and number and receives the missed deltas from the hub's ring buffer, or a fresh snapshot when the ring no longer covers them or the epoch changed. The ring lives in memory, and a hub restart starts a new epoch.
  - **History pages.** Thread history is served in pages by message number.
  - **Several clients made cheap.** Each frame is serialized once, not once per client.
- **§3.3 and §3.8, the door for a later terminal** (the eight reservations of Q-403): text frames are JSON, and binary frames are reserved for streams; streams sit beside the live model and never enter its sequence numbers, snapshot, catch-up or the journal; sequence numbers count model deltas, not socket frames; each connection has a queue limit past which its model stream resyncs; model frames go first, or terminals get their own socket; the entry is routed by path, the cookie serves any number of sockets, and every upgrade checks its Origin; each frame kind has its own size limit; the hello carries a feature list, and each adapter a `terminal` capability.
- **Artifact files over HTTP**, the extension's ninth piece in the sizing of §3.3, which inline HTML artifacts (§3.4) and the Artifacts area need: an artifact's files are served from the edge, HTML under a sandbox policy.

Not in this epic: the fields computed in the hub and the read marks (E-413); approvals (E-414); the web client itself (E-415 to E-419); Neovim adopting the snapshot and the deltas (0.2.x); push notifications with the page closed (0.2.x); the terminal itself (0.2.x).

Choices where the spec is silent:

- **The port.** `[web] port` when set; otherwise the hub picks a free port at its first start and keeps it in a volatile file under `.cland/`, so it stays the same across restarts. `hub.json` records it at every start. When the port is taken, the hub says so and never drifts to another, because the origin carries the cookie, the browser's storage, the notification permission and the installed app.
- **One canonical origin.** Links use `http://127.0.0.1:<port>`. `localhost` and `[::1]` are accepted as Host names but never printed, so the browser's state lives in one origin.
- **The token.** 32 random bytes, kept as SHA-256, spent on first use and valid for five minutes, long enough to scan a QR code. `cland web` asks the hub for it with a new client frame, `web.link`, over the Unix socket; a session's shell is refused, as for the human's other frames. `cland web` opens the link with `open` on macOS and `xdg-open` on Linux, and `--no-open` only prints it.
- **The QR code** is drawn in the terminal with Unicode half blocks by an encoder in the hub (a vendored, MIT-licensed one fits), with no new runtime dependency.
- **The cookie session.** The cookie is `cland_<port>`, with `Secure` when the request came through the tunnel. The hub keeps each cookie session hashed in `hub.db` with its creation and its last use, so a restart signs no browser out; `cland web --sessions` lists them, and `cland web --revoke <id>` ends one and closes its sockets.
- **The tunnel.** `[web] origin` names the tunnel's HTTPS origin: its host joins the Host allow-list, the origin passes the Origin check although the last hop to the hub is plain HTTP, and `cland web --qr` prints it. Without it, `--qr` prints the LAN address when `[web] bind` exposes one, and otherwise refuses with the reason, since a phone cannot reach loopback.
- **`[web] bind`** defaults to `127.0.0.1`. `cland doctor` warns when the edge is on the network without a tunnel: plain HTTP carries the cookie in clear and gives a phone no notifications and no install.
- **The refused frames.** On the web edge the dispatcher refuses `hub.stop`, the restart, `release` together with `sync` (the release's second half), and `artifact.create` with a path, with a code that names the CLI and Neovim; any frame with `as` is refused. Every other human frame passes, so the web keeps parity with Neovim (§3.5).
- **Feature negotiation.** The hello's feature list opts a connection into the snapshot, the numbered deltas and the slim frames. A connection without it, Neovim's and the CLI's, keeps today's frames unchanged until Neovim adopts the extension in 0.2.x. Frames are serialized once per feature set.
- **The snapshot's shape.** One frame per domain under one sequence number, closed by an end marker, each within its kind's size limit: the tracker levels and ladder; the items with the latest verdict of each kind and its round, the verdict history staying behind `task.view`; the sessions with presence, the roles, the crew, the Coordinator and the verification queue; the open topics and those closed in the last seven days, older ones in pages; the inbox with `needsYou`; the first page of events; the accounts. Artifacts are read in pages by the Artifacts area and come with their messages in threads.
- **One emit point.** Every model delta, the tracker's `task` frames included, is numbered where the core emits it. Whole-state frames (`inbox`, `presence`, the verification queue) replace; `message`, `delivery` and `event` append. A pin or a mute sends the re-projected rows, never a bare invalidation.
- **The ring and the queue limit.** The ring holds the last 15 minutes of deltas, at most 4 MiB, tuned on the live hub's rate (about 600 records an hour, 1,764 at the peak). A connection whose unsent bytes pass 4 MiB has its model stream closed with `resync` and resumes from its number.
- **Liveness.** The web edge pings every 30 seconds, and the existing sweep closes a socket silent for 60 seconds.
- **History.** Each message carries its number. `topic.history` takes `before` or `after` a number, at most 200 messages a page; `events.list` keeps its cursor over the journal.
- **Static serving.** `index.html`, the manifest, the service worker and the icons are `no-cache` with an ETag, and `/assets/*` is `immutable`; a strict CSP with `frame-ancestors 'none'`, `nosniff` and `no-referrer`; paths are confined to `web/dist`, and paths without an extension fall back to `index.html`. When `web/dist/index.html` is missing, a plain page names `npm run build --workspace web`. A development setting, `[web] dist`, points the edge at another built bundle, which is how the prototype's shell is served first.
- **Version skew.** The welcome carries the bundle's build stamp, and a page that loaded an older bundle reloads; a hello refused for its protocol tells the page to restart the hub.
- **Artifact files.** Served under `/` at `/a/<capability>/<file>`: the capability is random, minted per artifact by a client frame, valid while its cookie session lives, and confined to the artifact's file or folder. Types come from the extension, and HTML carries `Content-Security-Policy: sandbox allow-scripts`, so a page artifact in a sandboxed iframe loads its own files without the cookie.
- **The reservations in code.** Binary frames are refused with a close code until streams exist; the hello and the welcome carry the feature list; every adapter declares `terminal: 'none'`; JSON frames keep the 1 MiB limit.

## Tracer-bullet order

1. **The edge and the token exchange.** The listener on the stable port in `hub.json`, `cland web` with its one-time link, `/auth` setting the cookie, the Host and Origin checks, a client hello admitted as the human and a spoke hello refused, and the bundle or the "not built" page with its headers; the local machine is the only client. Demo: `cland web --no-open` prints a link that headless Chromium opens once, the page connects to `/ws` and reads `hub.status`, and the same link a second time answers 401.
2. **The wire module and the authority.** The wire types in a leaf module, the refused frames and `as` on the web edge, and the cookie sessions in `hub.db` with `--sessions` and `--revoke`. Demo: a web client's `hub.stop` is refused with the code naming the CLI while its `topic.send` goes through, and revoking its cookie session closes its socket.
3. **The snapshot.** One snapshot composed in one tick for the connections that ask for it, stamped with an epoch and a number, replacing the reads at connection. Demo: on a copy of the live tracker the snapshot carries the levels and no suite history, and its size and compose time are recorded on this epic against the prototype's 1.15 MB.
4. **Numbered deltas and resume.** One emit point numbering every model delta, slim `task` frames, the verification queue on change, the ring, `resume`, a fresh snapshot after a restart, and `resync` past the queue limit. Demo: a client dropped while five items change resumes with exactly those five deltas, and after a hub restart it gets a fresh snapshot with a new epoch.
5. **History pages and artifact files.** Message numbers, `topic.history` in both directions, and artifact files under capability URLs with the sandbox policy. Demo: a thread of 450 messages reads in three pages with no gap and no repeat, and an HTML artifact loads its own stylesheet inside a sandboxed iframe.
6. **The network, the phone's link and the door.** `[web] bind` with the ADR 0003 amendment, `[web] origin`, `--qr`, the server pings, binary frames refused, the feature list and the adapters' `terminal` capability. Demo: with `[web] bind` on a LAN address, `cland web --qr` prints the LAN link as a QR code, a page from another origin is refused, and `cland doctor` warns about plain HTTP.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, a frame client holding the web's cookie and headless Chromium (Chrome Headless Shell through `playwright-core`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass).

In a scratch project holding a copy of the live tracker and the fake harnesses, QA starts the hub, reads the web port in `hub.json`, restarts the hub and reads the same port. `cland web --no-open` prints a link; headless Chromium opens it, receives `cland_<port>` with HttpOnly and SameSite=Strict, and the page connects; the link used again answers 401. An upgrade from another origin, with a `null` Origin or with a foreign Host is refused, and a spoke hello on the web edge is refused. A frame client with the cookie takes the snapshot and reads the levels, items, sessions, topics, inbox, the first page of events and the accounts with an epoch and a number, and no suite history. QA changes items through the CLI and reads numbered deltas carrying only the changes; it drops the client, makes five changes and resumes to exactly the five missed deltas; it restarts the hub and receives a fresh snapshot with a new epoch. The client reads a long thread in pages by message number and opens an HTML artifact's capability URL, which answers with the sandbox policy. `hub.stop`, `release` and `artifact.create` with a path are refused on the web edge and work from the CLI. With `[web] bind` set, `cland web --qr` prints the LAN link as a QR code and `cland doctor` warns about plain HTTP. QA searches the bundle, the browser's storage and the edge's responses for the hub's secret and finds nothing.

- [ ] C1. The web edge is a separate listener on a stable loopback port recorded in `hub.json`, serving `/`, `/auth` and `/ws` with the static headers, and the spokes' edge is unchanged.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238
- [ ] C2. `cland web` and `cland web --qr` print a one-time link spent on first use; `/auth` sets an HttpOnly, SameSite=Strict cookie named per project (`cland_<12 hex of the project root's SHA-256>`, decided 2026-10-20 with ask 310190bf: cookies are not isolated by port) that lives 30 days and survives hub restarts; cookie sessions are listed and revoked from the CLI.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238
- [ ] C3. Every upgrade checks Host and Origin, only a client hello is accepted, `as` is refused, and stopping or restarting the hub, releasing and creating artifacts from paths are refused on the web edge; the hub's secret reaches no browser.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238
- [ ] C4. A client that asks for it receives one snapshot (levels, items, sessions, topics, inbox, the first page of events, accounts; no suite history) with an epoch and a sequence number, then deltas numbered in sequence that carry only changes; the verification queue is pushed only when it changes.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238
- [ ] C5. `resume` replays the missed deltas from the ring, or sends a fresh snapshot when the ring no longer covers them or the epoch changed, and a connection past its queue limit resyncs.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238
- [ ] C6. Threads page by message number in both directions, and artifact files are served under capability URLs, HTML with a sandbox policy.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238
- [ ] C7. The wire types live in a module that imports nothing from the hub; binary frames are refused, the hello and the welcome carry a feature list, and every adapter declares its `terminal` capability; `[web] bind` works and ADR 0003 records its amendment.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238
- [ ] C8. `hub/README.md` describes the web edge, `cland web`, `[web]`, the snapshot, the deltas, resume and the history pages, and Neovim's frames are unchanged.
  - verified: qa-676 [qa] · run qa-2026-10-21-3 · 2026-10-21T14:02:29.986Z · commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238

## Dogfooding

The edge and the snapshot serve the shell first (spec §4). As soon as the first slice lands, the human opens the shell with `cland web` against the live hub: the prototype's own bundle through `[web] dist` until the shell of E-415 is on `dev`, then that shell. The snapshot slice then replaces the shell's reads at connection, and the first full tree on the live tracker is timed against the prototype's two seconds.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the research: the pieces W1 to W9 of Q-400 with their file references, and the probe edge of Q-402 (`server/web-edge.ts`) with its tests; then the prototype's bridge (`web/proto/bridge.ts`, its read-only allowlist and its tests), a reference never merged.
- **Tests.** Most of this epic is proved at the frame seam: a real hub, `ws` clients that set the cookie and the Origin by hand, and the CLI. A browser test is kept for what needs a page: the auth redirect, the cookie's flags and the served bundle.
- **ADRs.** 0003 (The hub is a per-project daemon): amended for `[web] bind`, while the spokes' edge stays on loopback.
- **Risks.** One event loop serves every client: serialize each frame once and keep the snapshot's composition within the handler budget. The hub restarted 20 times in the 61 hours Q-400 measured, so most reconnections after a restart take a fresh snapshot. A script injected into the page would act as the human: the strict CSP, the sandboxed artifacts and the refused frames are the defences. On a LAN without a tunnel the cookie travels in clear.
- **Size.** About nine sessions on the v0 scale.
- **Order.** First in the hub lane, with no blocker. E-413 waits for it, and so does E-416 in the web lane.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.1, §3.3, §3.7, §3.8 and §4; `docs/spec/v0.1.md` §3.5 (the layers the frames carry).
- Map M-399 and the tickets this epic absorbs: Q-400 (the client surface, W1 to W9), Q-402 (the stack and the edge), Q-403 (the eight reservations), Q-405 (the measurements), Q-407 (the decision).
- Research: `research/web-client-surface` (`docs/research/web-client-surface.md`, the probes `frames-inventory.mjs` and `log-rates.mjs`); `research/web-stack` (`docs/research/web-stack.md` §2, the probe's `server/web-edge.ts` and `server/web-edge.test.ts`); `research/web-terminal` (`docs/research/web-terminal.md` §3.2); `research/web-prior-art` (`docs/research/web-prior-art.md` §7.4, the catch-up designs).
- Prototype: `prototype/web-shell` (`web/PROTOTYPE.md`, the open points for Q-407; `web/proto/bridge.ts`, `web/proto/bridge.test.ts`).
- ADR: `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- GLOSSARY: Web workbench, Snapshot, Delta, Hub, Spoke.

## Plan

```yaml
stages:
  - name: the edge and the wire
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-978
        - T-980
      - - T-979
  - name: authority, cookie sessions, snapshot and pages
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-981
        - T-983
      - - T-984
        - T-982
        - T-987
        - T-1042
  - name: deltas, resume, the network and the door
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-985
        - T-986
      - - T-988
        - T-989
```

## Comments

### qa-676 · 2026-10-20T20:57:49.538Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-1
commit: 44097bad32444c7db96492ef15d182c819166f99
stage: the edge and the wire
stage_hash: e4191e34ed640985c9fb3187711de9b3000a7a4dbc63ef3136ae7bb7927f3670
findings: [{"severity":"low","text":"S0 duplicates init's existing [web] table; doctor explicitly reports invalid TOML/default fallback and M3 initially returned 503. Authorized scratch-only correction to existing web.dist and affected rechecks pass; original captures retained.","file":"qa/briefs/E-412-stage-1.md","line":41},{"severity":"low","text":"M9 standalone web-auth needs built web/dist but fails with raw ENOENT scandir when absent (12 pass/1 fail). Authorized exact-source npm run build --workspace web then rerun passes 13/13. Bugs/S prerequisite-message follow-up; original failure retained.","file":"hub/test/web-auth.test.ts","line":150}]
finding_counts: {"high":0,"medium":0,"low":2}

| Check | Surface | Result | Command / observation |
| --- | --- | --- | --- |
| S0 | hub-api | PASS | Two disposable projects, scratch HOME/XDG/Git, system TMPDIR; init; authorized correction to existing web.dist |
| M1 | hub-api | PASS | cland hub start/stop/start: web port 51416 stable and persisted, distinct from spokes port 51547 |
| M2 | hub-api | PASS | Occupied p2 web port 51419: hub/spokes stay up, status and doctor name EADDRINUSE; webPort unchanged; holder curl 000/timeout; holder stopped |
| M3 | curl | PASS | GET /: 200, scratch bundle, CSP frame-ancestors 'none', nosniff and no-referrer |
| M4 | curl | PASS | Nonempty ETag, no-cache, conditional 304 with empty body; extensionless /anything returns index |
| M5 | curl | PASS | Four foreign/portless Hosts 403; localhost:51416 200 |
| M6 | hub-api | PASS | cland web --no-open: exactly one 64-hex-token link; zero raw token occurrences under scratch .cland |
| M7 | curl | PASS | First GET 302 and one HttpOnly/SameSite=Strict/Path=/ cookie with Max-Age=2592000; reused/unknown links 401; no cookie on reuse |
| M8 | curl | PASS | No cookie 401; foreign/null/missing Origin each 403; no 101 |
| M9 | node --test | PASS | Serial web-edge 6/6, web-auth 13/13 after authorized build, web-auth-unit 2/2; no skips |
| M10 | shell/node --test | PASS | lint-wire-imports exit 0; hub-lifecycle 6/6, including webPort/status assertions |
| M11 | shell | PASS | npm run typecheck exit 0; hub, Neovim, DOM-only shared wire/conformance and web checks |

Low findings:
1. S0/M3, qa/briefs/E-412-stage-1.md:41: the setup appends a second [web] table although cland init already supplies one. Original curl returned “HTTP/1.1 503 Service Unavailable” and “The cland web bundle is missing. Run npm run build --workspace web.” Doctor explicitly reported “fail config.toml does not parse: Invalid TOML document: trying to redefine an already defined table or value (line 133, column 2)” and said the hub uses built-in defaults. This was not silent in doctor. Coordinator decision 39f168a8-b54d-4255-bfe1-b05667b14be1 approved only the scratch correction: remove appended duplicate, set existing web.dist to the prescribed tiny bundle, restart hubs, repeat M1–M8. Corrected doctor reports config parses; all affected checks pass. Original setup/config/output preserved in initial-setup/. No committed brief or product code was edited.
2. M9, hub/test/web-auth.test.ts:150: standalone `node --test hub/test/web-auth.test.ts` requires a built web/dist but fails with raw “ENOENT: no such file or directory, scandir '<detached worktree>/web/dist/'” instead of provisioning it or explaining the prerequisite. Initial result 12 pass/1 fail. Coordinator decision 3e93d7ab-5ca3-4151-9164-a5c8285b13c5 authorized `npm run build --workspace web` in the detached tested sources, then only the web-auth recheck. Build exit 0; recheck 13/13. Initial failure and build log retained. Reported for a Bugs/S follow-up; this does not remain a stage behavior failure after the authorized setup.

Stage: the edge and the wire (affected).
Build: 44097bad32444c7db96492ef15d182c819166f99.
Run: qa-2026-10-20-1.
S0 and M1–M11 PASS after the two authorized setup corrections. Final supporting targeted tests: 27 pass, 0 fail/cancelled/skipped. Initial failing setup/test outputs are retained and not counted as passing executions. Tests ran serially on local Darwin arm64 with Node v24.21.0, checking local:none before files. No full suite submitted or claimed; the Coordinator owns the stage covers. Static/type/build checks enforced their exit codes; report-only duration budgets are not evaluated here.

Manual checks used real scratch CLI hubs, curl and a tiny fixture bundle. A Python driver called curl with argument arrays to preserve each Host/Origin/header case and asserted the brief's responses; its exact commands are in check-http.py. Synthetic one-time tokens/cookies were kept only in memory and redacted from durable captures. No browser/GUI was opened; targeted web-auth opener test uses scratch platform opener stubs. Provider/account variables were absent, with own HOME/XDG/Git and system TMPDIR.

Build gates: clean detached HEAD and refs/heads/dev matched before/after; all three first-parent item landing commits captured in build.txt. Cleanup: both scratch hubs stopped normally, port holder terminated by the prescribed M2 command, remaining scratch process count 0, scratch root removed with non-force rm -r. Stage verdict only: no epic criterion marks.

Evidence A-8056: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8056-e-412-stage-qa-evidence-at-44097bad-the-edge-and-the-wire-12-pass/report.md

### coord · 2026-10-21T03:05:39.421Z

T-983 C5: snapshot measurement on a disposable copy of the live tracker (A-8119, macOS, posted by coord for impl-983).

- Live tracker items: 1,032. Prototype baseline: 1.15 MB.
- Items domain, populated: 571,512 bytes, 54.5 % of its cap (MAX_FRAME_BYTES 1 MiB).
- Snapshot total: 575,504 bytes. The other domains held scratch defaults, not live data: sessions, topics, inbox, events and accounts were nearly empty.
- Compose time, five samples: 120.2, 118.5, 113.2, 138.4 and 123.8 ms. With frame checks: 121.8, 119.9, 115.4, 140.3 and 125.2 ms.

Notes:
- Items will reach the 1 MiB cap at about 1,900 items at today's density. Paging the items domain (or slim frames) is needed before then.
- The synchronous compose holds the hub loop for about 120 ms per featured connection. That is fine for one browser, but worth watching when T-985/T-986 add reconnects.

### qa-676 · 2026-10-21T09:39:17.364Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-1
commit: 479178b25c78ccbb54f908ef7cc7c05c18426cd0
stage: authority, cookie sessions, snapshot and pages
stage_hash: 2fcea38e2ba40ff42e5806d2221d03be11af1202e198bf0e730abe8de423d6c4
findings: [{"severity":"low","text":"M2 recursive grep encounters hub.sock and exits 2; approved regular-file probe finds no cookie, exit 1. Original and corrected captures retained.","file":"qa/briefs/E-412-stage-2.md","line":238},{"severity":"low","text":"M5 artifact chip follows message, so history last is chip. Approved before:3 history and Unix artifact list confirm both persisted human attribution.","file":"qa/briefs/E-412-stage-2.md","line":241}]
finding_counts: {"high":0,"medium":0,"low":2}

| Check | Surface | Result | Observation / retained evidence |
| --- | --- | --- | --- |
| S0 | local macOS CLI | PASS | Clean detached SHA/dev; T-981/983/984/982/987/1042 merges present; scratch HOME/XDG/Git, shared credential filter after overlays, system TMPDIR; exact-source web bundle built. |
| M1 | scratch CLI/HTTP | PASS | Auth 302, valid project cookie name, one UUID row with equal creation/last-use and 0 sockets. |
| M2 | scratch DB/files | PASS | Exactly four columns; matching SHA-256 digest only. Corrected regular-file scan no match, exit 1; original socket error retained. |
| M3 | scratch web/Unix frames | PASS | 20 restricted frames cli-neovim-only; allowed hub.status works; Unix sessions/path artifact creation succeeds. |
| M4 | scratch web frames | PASS | Initial hello with as refused; plain hello accepted as human; status succeeds. |
| M5 | scratch web/Unix frames | PASS | Message and inline artifact accepted and persisted human/human. Seq 2 message confirmed by before:3; following seq 3 artifact chip and Unix artifact list confirmed. |
| M6 | scratch frames | PASS | Exactly 9 frames: welcome, 7 ordered domains, end. Common epoch, seq 1→2→3 across connections; each below cap; no suites history. |
| M7 | scratch frames | PASS | Four legacy/empty/unknown-feature hellos produce only the expected welcome after 1.5 s. |
| M8 | scratch history | PASS | 450 sends; 451 distinct numbered messages both directions, pages 200/200/51; inserted once on page 2. |
| M9 | scratch history | PASS | Limit 500 capped at 200; default 50; both/negative/fractional cursors refused. |
| M10 | scratch artifact HTTP | PASS | Four independent valid capability URLs, duplicate note mints differ; unknown and Unix mint refused. HTML/CSS/Markdown/plain/HEAD all 200 with exact types, sandbox and protective headers. |
| M11 | scratch artifact HTTP | PASS | All 11 --path-as-is confinement probes 403/404; zero foreign bytes. |
| M12 | scratch restart | PASS | Cookie/session creation and four capabilities survive restart, same port 54611; old hold closed, cookie upgrade 101. |
| M13 | scratch revocation | PASS | A and B each 1 socket; revoke A closes A only, one server close receipt; B stays connected. |
| M14 | scratch restart/revocation | PASS | A cookie 401 and four caps 404; B cookie 101/cap 200; repeat revoke and combined flags exit 1. Same after restart. |
| M15 | copied tracker measurement | PASS | 1042 items, seven domains under caps, five warm samples, eight frames; posted measurement comment found. |
| M16 | documentation read | PASS | All 10 required strings present; surrounding sections agree with manual behavior. |
| M17 | serial targeted hub files | PASS | 105/105 tests, zero failures/cancellations/skips/todo, including fake-clock expiry, snapshot races/caps, symlink ancestor and parent-swap cases. |
| M18 | targeted Neovim | PASS | T-984 nvim diff empty; thread tests 23/23, zero skips. |
| M19 | lint/typecheck | PASS | Wire import guard exit 0; complete root typecheck exit 0, no diagnostics. |

Findings, ranked:
- Low, brief M2 (qa/briefs/E-412-stage-2.md:238): recursive grep printed `grep: .cland/hub.sock: Operation not supported on socket`, exit 2, no matches. Coordinator ruling 43304c90-b18e-4d33-aa39-2b49a7b7c5fd corrected the probe to regular files. `find .cland -type f -print0 | xargs -0 grep -a -l -F "$V"` printed nothing and exited 1. Cookie never printed; original capture retained.
- Low, brief M5 (qa/briefs/E-412-stage-2.md:241): inline artifact creation posts a normal chip after the message, so history last is the seq-3 chip, not seq-2 message. Coordinator ruling 5316978b-6547-412d-ad5f-ac608526a854 accepts persisted human attribution: `topic.history before:3 limit:1` returns seq 2 from human/human; seq 3 chip and Unix A-2 list also human/human. Original and corrected captures retained.

No product failure. Run qa-2026-10-21-1; stage “authority, cookie sessions, snapshot and pages”; tested full SHA 479178b25c78ccbb54f908ef7cc7c05c18426cd0. All 20 scoped checks passed; 128 targeted test executions passed. Actual executor local macOS arm64, Node v24.21.0, pinned Neovim v0.12.5. No real browser, GUI or provider call. No full suite submitted by QA; stage covers are the Coordinator's Linux 6773233c/A-8207 and macOS baaf13ec/A-8211 at tree d026d0a84f0b25de15257e303002111bc247cbf1, complete in task.view and outside this brief. Duration budget lines are not a stage criterion.

T-1042 behavior was exercised under logical /var/folders ancestry resolving to /private/var/folders. Valid capability reads passed, while traversal/symlink confinement remained enforced. M17 executes the platform-specific macOS branch of parent-swap tests.

M15 measured the committed tracker copy, not live sessions: items frame 576811 bytes (55.01% cap) versus posted 571512; compose samples 116.042, 103.686, 104.791, 119.066 and 115.929 ms versus posted ~120 ms. Five warm-process compose samples exclude setup/copy/transport; these are not suite wall times.

All exact commands and redacted outputs are retained by case prefix, plus 20 recorder rows. Scratch bearer scan found 0 cookies/capability URLs/auth links in retained evidence. Final HEAD/dev unchanged, worktree clean, scratch hub stopped, own process scan 0; scratch and detached worktree removed. Stage verdict carries no epic criterion marks.

Durable artifact A-8219: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8219-e-412-stage-2-20-checks-pass-at-479178b2/report.md

### qa-676 · 2026-10-21T12:49:19.040Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-2
commit: cb231eeb0824d105824263535c5ee476fe5fc3f5
stage: deltas, resume, the network and the door
stage_hash: 4b14308a46b6372f449c202c580c3fbdfe7a51262791c769a7e788d0ac82417b
findings: [{"severity":"low","text":"M3 legacy layer-map expectation omitted init categories C-1..C-4; approved full map including categories passes, featured slim frame unchanged.","file":"qa/briefs/E-412-stage-3.md","line":285},{"severity":"low","text":"M19 capability URL uses durable artifact basename A-2-qa-other.txt, not source other.txt; approved correction, all bytes/status/CSP/confinement checks pass.","file":"qa/briefs/E-412-stage-3.md","line":301}]
finding_counts: {"high":0,"medium":0,"low":2}

| Check | Result | Command / observation |
| --- | --- | --- |
| S0 | PASS | Clean detached cb231eeb; four stage merges present; three isolated scratch roots; shared credential filter; exact-source web build exit 0; node_modules shared, system TMPDIR retained |
| M1 | PASS | Scratch p1 hub; single-use auth 302/401, strict loopback cookie, session row, CSP headers and foreign Host 403 |
| M2 | PASS | Scratch upgrade no-cookie 401; foreign/null Origin and foreign Host 403; web hello human features[] buildStamp:null, hub.status ok |
| M3 | PASS | Numbered deltas contiguous seq3..11 after snapshot2; seven domains; slim edit layers{}; three projected visibility rows; legacy full map includes C-1..C-4 per Coordinator 441ee4c7 (low brief correction). |
| M4 | PASS | Replay exactly five missed T-7..T-11 deltas17..21 from cursor16 before topic.list result; live change22 follows; no snapshot/duplicate/gap. |
| M5 | PASS | Foreign/future fallback seven snapshots at current epoch; covered cursor no snapshot; explicit replay true then false; missing snapshot resync; bad hello4000. |
| M6 | PASS | Restart retained port49217 and persisted cookie session; new epoch40c1abbe receives fresh seven-domain snapshot, no replayed task. |
| M7 | PASS | Live ping intervals30001ms; no-pong socket closed1006 at80471ms after two pings; auto-pong socket three pings alive100705ms. |
| M8 | PASS | 35-byte and empty binary close4003; exact1048576-byte JSON and next request ok;1048577-byte JSON close1009; hub alive. |
| M9 | PASS | Stamp read at each welcome: null,a*64,b*64,null; unknown feature dropped; Unix shape unchanged; web999 restart-hub4000, Unix999 update guidance. |
| M10 | PASS | HTML stamp, receipt, source and archive digest agree af90afe7; protocol and wire mutations each change digest; unrelated shared file does not; doctor matches sources. |
| M11 | PASS | session.list exposes exactly claude-code,codex,opencode with terminal:none; adapter/type declarations present. |
| M12 | PASS | IPv6 web bind::1:49327 while spoke127.0.0.1:49326; only two loopback listeners; v6web200,v4web/v6spoke000 exit7. |
| M13 | PASS | Tunnel Host+exact HTTPS Origin sets Secure; missing Origin and forwarded-header variants do not; tunnel101, other four upgrades403; human status ok. |
| M14 | PASS | Loopback QR refuses exit1 with reason/0bytes; tunnel QR decodes exact printed link and spends302; conflicting flags exit1; no opener; MIT pinned encoder and no dependency diff. |
| M15 | PASS | Stopped p3 documentation address warns about cleartext; configured tunnel ok; p1loopback and p2tunnel ok. Doctor overall exit1 is outside row scope. |
| M16 | PASS | Seven web authority denials cli-neovim-only; allowed send persisted as human at seq2 and Unix exclusive history returns exact row; hub remains alive. |
| M17 | PASS | One persisted session with exact four columns; ID and SHA256 cookie_hash match; zero empty pattern lines and zero regular-file plaintext-cookie matches. |
| M18 | PASS | Forward exclusive pages[3,4],[5,6],[7]; backward before5 gives[3,4]; exact message texts, no gaps/duplicates. |
| M19 | PASS | Page200 sandbox allow-scripts, CSS200, correct other bytes200, cross404/dotdot403 through symlinked ancestor. Durable basename A-2-qa-other.txt accepted by Coordinator56893b7d (low brief correction). |
| M20 | PASS | All 22 documentation probes match; sections read for numbering, resume, network, liveness, reservations and stamp; no contradiction found. |
| M21 | PASS | Three hub-start secret patterns, zero empty lines, zero matches in all regular evidence/scratch-bundle/built-bundle files. |
| M22 | PASS | Exact brief targeted files serial on macOS arm64 at cb231eeb: 80/80 pass, 0 failures/cancelled/skipped/todo; local queue empty before group. |
| M23 | PASS | Exact brief targeted files serial on macOS arm64 at cb231eeb: 90/90 pass, 0 failures/cancelled/skipped/todo; local queue empty before group. |
| M24 | PASS | Exact brief Headless Shell connection+smoke files:8/8 pass,0 skips; reconnect, stale-page reload once, protocol action and CSP pass; both browser groups end0. |
| M25 | PASS | Four landing nvim diffs0; client-component+thread27/27 pass,0 skips on pinned Neovim0.12.5/system TMPDIR. |
| M26 | PASS | Wire import guard exit0; all typechecks, colours/contrast/hooks and oxlint exit0 with0 warnings/errors. |

Low findings (brief only):
- M3, qa/briefs/E-412-stage-3.md:285: the expected legacy layer map omitted C-1..C-4 created by cland init. Actual legacy full map has those four plus T-5/T-6; featured edit remains layers:{} and no items key. Coordinator decision 441ee4c7 accepts the full map. Original command/observations retained in M3.raw.txt.
- M19, qa/briefs/E-412-stage-3.md:301: the brief expected source basename other.txt; actual capability URL uses the durable artifact basename A-2-qa-other.txt. Correct bytes/status/confinement passed. Coordinator decision 56893b7d accepts that basename. M19.raw.txt retained, scratch bearer values redacted.

Stage: deltas, resume, the network and the door. Run qa-2026-10-21-2 at full SHA cb231eeb0824d105824263535c5ee476fe5fc3f5. All 27 scoped checks PASS. No epic criterion marks.

Actual executor local macOS arm64, Node v24.21.0, Neovim v0.12.5; pinned Chrome Headless Shell revision1248 for M24. Fresh targeted tests: M22 80/80, M23 90/90, M24 8/8, M25 27/27: total205, zero failure/cancellation/skip/todo. No full suite, droplet or GUI browser was run by this pass. Headless Shell is the isolated test browser, not the human's Chrome. Queue local:none before each serial group; no tests ran concurrently. Budget lines are report-only and outside this brief; no timing projection is counted as wall time.

S0 used a clean detached worktree, shared node_modules and an exact-source web build (af90afe76ff70b9c0607d8218af6f70ed89d3ca995bc282d2992f0884a9c9cb4). Shared fixtureEnvironment removed credentials before the shell, with disposable HOME/XDG/Git/account paths; system TMPDIR was retained. Scratch p1 and p2 listeners stayed loopback; documentation-address p3 never started. Four merges present: T-985 aeae1f25, T-986 40d0583f, T-988 ff0f6c7f, T-989 80f8f94c. T-1045/T-1046 were outside the stage plan and their T3 tests were not rerun, per request. Coordinator covers Linux bb909399/A-8381 and macOS b73a6fc9/A-8385 are not this pass's execution.

Final HEAD and dev both cb231eeb, worktree clean. Both scratch hubs stopped; own process scan empty; scratch root and detached worktree removed. M21 found zero hub-secret matches before cleanup. Scratch auth tokens, cookies, capability values and QR rows are redacted from published evidence; status, response headers, assertions, digest comparisons and decoder result remain. The trace message in the intentional smoke failure is a passing trace-capture test, not a product failure.

Durable evidence A-8387: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8387-e-412-stage-3-27-checks-pass-at-cb231eeb/report.md

### hub · 2026-10-21T13:25:20.807Z

demo 181e606e-063d-4e9b-8aa6-b0e89ba5bbba created: droplet cland-v0-181e606e, commit 5f120a4766e3c60bcb5e0775ad19c5338afc2238, deadline 2026-10-21T14:39:15.934Z.

### hub · 2026-10-21T13:35:38.707Z

demo 181e606e-063d-4e9b-8aa6-b0e89ba5bbba destroyed: lifetime 668426 ms; cost $0.0464.

### qa-676 · 2026-10-21T14:02:29.986Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-21-3
commit: 5f120a4766e3c60bcb5e0775ad19c5338afc2238
findings: [{"severity":"medium","text":"First epic suite c5e57fb0 failed fake-Claude cleanup ENOTEMPTY, known T-1035 per Coordinator77241095. Authorized same-head retry fb839f15 passes; both receipts retained.","file":"hub/test/claude-code-adapter.test.ts","line":247},{"severity":"low","text":"C2 per-port cookie-name wording was stale; Coordinator aeddb027 amended it to approved per-project SHA256-root naming. Fresh auth checks pass amended contract."},{"severity":"low","text":"QA probe attempt1 used nonexistent discovery.webBind and expected a network warning on loopback. Original outputs retained; corrected status-field/stopped-config probe and spoke hello pass."}]
finding_counts: {"high":0,"medium":1,"low":2}

| Case | Result | Actual command / observation |
| --- | --- | --- |
| BUILD | PASS | Delivered clean exact SHA; `npm run build --workspace web` succeeded from tested sources. Linux x86_64, Node v24.21.0, pinned Chrome Headless Shell 1248. |
| D0 | PASS | `node --test .cland/qa-epic/dod.test.ts` copied all 1,050 committed tracker files to a disposable project, started fake Claude harness, and observed separate web 33713/spoke 40059 ports. |
| D1 | PASS | Real `cland web --no-open` link opened by isolated Headless Shell; rendered shell Live; spent link 401; cookie HttpOnly, SameSite=Strict, 30 days, unreadable via document.cookie. |
| D2 | PASS | Cookie-authenticated upgrade with foreign/null Origin or foreign Host 403; actual spoke-shaped hello closes 4000. |
| D3 | PASS | Seven ordered snapshot domains at epoch 50a61e75…/seq 82, 1,050 items, fake session, no suite history; all frames within caps. Items 603,533 bytes. |
| D4 | PASS | Actual CLI create/edit yields slim layers: {} and no items key. Drop at 84; five CLI edits; resume yields precisely task deltas 85–89, no snapshot or duplicates. |
| D5 | PASS | Web hub.stop/release/path artifact creation each cli-neovim-only. Scratch CLI `release --item R-999999 --dry-run --json` reaches release logic, exit 1 `cland: no item T-999999`; it is not a release/publication PASS. Coordinator 8adedd94 authorizes this authority-boundary receipt. |
| D6 | PASS | Actual CLI folder artifact creation, web capability HTML 200 with `sandbox allow-scripts`; 406 rows page 200/200/6 with no gap/repeat, last 200 matched backward page. |
| D7 | PASS | CLI stops fake session and hub, restart retains port 33713/cookie; browser reconnects Live; old epoch resume receives seven fresh domains at new epoch f3bee8a8…. |
| D8 | PASS | Scan 11 served bundle files, 497 browser frames, 6 browser responses, cookie storage/localStorage/sessionStorage and frame-client responses: 0 hub-secret matches. No bearer values printed in evidence. |
| D9 | PASS | Headless Shell process-group census before 5/after 0; contexts closed; scratch hub stopped; fixture directories removed by ownership cleanup. |
| N1 | PASS | Separate web 127.0.0.2/spoke 127.0.0.1; loopback-only QR refuses; configured HTTPS tunnel QR decodes exact link. Doctor plain-HTTP warning tested on stopped documentation-address config, never listening outside loopback. LAN QR construction additionally passes fresh AUTH recorded-Unix-frame fixture. |
| SNAPSHOT | PASS | Fresh `node --test hub/test/connection-snapshot.test.ts`: 11/11, 0 skips; races, changed layers, legacy welcome, feature negotiation and serialization per feature set. |
| AUTH | PASS | Fresh `node --test hub/test/web-auth.test.ts`: 28/28, 0 skips; cookie root-hash name/flags/expiry/restart, actual CLI session list/revoke, secret scan, binary/size/liveness/stamp/terminal/network/QR. |
| MEASURE | PASS | `node hub/scripts/measure-snapshot.ts …/.cland/tasks`:1,050 copied items,8 frames,594,794 total bytes; items 590,846 bytes (56.35% cap). Five warm Linux compose samples 477.063,468.080,473.550,458.514,459.061ms. Other domains empty/default; excludes setup/copy/transport; not live-session latency or suite wall. |
| WIRE | PASS | `node hub/test/lint-wire-imports.ts`: 1 source stays inside shared/wire. |
| REUSE | PASS | Read all three stage-to-S patches. Stage 3-to-S core edge/auth/authority/artifact/ring/model-output/snapshot/dispatch/socket/server/suites/CLI-web/doctor-web/QR/Neovim-client diff is empty (`unchanged-core.json`). Reuse only exact claims below. |
| DOCS | PASS | Read S's hub README web, model, history sections and ADR 0003; bind, auth, limits, snapshots, numbered deltas, resume, queue, history and leaf wire contract present. |
| CLEAN | PASS | Delivered source tree clean after removing QA scripts; exact SHA retained. Freshness current:true. Lease released, 668,426 ms / $0.0464184722. |
| SUITE-1 | FAIL | c5e57fb0 at S: Claude adapter cleanup ENOTEMPTY. Known T-1035 per Coordinator 77241095. Retained, never counted as a green suite. |
| SUITE-2 | PASS | Authorized retry fb839f15 at S, full epic run exit 0: 3,570 tests, 3,562 pass, 8 skipped, 0 failed/cancelled/todo. A-8437/A-8438/A-8439. This receipt settles the suite gate. |


Findings, ranked:
- Medium, found aside (known T-1035): SUITE-1, hub/test/claude-code-adapter.test.ts:247, epic run c5e57fb0. Actual error: `ENOTEMPTY: directory not empty, rmdir '/tmp/cland-suite-ovlTXPKMqhmMJw/fake-claude-sBhUtB'` in “Claude Code mod confirmation timeout leaves delivery retryable at the next turn”. Coordinator 77241095 identified known cleanup flake and authorized one same-head retry. SUITE-2 fb839f15 passed. The failed receipt is retained, not reclassified as a pass; final suite gate is settled by the authorized retry.
- Low, criterion correction: C2 originally said per-port cookie name; Coordinator aeddb027 amended it to the human-approved per-project SHA256-root name (ask310190bf). Fresh web-auth test asserts that exact name plus flags, 30-day expiry, restart and revocation. Judged amended C2.
- Low, QA-probe correction: attempt1 incorrectly read discovery.webBind and expected a plain-HTTP warning for loopback127.0.0.2. Actual outputs were undefined versus127.0.0.1 and “ok web network loopback127.0.0.2”. Corrected to hub.status.web.bind and a stopped documentation-address config; also corrected spoke-shaped hello/4000 versus binary4003 before rerun. Both probe versions and original failures retained. Attempt2 passed; these are probe defects, not product failures.

Run qa-2026-10-21-3; tested full dev SHA 5f120a4766e3c60bcb5e0775ad19c5338afc2238. All final scoped checks pass. Marks: C1,C2,C3,C4,C5,C6,C7,C8 verified in this run; no failed marks.

Fresh targeted execution: 41/41 tests, zero skips, on Linux x64 demo, Node v24.21.0, Headless Shell1248. Shared credential filter, disposable HOME/XDG/Git and copied tracker/fake harnesses; browser group ends0, hubs stopped, source clean. Reused actual macOS stage evidence A-8056 at44097bad, A-8219 at479178b2 and A-8387 atcb231eeb only after stage-to-S diff review. Core edge/auth/authority/artifact/ring/queue/snapshot implementations unchanged from stage3; changed tracker/browser reads covered fresh. C4 queue-on-change, C5 ring/queue-limit cases and C8 Neovim compatibility map explicitly to A-8387 M22/M25; full criterion map and complete SHAs in A-8442.

Final epic suite fb839f15 at the same full SHA: full exit0, 3,570 tests, 3,562 pass, 8 skipped, 0 fail/cancelled/todo; A-8437 merged, A-8438/A-8439 shards, coverage A-8440. Linux x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, workers2, T1–T4 base plus Web completed. T4 repetitions skipped; Web3 files/3 top-level tests executed. Test lint132 findings, duration budgets and ratchet are report-only; incomplete ratchet base is not zero or passing performance evidence. Projected T3 wall is not measured wall.

First suite c5e57fb0: A-8429/A-8430/A-8431 retained, exit1 with interruption receipt. Hub completed-before-interruption aggregate3588/3579pass/1fail/8skip differs from normal aggregate3568/3559pass/1fail/8skip; neither is a green run. Shard2 T4 lacked successful completion.

Costs and actual durations:
- First suite shard1 cland-v0-d34607cd c-8 lon1: admission-to-remote-finish1015.61s, lifetime1005s, cost$0.0698, collection23.83s. Shard2 cland-v0-2aa4be79:984.61s, lifetime968s, $0.0672, collection18.14s. Overall1039.51s/$0.1370.
- Retry shard1 cland-v0-919ba7f8 c-8 lon1:1075.91s, lifetime1066s, $0.0740, collection20.91s. Shard2 cland-v0-eb0d1c9c:887.91s, lifetime878s, $0.0610, collection21.08s. Overall1097.06s/$0.1350.
- Demo lease181e606e-063d-4e9b-8aa6-b0e89ba5bbba, deadline14:39:15.934Z, confirmed released668426ms/$0.04641847. Freshness current:true after retry.
- Total reported cost$0.31841847 including failed attempt/retry/demo; suite wall windows total2136.57s. Demo overlaps first suite, so not added as elapsed wall; derived admission-to-final-result span approximately2176s.

Durable final evidence A-8442: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8442-e-412-epic-dod-at-5f120a47-clear-c1-c8-with-green-same-head-retry/report.md
It contains exact commands, corrected and original probes, 18 recorder rows, diff audit, case/criterion map, timing qualifications, and every merged/shard receipt reference. Pending artifact A-8432 remains historical.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
