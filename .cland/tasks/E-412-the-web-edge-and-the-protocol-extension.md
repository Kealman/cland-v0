---
id: E-412
kind: epic
title: The web edge and the protocol extension
state: open
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
updated: 2026-10-21T08:10:13.529Z
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
- [ ] C2. `cland web` and `cland web --qr` print a one-time link spent on first use; `/auth` sets an HttpOnly, SameSite=Strict cookie named per port that lives 30 days and survives hub restarts; cookie sessions are listed and revoked from the CLI.
- [ ] C3. Every upgrade checks Host and Origin, only a client hello is accepted, `as` is refused, and stopping or restarting the hub, releasing and creating artifacts from paths are refused on the web edge; the hub's secret reaches no browser.
- [ ] C4. A client that asks for it receives one snapshot (levels, items, sessions, topics, inbox, the first page of events, accounts; no suite history) with an epoch and a sequence number, then deltas numbered in sequence that carry only changes; the verification queue is pushed only when it changes.
- [ ] C5. `resume` replays the missed deltas from the ring, or sends a fresh snapshot when the ring no longer covers them or the epoch changed, and a connection past its queue limit resyncs.
- [ ] C6. Threads page by message number in both directions, and artifact files are served under capability URLs, HTML with a sandbox policy.
- [ ] C7. The wire types live in a module that imports nothing from the hub; binary frames are refused, the hello and the welcome carry a feature list, and every adapter declares its `terminal` capability; `[web] bind` works and ADR 0003 records its amendment.
- [ ] C8. `hub/README.md` describes the web edge, `cland web`, `[web]`, the snapshot, the deltas, resume and the history pages, and Neovim's frames are unchanged.

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
