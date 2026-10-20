# Stage QA brief: E-412 stage 1 — the edge and the wire

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-412 (the web edge and the protocol extension, under R-377).
- Exact stage name: the edge and the wire.
- Items: T-978, T-980, T-979 (lane one holds T-978 then T-980; lane two holds T-979). Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the three items. T-978: the hub's independent web edge, a stable loopback port recorded as `webPort` in `.cland/hub.json`, the static headers, the Host check, degradation when the port is taken. T-980: `cland web`, the one-time link, `/auth`, the cookie `cland_<key>`, the `/ws` admission checks (cookie, Host, Origin) and the human's client hello. T-979: the wire module (`shared/wire/`), a leaf with no Node import, typechecked DOM-only and held to the hub's types by conformance assertions. Nothing else (the snapshot, deltas, pages and the browser are later stages).

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev (`git log --first-parent --grep "Item: T-978" dev`, likewise T-980 and T-979). A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree, with `npm install` already done there (worktrees share the root's `node_modules`; symlink it if the worktree has none).

## Setup (once, before M1)

Every check runs in a disposable scratch project with its own HOME, XDG and Git config (rule 15). Never the live project, never the human's HOME, never a real browser or GUI. Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-$(date +%F)-1                        # unique run id; bump the suffix on a rerun
EV="$W/.cland/qa/E-412/$RUN"; mkdir -p "$EV"
Q=$(mktemp -d /tmp/qa-e412-XXXXXX)          # scratch root: HOME, XDG, Git config, projects
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/bundle" "$Q/bundle2"
printf '<!doctype html><title>qa</title><p>qa bundle</p>\n' > "$Q/bundle/index.html"
printf '<!doctype html><title>qa2</title><p>qa bundle two</p>\n' > "$Q/bundle2/index.html"
cat > "$Q/env.sh" <<ENV
export HOME="$Q/home" XDG_CONFIG_HOME="$Q/xdg/config" XDG_STATE_HOME="$Q/xdg/state" XDG_DATA_HOME="$Q/xdg/data"
export GIT_CONFIG_GLOBAL="$Q/gitconfig" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=qa GIT_AUTHOR_EMAIL=qa@example.invalid GIT_COMMITTER_NAME=qa GIT_COMMITTER_EMAIL=qa@example.invalid
unset CLAND_HUB_URL CLAND_HUB_SECRET CLAND_HUB_FILE CLAND_SESSION_ID CLAND_SESSION_NAME CLAND_ROLE
cland() { node "$W/hub/bin/cland.ts" "\$@"; }
ENV
. "$Q/env.sh"; : > "$Q/gitconfig"
mkdir -p "$Q/p1" "$Q/p2" && for p in p1 p2; do ( cd "$Q/$p" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . ) ; done
# serve the scratch bundles: [web] dist is the documented development setting; a tiny bundle keeps the checks independent of `npm run build --workspace web`.
# `cland init` already writes a [web] table with dist = "": edit that key, never append a second [web] table (a duplicate table makes config.toml invalid and the hub runs on defaults).
for p in p1:bundle p2:bundle2; do node -e 'const fs=require("fs");const f=process.argv[1];const t=fs.readFileSync(f,"utf8");const n=t.replace(/^(\[web\][^\[]*?^dist = )"[^"]*"/m,(m,a)=>a+JSON.stringify(process.argv[2]));if(n===t)throw new Error("no [web] dist key in "+f);fs.writeFileSync(f,n)' "$Q/${p%%:*}/.cland/config.toml" "$Q/${p#*:}"; done
# M9 runs hub/test/web-auth.test.ts, which reads the built bundle: build it once from the tested sources
( cd "$W" && npm run build --workspace web )
```

Cleanup at the end, after the evidence is recorded: stop both hubs (`( . "$Q/env.sh"; cd "$Q/p1" && cland hub stop; cd "$Q/p2" && cland hub stop )`), kill the port holder of M2, then print `$Q` and remove it by its literal path with a non-force `rm -r` after checking it begins with `/tmp/qa-e412-`.

## Cases

none. Every check below is a manual check against the scratch hub, a named test file or the typecheck.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-412 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, putting the capture in `$EV/<id>.txt` first. In the commands, `WP` is the scratch hub's web port read from `hub.json`; in each check, begin with `. "$Q/env.sh"; cd "$Q/p1"` (the hub of M1 is the one the later checks reuse).

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `cland hub start; WP1=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).webPort)'); cland hub stop; cland hub start; WP2=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).webPort)'); echo "$WP1 $WP2"; cat .cland/web-port` | `WP1` and `WP2` are the same integer in 1-65535, different from the spokes' `port` in `hub.json`; `.cland/web-port` holds that port. The hub is left running for M3-M8. Proven in code by `hub/test/web-edge.test.ts` "the web port survives a hub restart and explicit configuration overrides it" (also checks `[web] port` overriding the kept port) |
| M2 | hub-api | in `$Q/p2`: `cland hub start; P=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).webPort)'); cland hub stop; node -e 'require("net").createServer().listen(+process.argv[1],"127.0.0.1")' "$P" & HOLD=$!; sleep 1; cland hub start; cland hub status; cland doctor . ; node -e 'console.log(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).webPort)'; kill $HOLD` | the second `hub start` succeeds (hub running, spokes served); `webPort` in `hub.json` is still `P` (the hub never moves to another port); `hub status` shows a web line saying the edge is unavailable with a reason naming `EADDRINUSE` and `P`; `doctor` has a `web edge` row with verdict `warn` and the same reason. `curl -s -o /dev/null -m 3 -w '%{http_code}' http://127.0.0.1:$P/` must not return a hub page (the holder is not HTTP: curl fails or gets no response). Proven in code by `hub/test/web-edge.test.ts` "an occupied web port disables only the web edge and doctor reports its reason" |
| M3 | hub-api | `curl -si -m 5 "http://127.0.0.1:$WP2/"` | `HTTP/1.1 200`; `Content-Security-Policy` header containing `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; body is the scratch bundle (`qa bundle`). Proven by `hub/test/web-edge.test.ts` "the bundle has strict headers, revalidation for entry files and immutable assets" |
| M4 | hub-api | `ET=$(curl -sI -m 5 "http://127.0.0.1:$WP2/" \| tr -d '\r' \| sed -n 's/^[Ee][Tt]ag: //p'); curl -sI -m 5 "http://127.0.0.1:$WP2/" \| grep -i '^cache-control'; curl -si -m 5 -H "If-None-Match: $ET" "http://127.0.0.1:$WP2/"` | `ET` is non-empty; `Cache-Control` contains `no-cache`; the conditional request answers `HTTP/1.1 304` with no body (same test as M3; extensionless `GET /anything` also returns `index.html` per "bundle path confinement with extensionless route fallback") |
| M5 | hub-api | `for h in "evil.example:$WP2" "127.0.0.2:$WP2" "127.0.0.1:$((WP2+1))" "localhost"; do curl -s -o /dev/null -m 5 -w "$h %{http_code}\n" -H "Host: $h" "http://127.0.0.1:$WP2/"; done; curl -s -o /dev/null -m 5 -w 'loopback %{http_code}\n' -H "Host: localhost:$WP2" "http://127.0.0.1:$WP2/"` | the four foreign or portless Hosts print `403`; `localhost:$WP2` prints `200`. Proven by `hub/test/web-edge.test.ts` "the web edge accepts only a loopback Host with its exact port" |
| M6 | hub-api | `cland web --no-open > "$EV/link.txt"; cat "$EV/link.txt"` | exits 0 and prints exactly one `http://127.0.0.1:<WP2>/auth?token=<64 hex digits>` link; nothing is opened (no browser, `--no-open`). The hub's `.cland/` holds no copy of the token (`grep -r "$TOKEN" .cland` finds nothing; the hub keeps only its SHA-256). Proven by `hub/test/web-auth.test.ts` "cland web --no-open prints a single-use link; auth sets the cookie and redirects" and `hub/test/web-auth-unit.test.ts` "links retain only a SHA-256 digest, spend once, and expire at five minutes" |
| M7 | hub-api | `URL=$(grep -o 'http://[^ ]*' "$EV/link.txt"); curl -si -m 5 "$URL" \| tee "$EV/auth1.txt"; curl -si -m 5 "$URL" \| tee "$EV/auth2.txt"` | first response: `HTTP/1.1 302`, `Location: /`, one `Set-Cookie: cland_<12 hex digits>=<value>` carrying `HttpOnly`, `SameSite=Strict`, `Path=/` and `Max-Age=2592000`; the second use of the same link answers `HTTP/1.1 401` and sets no cookie. An unknown token (`/auth?token=00`) also answers `401`. Proven by the same web-auth test and "web.link is callable by a local test client and auth expires at five minutes" |
| M8 | hub-api | `COOKIE=$(sed -n 's/^[Ss]et-[Cc]ookie: \([^;]*\).*/\1/p' "$EV/auth1.txt" \| tr -d '\r'); UP='-H Connection:Upgrade -H Upgrade:websocket -H Sec-WebSocket-Version:13 -H Sec-WebSocket-Key:dGhlIHNhbXBsZSBub25jZQ=='; O="http://127.0.0.1:$WP2"; for t in "nocookie|-H Origin:$O" "foreignorigin|-H Cookie:$COOKIE -H Origin:https://foreign.example" "nullorigin|-H Cookie:$COOKIE -H Origin:null" "noorigin|-H Cookie:$COOKIE"; do curl -s -o /dev/null -m 5 -w "${t%%\|*} %{http_code}\n" $UP ${t#*\|} "$O/ws"; done` | `nocookie 401`; `foreignorigin 403`; `nullorigin 403`; `noorigin 403`; none answers `101`. Proven by the four refusals of `hub/test/web-auth.test.ts` "/ws refuses an upgrade before frames with cookie / Host / Origin / null Origin / missing Origin" and by "/ws welcomes a secret-free client as human and answers hub.status" (the accepted path, which needs a WebSocket client and is left to the test) |
| M9 | hub-api | `node --test hub/test/web-edge.test.ts hub/test/web-auth.test.ts hub/test/web-auth-unit.test.ts` (from `$W`, under cover-quiet admission: no cover is running, no other test run by this session) | exit 0; every test in the three files passes, none skipped |
| M10 | hub-api | `node hub/test/lint-wire-imports.ts` (the T0 import guard, which runs its own negative fixtures at load); then `node --test hub/test/scenarios/hub-lifecycle.test.ts` | exit 0 for both; the lifecycle scenario asserts `webPort` in `hub.json` and the `web` line of `hub status` |
| M11 | hub-api | `npm run typecheck` | exit 0, no diagnostics. It includes the DOM-only wire typecheck and `hub/test/wire-conformance.ts` (T-979 C2, C3); a hub type that drifts from its wire type breaks it |

Re-check helper and file names with grep at the tested build, renames happen. The guard is a plain script (it is in `npm run test:static`), not a `node --test` file.

## Probes that mislead

- Process probes exclude their own shell: use `pgrep`'s bracket trick or exclude the probe's process tree.
- Never treat `hub status` of the live project as evidence: the scratch hub is the one whose `.cland/hub.json` sits under `$Q/p1` and `$Q/p2`. Confirm `pwd` before each command.
- `curl` with `-I` sends HEAD, which `/auth` answers `405` without spending the link: spend the link only with GET (M7).
- The Host header test needs `-H "Host: …"` on a loopback URL; do not change the URL's host.
- A `port` that differs between runs is the spokes' WebSocket port (chosen free at each start), not the web port; compare `webPort` only.
- A missing `web/dist` makes the stock hub answer `503` with the build hint; the setup points `[web] dist` at a scratch bundle, so a `503` here is a failure of the setup, not of the item.
- Targeted test runs obey cover-quiet admission: if the Coordinator holds a cover slot, wait; do not run two test files at once.
- "No skip": all three web test files are platform-independent T1/T2 and must run on both Linux and macOS; a skipped test is a failure of M9.

## Out of scope

The browser itself (no real browser, no GUI), the welcome-over-`/ws` conversation beyond what the named tests prove, the cookie sessions' persistence and revocation (T-982, a later stage), the snapshot, deltas and pages (later stages), `npm run build --workspace web` and the bundle's content, Linux/macOS stage covers (the Coordinator's business, not judged here), and duration budget lines (report-only).

## Grants

none.

## Verdict

Fix nothing. Clear only when every check M1-M11 and S0 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "the edge and the wire"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-412 stage the edge and the wire` or `qa not clear E-412 stage the edge and the wire` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
