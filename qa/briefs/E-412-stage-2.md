# Stage QA brief: E-412 stage 2 — authority, cookie sessions, snapshot and pages

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-412 (the web edge and the protocol extension, under R-377).
- Exact stage name: authority, cookie sessions, snapshot and pages.
- Items: T-981, T-983, T-984, T-982, T-987 (lane one holds T-981 then T-983; lane two holds T-984, then T-982, then T-987). Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the five items. T-981: the web's deny-by-default authority table; on the web edge `hub.stop`, `hub.reload`, `release`, `sync`, `push`, `publish`, `config.set`, `crew.set`, the three `executor.*` frames, `task.migrate`, `web.link`, `artifact.create` with a `path`, any frame carrying `as` and any unclassified frame are refused with code `cli-neovim-only` and an error naming the CLI and Neovim, while `topic.send` and inline `artifact.create` pass and are recorded as the human's, and the Unix socket keeps its authority. T-982: cookie sessions kept in `hub.db` as SHA-256 hashes, surviving a hub restart, listed by `cland web --sessions` and ended by `cland web --revoke <id>`, which closes that session's sockets within the call. T-983: the `snapshot` hello feature: seven domain frames under one epoch and one seq, closed by `snapshot.end`, with no suite or verdict history; a hello without the feature gets today's frames. T-984: numbered `topic.history` pages with exclusive `before`/`after` cursors, at most 200 a page, with no gap or repeat; no cursor answers as before. T-987: `artifact.url` capability URLs under `/a/<capability>/<file>`, served with the extension's type, HTML with `Content-Security-Policy: sandbox allow-scripts`, confined to their own artifact, surviving a hub restart and dying with their cookie session. Nothing else (deltas, resume, the network and the door are stage 3; the browser is later).

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev (`git log --first-parent --grep "Item: T-981" dev`, likewise T-983, T-984, T-982 and T-987). A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree, with `npm install` already done there (worktrees share the root's `node_modules`; symlink it if the worktree has none). The frame helper below loads `ws` from that `node_modules`.

## Setup (once, before M1)

Every check runs in a disposable scratch project with its own HOME, XDG and Git config (rule 15). Never the live project, never the human's HOME, never a real browser or GUI. Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-s2-$(date +%F)-1                     # unique run id; bump the suffix on a rerun
EV="$W/.cland/qa/E-412/$RUN"; mkdir -p "$EV"
Q=$(mktemp -d /tmp/qa-e412s2-XXXXXX)        # scratch root: HOME, XDG, Git config, project
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/bundle"
printf '<!doctype html><title>qa</title><p>qa bundle</p>\n' > "$Q/bundle/index.html"
cat > "$Q/env.sh" <<ENV
export HOME="$Q/home" XDG_CONFIG_HOME="$Q/xdg/config" XDG_STATE_HOME="$Q/xdg/state" XDG_DATA_HOME="$Q/xdg/data"
export GIT_CONFIG_GLOBAL="$Q/gitconfig" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=qa GIT_AUTHOR_EMAIL=qa@example.invalid GIT_COMMITTER_NAME=qa GIT_COMMITTER_EMAIL=qa@example.invalid
unset CLAND_HUB_URL CLAND_HUB_SECRET CLAND_HUB_FILE CLAND_SESSION_ID CLAND_SESSION_NAME CLAND_ROLE
cland() { node "$W/hub/bin/cland.ts" "\$@"; }
ENV
. "$Q/env.sh"; : > "$Q/gitconfig"
mkdir -p "$Q/p1" && for p in p1; do ( cd "$Q/$p" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . ) ; done
# serve the scratch bundle: [web] dist is the documented development setting; a tiny bundle keeps the checks independent of `npm run build --workspace web`.
# `cland init` already writes a [web] table with dist = "": edit that key, never append a second [web] table (a duplicate table makes config.toml invalid and the hub runs on defaults).
for p in p1:bundle; do node -e 'const fs=require("fs");const f=process.argv[1];const t=fs.readFileSync(f,"utf8");const n=t.replace(/^(\[web\][^\[]*?^dist = )"[^"]*"/m,(m,a)=>a+JSON.stringify(process.argv[2]));if(n===t)throw new Error("no [web] dist key in "+f);fs.writeFileSync(f,n)' "$Q/${p%%:*}/.cland/config.toml" "$Q/${p#*:}"; done
# M17 runs hub/test/web-auth.test.ts, which reads the built bundle: build it once from the tested sources
( cd "$W" && npm run build --workspace web )

# Stage 2 additions to env.sh: the helper's worktree, the web port reader, and no provider token
# for the hub (a refused executor.* frame must never reach a provider, even after a regression).
echo "export QA_W=\"$W\"" >> "$Q/env.sh"
cat >> "$Q/env.sh" <<'ENV'
unset DIGITALOCEAN_TOKEN
wp() { node -e 'console.log(JSON.parse(require("fs").readFileSync(".cland/hub.json","utf8")).webPort)'; }
ENV
. "$Q/env.sh"

# Artifact sources inside the scratch project (M3, M10)
mkdir -p "$Q/p1/qa-src/page"
printf '<!doctype html><title>qa page</title><link rel="stylesheet" href="style.css"><p>qa page</p>\n' > "$Q/p1/qa-src/page/index.html"
printf 'body { color: green }\n' > "$Q/p1/qa-src/page/style.css"
printf 'qa other bytes\n' > "$Q/p1/qa-src/other.txt"

# The frame helper: a WebSocket (web) or Unix-socket (unix) client that prints what the hub sends.
cat > "$Q/frames.cjs" <<'JS'
'use strict';
// QA frame client (E-412 stage 2). It prints what the scratch hub sends and asserts nothing.
// node "$Q/frames.cjs" web|unix ['<extra hello fields as JSON>'] < frames.jsonl   (run in $Q/p1)
// web: Cookie from the file $QA_COOKIE (default $Q/cookieA), Origin http://127.0.0.1:<webPort>.
// unix: socket and secret from ./.cland/hub.json (the secret is never printed).
// stdin: one frame per line (ids q1, q2, ... added when missing), or the pseudo-frame
// {"qa":"walk","topic":"<id>","limit":200,"insert":true} (forward and backward history walk).
// QA_SETTLE: ms to wait after the last answer (default 700). QA_FULL=1: print snapshot values.
// QA_HOLD=1: keep the socket open after printing, then print "closed <code>" when the hub closes it.
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { createRequire } = require('node:module');

const mode = process.argv[2];
if (mode !== 'web' && mode !== 'unix') { console.error('usage: frames.cjs web|unix [hello-json] < frames.jsonl'); process.exit(2); }
const extra = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const input = fs.readFileSync(0, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
const discovery = JSON.parse(fs.readFileSync('.cland/hub.json', 'utf8'));
const received = [];
let waiters = [];
let next = 0;

function onFrame(frame) {
  received.push(frame);
  for (const w of [...waiters]) if (w.test(frame)) { waiters = waiters.filter(x => x !== w); w.done(frame); }
}
function waitFor(test, ms = 5000) {
  return new Promise((resolve, reject) => {
    const w = { test, done: frame => { clearTimeout(timer); resolve(frame); } };
    const timer = setTimeout(() => { waiters = waiters.filter(x => x !== w); reject(new Error('timeout')); }, ms);
    waiters.push(w);
  });
}
function connect() {
  return new Promise((resolve, reject) => {
    if (mode === 'web') {
      const { WebSocket } = createRequire(path.join(process.env.QA_W, 'package.json'))('ws');
      const cookie = fs.readFileSync(process.env.QA_COOKIE || path.join(__dirname, 'cookieA'), 'utf8').trim();
      const origin = `http://127.0.0.1:${discovery.webPort}`;
      const ws = new WebSocket(`ws://127.0.0.1:${discovery.webPort}/ws`, { origin, headers: { Cookie: cookie } });
      ws.on('unexpected-response', (req, res) => { req.destroy(); reject(new Error(`upgrade refused: HTTP ${res.statusCode}`)); });
      ws.on('error', reject);
      ws.on('message', data => onFrame(JSON.parse(data.toString())));
      const closed = new Promise(done => ws.on('close', code => done(`closed ${code}`)));
      ws.on('open', () => resolve({ send: frame => ws.send(JSON.stringify(frame)), end: () => ws.terminate(), closed }));
    } else {
      const socket = net.createConnection(discovery.socket);
      let buffer = '';
      socket.setEncoding('utf8');
      socket.on('data', chunk => {
        buffer += chunk;
        for (let nl = buffer.indexOf('\n'); nl >= 0; nl = buffer.indexOf('\n')) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (line) onFrame(JSON.parse(line));
        }
      });
      socket.on('error', reject);
      const closed = new Promise(done => socket.on('close', () => done('closed socket')));
      socket.on('connect', () => resolve({ send: frame => socket.write(`${JSON.stringify(frame)}\n`), end: () => socket.destroy(), closed }));
    }
  });
}
function exchange(link, frame) {
  const hello = frame.type === 'hello';
  if (!hello && frame.id === undefined) frame = { ...frame, id: `q${++next}` };
  const wait = waitFor(hello ? f => f.type === 'welcome' || f.type === 'result' : f => f.type === 'result' && f.id === frame.id);
  link.send(frame);
  return wait;
}
async function walk(link, spec) {
  const limit = spec.limit ?? 200;
  const page = async cursor => {
    const result = await exchange(link, { type: 'topic.history', id: `w${++next}`, topic: spec.topic, limit, ...cursor });
    if (!result.ok) throw new Error(`topic.history refused: ${result.error}`);
    return result.value.messages;
  };
  const forward = [];
  let after = 0;
  let inserted = null;
  for (let guard = 0; guard < 20; guard++) {
    const rows = await page({ after });
    if (!rows.length) break;
    forward.push(rows);
    after = rows.at(-1).seq;
    if (spec.insert && inserted === null) {
      const sent = await exchange(link, { type: 'topic.send', id: `w${++next}`, topic: spec.topic, text: 'qa-inserted' });
      inserted = sent.ok ? sent.value.message.seq : `refused: ${sent.error}`;
    }
  }
  const backward = [];
  let rows = await page({});
  for (let guard = 0; rows.length && guard < 20; guard++) { backward.push(rows); rows = await page({ before: rows[0].seq }); }
  const f = forward.flat();
  const b = [...backward].reverse().flat();
  const seqs = list => list.map(m => m.seq);
  return {
    type: 'qa-walk', topic: spec.topic, forwardPages: forward.map(p => p.length), backwardPages: backward.map(p => p.length),
    total: f.length, numbered: f.every(m => Number.isSafeInteger(m.seq) && m.seq > 0), distinct: new Set(seqs(f)).size,
    forwardAscending: f.every((m, i) => i === 0 || f[i - 1].seq < m.seq),
    backwardEqualsForward: JSON.stringify(seqs(b)) === JSON.stringify(seqs(f)),
    pageTexts: new Set(f.map(m => m.text).filter(t => /^page-\d+$/.test(t))).size,
    insertedSeq: inserted, insertedCount: f.filter(m => m.seq === inserted).length,
    insertedPage: forward.findIndex(p => p.some(m => m.seq === inserted)), last: f.length ? f.at(-1).seq : null,
  };
}
function show(frame) {
  if (frame.type === 'snapshot' && !process.env.QA_FULL) {
    return { type: frame.type, epoch: frame.epoch, seq: frame.seq, domain: frame.domain, bytes: Buffer.byteLength(JSON.stringify(frame)), keys: Object.keys(frame.value ?? {}) };
  }
  if (frame.type === 'result' && frame.value && Array.isArray(frame.value.messages)) {
    const m = frame.value.messages;
    const brief = x => x && { seq: x.seq, text: x.text, from: x.from, fromKind: x.fromKind };
    return { ...frame, value: { topic: frame.value.topic?.id, count: m.length, seqs: m.map(x => x.seq), first: brief(m[0]), last: brief(m.at(-1)) } };
  }
  return frame;
}
function report() {
  let out = '';
  for (const frame of received) if (!(frame.type === 'result' && /^w\d+$/.test(String(frame.id)))) out += `${JSON.stringify(show(frame))}\n`;
  return out;
}
(async () => {
  let link;
  try {
    link = await connect();
    const snapshot = Array.isArray(extra.features) && extra.features.includes('snapshot');
    const ended = snapshot ? waitFor(f => f.type === 'snapshot.end' || f.type === 'snapshot.refused').catch(() => ({ type: 'qa-timeout', waiting: 'snapshot.end' })) : null;
    await exchange(link, { type: 'hello', protocol: 2, client: mode === 'web' ? 'web' : 'ui', ...extra, ...(mode === 'unix' ? { secret: discovery.secret } : {}) });
    if (ended) { const end = await ended; if (end.type === 'qa-timeout') received.push(end); }
    for (const frame of input) {
      if (frame.qa === 'walk') received.push(await walk(link, frame));
      else await exchange(link, frame).catch(() => received.push({ type: 'qa-timeout', waiting: frame.type }));
    }
    await new Promise(done => setTimeout(done, Number(process.env.QA_SETTLE ?? 700)));
    process.stdout.write(report());
    if (process.env.QA_HOLD) { process.stdout.write('holding\n'); process.stdout.write(`${await link.closed}\n`); return; }
  } catch (error) {
    received.push({ type: 'qa-error', message: error.message });
    process.stdout.write(report());
    process.exitCode = 1;
  }
  link?.end();
  setTimeout(() => process.exit(), 1000).unref();
})();
JS
cat > "$Q/pick.cjs" <<'JS'
'use strict';
// node "$Q/pick.cjs" <file> <dotted.path>: prints that field of the file's JSON, or of each JSON line holding it.
const fs = require('node:fs');
const [file, key] = process.argv.slice(2);
const text = fs.readFileSync(file, 'utf8');
let docs;
try { docs = [JSON.parse(text)]; } catch { docs = text.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }); }
for (const doc of docs) {
  const value = key.split('.').reduce((v, k) => (v === null || v === undefined ? undefined : v[k]), doc);
  if (value !== undefined) console.log(typeof value === 'string' ? value : JSON.stringify(value));
}
JS
node --check "$Q/frames.cjs" && node --check "$Q/pick.cjs"
```

Cleanup at the end, after the evidence is recorded: stop the hub (`( . "$Q/env.sh"; cd "$Q/p1" && cland hub stop )`), confirm no helper is left (`pgrep -fl "[f]rames.cjs"` prints nothing; otherwise terminate those pids), then print `$Q` and remove it by its literal path with a non-force `rm -r` after checking it begins with `/tmp/qa-e412s2-`. Capability URLs and cookies in `$Q` and `$EV` are scratch bearer credentials of a hub that no longer runs; never post them to a topic.

## Cases

none. Every check below is a manual check against the scratch hub, a named test file, the typecheck or a static guard.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-412 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, putting the capture in `$EV/<id>.txt` first. In each check, begin with `. "$Q/env.sh"; cd "$Q/p1"` (the hub of M1 is the one the later checks reuse; M12 and M14 restart it in place). Values that later checks reuse are kept in files under `$Q`: `cookieA`, `cookieB`, `sidA`, `noteid`, `otherid`, `topic.json`, `caps.txt`, `capB`. `frames.cjs` output is one JSON frame per line; "result" below means a `{"type":"result",…}` line.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `cland hub start; echo "WP=$(wp)"; cland web --no-open > "$EV/linkA.txt"; curl -si -m 5 "$(cat "$EV/linkA.txt")" \| tee "$EV/authA.txt"; tr -d '\r' < "$EV/authA.txt" \| sed -n 's/^[Ss]et-[Cc]ookie: \([^;]*\).*/\1/p' > "$Q/cookieA"; cland web --sessions \| tee "$EV/M1-sessions.txt"; awk 'NR==2{print $1}' "$EV/M1-sessions.txt" > "$Q/sidA"` | the hub starts; `WP` is an integer; `/auth` answers `HTTP/1.1 302` with one `Set-Cookie: cland_<12 hex digits>=…` (stage 1 behaviour, the base for this stage); `cland web --sessions` exits 0 and prints the header `ID  CREATED  LAST USED  SOCKETS` and exactly one row: a UUID (`[a-f0-9-]{36}`), a UTC ISO creation time, the same last-use time, and `0` sockets (T-982 C3). Proven by `hub/test/web-auth.test.ts` "cland web lists timestamps and socket counts and revokes only the chosen session within the call" |
| M2 | hub-api | `node -e 'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync(".cland/hub.db",{readOnly:true});console.log(JSON.stringify(d.prepare("select * from web_sessions").all()))' \| tee "$EV/M2.txt"; V=$(cut -d= -f2- "$Q/cookieA"); printf %s "$V" \| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(require("crypto").createHash("sha256").update(s).digest("hex")))'; grep -r -a -l -F "$V" .cland; echo "grep exit $?"` | one row with exactly the columns `id`, `cookie_hash`, `created_at`, `last_used_at`; `id` equals `$Q/sidA`; `cookie_hash` equals the printed SHA-256 of the cookie value; `grep` finds the cookie value in no file under `.cland` (`grep exit 1`): `hub.db` holds only the hash, its creation and last use (T-982 C2). Proven by `hub/test/web-auth-unit.test.ts` "cookie rows contain only a hash and timestamps and survive reopening the store" |
| M3 | hub-api | `printf '%s\n' '{"type":"hub.stop"}' '{"type":"hub.reload"}' '{"type":"release","item":"R-999","dryRun":true}' '{"type":"sync"}' '{"type":"push"}' '{"type":"publish","branch":"marketing","item":"T-999","dryRun":true}' '{"type":"config.set","key":"plan.approval","value":"human"}' '{"type":"crew.set","key":"reviewer.keep_context","value":true}' '{"type":"executor.prepare"}' '{"type":"executor.reap"}' '{"type":"executor.retire-legacy","confirmRegisteredHubs":false}' '{"type":"task.migrate","dryRun":true}' '{"type":"web.link"}' '{"type":"web.sessions"}' '{"type":"web.revoke","session":"unknown"}' '{"type":"artifact.create","kind":"note","title":"p","topic":"general","path":"qa-src/other.txt"}' '{"type":"artifact.create","kind":"note","title":"pc","topic":"general","path":"qa-src/other.txt","content":"x"}' '{"type":"hub.status","as":{"name":"human"}}' '{"type":"hub.status","as":null}' '{"type":"future.frame"}' '{"type":"hub.status"}' \| node "$Q/frames.cjs" web \| tee "$EV/M3.txt"; cland hub status; cland web --sessions; cland artifact new --kind file --title "QA other" --topic general --path qa-src/other.txt \| tee "$EV/M3-other.txt"; awk '{print $1; exit}' "$EV/M3-other.txt" > "$Q/otherid"` | first line `welcome` with `name: "human"`; then 20 results with `ok: false`, `code: "cli-neovim-only"` and `error` of the form `<type> lives in the CLI and Neovim: <reason>`: the two `as` frames say `acts as another identity`, both `artifact.create` frames `reads a local artifact path`, `future.frame` `has no web authority classification`; the last result (`hub.status`) is `ok: true`. No `qa-timeout`/`qa-error` line. Afterwards the hub still runs (`hub status`), and over the Unix socket `cland web --sessions` exits 0 and `artifact new --path` creates the artifact (one line `A-<n> file · QA other  human · …`; `$Q/otherid` holds `A-<n>`): the CLI keeps the authority the web lacks (T-981 C1, C2, C4). Proven by `hub/test/web-authority.test.ts` "web refuses <type>; Unix retains its normal handler" (one test per frame: release, publish, config.set, crew.set, executor.prepare, executor.reap, executor.retire-legacy, task.migrate, web.link, …), "web refuses hub.reload with CLI and Neovim guidance; the Unix socket still reloads", "web refuses push; Unix retains its tracker precondition without running Git" (and sync), "web cannot stop the hub; Unix can stop the in-process hub", "web refuses artifact.create paths without reading them; Unix creates from the path", "web refuses unknown and prototype frame names by default", `hub/test/web-auth.test.ts` "web.sessions refuses browser and session-shell requests" (and web.revoke) |
| M4 | hub-api | `printf '%s\n' '{"type":"hello","protocol":2,"client":"web"}' '{"type":"hub.status"}' \| node "$Q/frames.cjs" web '{"as":{"name":"pretend-session"}}' \| tee "$EV/M4.txt"` | line 1: result `id: "?"`, `ok: false`, `code: "cli-neovim-only"`, `error: "hello lives in the CLI and Neovim: acts as another identity"`; line 2: `welcome` with `name: "human"` (the plain hello is still accepted); line 3: `hub.status` result `ok: true` (T-981 C2). Proven by `hub/test/web-authority.test.ts` "web refuses as on the initial hello and still requires a valid human hello" and the six "web refuses an own as field (…) before replay and attribution" tests |
| M5 | hub-api | `printf '%s\n' '{"type":"topic.send","topic":"general","text":"qa from the browser"}' '{"type":"artifact.create","kind":"note","title":"QA web note","topic":"general","content":"qa browser bytes"}' '{"type":"topic.list"}' \| node "$Q/frames.cjs" web \| tee "$EV/M5.txt"; node "$Q/pick.cjs" "$EV/M5.txt" value.artifact.id > "$Q/noteid"; printf '{"type":"topic.history","topic":"general","limit":5}\n' \| node "$Q/frames.cjs" unix; cland artifact list --topic general --json > "$EV/M5-list.json"; node "$Q/pick.cjs" "$EV/M5-list.json" artifacts` | all three results `ok: true`; the `topic.send` value's `message` has `from: "human"`, `fromKind: "human"` and an integer `seq`; the `artifact.create` value's `artifact` has `creator: "human"`, `creatorKind: "human"`; `$Q/noteid` holds one `A-<n>`. Over the Unix socket the General history's `last` is `qa from the browser` from `human`/`human`, and the artifact list shows `QA web note` with `creator: "human"`, `creatorKind: "human"` (T-981 C3). Proven by `hub/test/web-authority.test.ts` "web topic messages and inline artifacts are recorded as the human" |
| M6 | hub-api | `node "$Q/frames.cjs" web '{"features":["snapshot","numbered-deltas","slim-frames","unknown","snapshot"]}' < /dev/null \| tee "$EV/M6a.txt"; node "$Q/frames.cjs" web '{"features":["snapshot"]}' < /dev/null \| tee "$EV/M6b.txt"; node "$Q/frames.cjs" unix '{"features":["snapshot"]}' < /dev/null \| tee "$EV/M6c.txt"; QA_FULL=1 node "$Q/frames.cjs" web '{"features":["snapshot"]}' < /dev/null > "$EV/M6-full.txt"; grep -c '"suites"' "$EV/M6-full.txt"` | `M6a`: exactly nine lines: `welcome` (`name: "human"`, `features: ["snapshot"]`), then seven `snapshot` lines with domains in the order `tracker`, `items`, `sessions`, `topics`, `inbox`, `events`, `accounts`, then `snapshot.end`; all eight share one UUID `epoch` and one integer `seq`; no other frame between the first snapshot and the end marker. Keys: tracker `levels, ladder, prefixes`; items `items`; sessions `processes, presence, archived, roles, crew, coordinator, verification`; topics `topics`; inbox includes `needsYou`; events `rows, before, more`; accounts includes `accounts`. Every `bytes` is at most its cap (tracker 65,536; accounts 262,144; the others 1,048,576). `M6b` and `M6c` (Unix, `name: "ui"`) repeat the shape with the same `epoch` and each a larger `seq`. `grep -c '"suites"'` prints `0`: no suite history (T-983 C1, C2, C3). Proven by `hub/test/connection-snapshot.test.ts` "hello negotiates snapshot alone and legacy clients keep their existing welcome", "snapshot contains each workbench domain, compact verdict rounds and recent closed topics" (one assertion per domain, no item verdict history) and "a model change raced against the first snapshot frame runs after its end marker" (C4) |
| M7 | hub-api | `export QA_SETTLE=1500; node "$Q/frames.cjs" web < /dev/null \| tee "$EV/M7a.txt"; node "$Q/frames.cjs" web '{"features":[]}' < /dev/null \| tee "$EV/M7b.txt"; node "$Q/frames.cjs" web '{"features":["future-extension"]}' < /dev/null \| tee "$EV/M7c.txt"; node "$Q/frames.cjs" unix < /dev/null \| tee "$EV/M7d.txt"` | each capture is exactly one `welcome` line and nothing after it within 1.5 s: `M7a` (web, `name: "human"`) and `M7d` (Unix, `name: "ui"`) have no `features` key; `M7b` and `M7c` carry `features: []`. No `snapshot`, `snapshot.end` or `snapshot.refused` line in any of them: a hello without the feature gets today's frames (T-983 C1). Proven by the same "hello negotiates snapshot alone…" test |
| M8 | hub-api | `cland topic create "QA pages" --json > "$Q/topic.json"; T=$(node "$Q/pick.cjs" "$Q/topic.json" topic.id); for i in $(seq 1 450); do printf '{"type":"topic.send","topic":"%s","text":"page-%s"}\n' "$T" "$i"; done \| QA_SETTLE=0 node "$Q/frames.cjs" unix > "$EV/M8-send.txt"; grep -c '"ok":true' "$EV/M8-send.txt"; printf '{"qa":"walk","topic":"%s","limit":200,"insert":true}\n' "$T" \| node "$Q/frames.cjs" unix \| tee "$EV/M8.txt"` | `grep -c` prints `450`; the walk line has `numbered: true`, `forwardPages: [200,200,51]` and `backwardPages: [200,200,51]` (450 messages plus `qa-inserted`, written by the helper after the first forward page was read), `total: 451`, `distinct: 451`, `forwardAscending: true`, `backwardEqualsForward: true`, `pageTexts: 450`, `insertedCount: 1`, `insertedPage: 2` (a later `after` page, never the first) and `last` equal to `insertedSeq`. If the hub wrote its own notice into the new topic, `total` and the last page grow by that count and the other figures still hold. No `qa-error` line (T-984 C1, C2, C3). Proven by `hub/src/hub/store.test.ts` "numeric history walks 450 messages in three pages in either direction without gaps or repeats" and "a message inserted between forward pages appears exactly once after the existing tail" |
| M9 | hub-api | `T=$(node "$Q/pick.cjs" "$Q/topic.json" topic.id); printf '{"type":"topic.history","topic":"%s","after":0,"limit":500}\n{"type":"topic.history","topic":"%s"}\n{"type":"topic.history","topic":"%s","after":0,"before":10}\n{"type":"topic.history","topic":"%s","after":-1}\n{"type":"topic.history","topic":"%s","after":1.5}\n' "$T" "$T" "$T" "$T" "$T" \| node "$Q/frames.cjs" web \| tee "$EV/M9.txt"` | over the web edge: result 1 `ok: true`, `count: 200` (a `limit` of 500 is capped at 200), `seqs` strictly ascending, `first.text` `page-1`; result 2 (no cursor) `ok: true`, `count: 50` (the default), oldest first, `last.text` `qa-inserted`: no-cursor history answers as before; results 3 (both cursors), 4 (negative) and 5 (non-integer) `ok: false` (T-984 C1, C4). Proven by `hub/src/hub/store.test.ts` "history accepts exclusive safe-integer cursors and refuses ambiguous or invalid cursors" and "legacy history keeps its latest-first selection and oldest-first output, including message-id before", and `hub/test/topics-component.test.ts` "a message from the UI is queued while no session holds the coordinator role, reaches the coordinator as a deliver with the topic, and turns delivered on the ack" (its `seq`, `after` and `before` assertions) |
| M10 | hub-api | `cland artifact new --kind page --title "QA page" --topic general --path qa-src/page --entry index.html \| tee "$EV/M10-page.txt"; PAGE=$(awk '{print $1; exit}' "$EV/M10-page.txt"); NOTE=$(cat "$Q/noteid"); OTHER=$(cat "$Q/otherid"); printf '{"type":"artifact.url","artifact":"%s"}\n' "$PAGE" "$NOTE" "$NOTE" "$OTHER" A-999999 \| node "$Q/frames.cjs" web \| tee "$EV/M10-mint.txt"; node "$Q/pick.cjs" "$EV/M10-mint.txt" value.url > "$Q/caps.txt"; cat "$Q/caps.txt"; printf '{"type":"artifact.url","artifact":"%s"}\n' "$NOTE" \| node "$Q/frames.cjs" unix; U1=$(sed -n 1p "$Q/caps.txt"); U2=$(sed -n 2p "$Q/caps.txt"); curl -si -m 5 "$U1"; curl -si -m 5 "${U1%index.html}style.css"; curl -si -m 5 "$U2"; curl -sI -m 5 "$U2"; curl -si -m 5 "$(sed -n 4p "$Q/caps.txt")"` | four mint results `ok: true` with `url` `http://127.0.0.1:<WP>/a/<64 hex>/<file>`: the page's ends in `/index.html`; the two note mints carry different capabilities; `A-999999` is `ok: false` (`no artifact file is available`). The Unix-socket mint is `ok: false` with `artifact.url requires the authenticated web edge`. With no cookie: the page answers `200`, `Content-Type: text/html; charset=utf-8`, `Content-Security-Policy: sandbox allow-scripts`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, body the scratch page; its relative `style.css` under the same capability answers `200`, `text/css; charset=utf-8`, body `body { color: green }`; the note answers `200`, `text/markdown; charset=utf-8`, body `qa browser bytes`; its HEAD answers `200` with `Content-Length` and no body; the file artifact answers `200`, `text/plain; charset=utf-8`, body `qa other bytes` (T-987 C1, C3). Proven by `hub/test/web-artifacts.test.ts` "artifact.url mints random web-only URLs serving extension types without cookies" and "folder HTML carries the script-only sandbox and relative assets use its capability" |
| M11 | hub-api | `U1=$(sed -n 1p "$Q/caps.txt"); U2=$(sed -n 2p "$Q/caps.txt"); O=$(basename "$(sed -n 4p "$Q/caps.txt")"); for u in "${U2%/*}/$O" "${U2%/*}/../$O" "${U2%/*}/%2e%2e/$O" "${U2%/*}/%2e%2e%2f$O" "${U2%/*}/%5c..%5c$O" "${U2%/*}/%00" "${U2%/*}//etc/hosts" "${U1%/*}/$O" "${U1%/*}/../../$O" "${U1%/*}/%2e%2e%2f%2e%2e%2fhub.db" "http://127.0.0.1:$(wp)/a/0000000000000000000000000000000000000000000000000000000000000000/$O"; do curl -s --path-as-is -o "$EV/M11.body" -m 5 -w "%{http_code} $u\n" "$u"; grep -c -e "qa other bytes" -e "localhost" "$EV/M11.body"; done \| tee "$EV/M11.txt"` | every request answers `403` or `404`, and every count after it is `0`: another artifact's file under the note's capability, dot-segment, encoded and backslash traversal, a NUL, an absolute path, a file outside the folder under the page's capability and an unknown capability are all refused, and none returns the other artifact's bytes or `/etc/hosts` (T-987 C2). Proven by `hub/test/web-artifacts.test.ts` "capabilities confine files and folders, including encoded traversal and symlinks" (symlink escapes and the moved-file and parent-swap cases are left to that file's other tests) |
| M12 | hub-api | `(QA_HOLD=1 node "$Q/frames.cjs" web < /dev/null > "$EV/M12-hold.txt" 2>&1 &); sleep 2; cland web --sessions \| tee "$EV/M12-before.txt"; cland hub stop; sleep 1; cat "$EV/M12-hold.txt"; cland hub start; echo "WP=$(wp)"; cland web --sessions \| tee "$EV/M12-after.txt"; O="http://127.0.0.1:$(wp)"; curl -s -o /dev/null -m 3 -w 'cookieA-after-restart %{http_code}\n' -H Connection:Upgrade -H Upgrade:websocket -H Sec-WebSocket-Version:13 -H Sec-WebSocket-Key:dGhlIHNhbXBsZSBub25jZQ== -H "Origin: $O" -H "Cookie: $(cat "$Q/cookieA")" "$O/ws"; for u in $(cat "$Q/caps.txt"); do curl -s -o /dev/null -m 5 -w "%{http_code} $u\n" "$u"; done` | before the stop: the `$Q/sidA` row shows `1` socket and a last use later than its creation; the hold capture ends with `holding` then `closed <code>` (the stop closed the socket); `WP` is unchanged from M1; after the restart `--sessions` lists the same id and the same creation time (the session survived in `hub.db`) with `0` sockets; the cookie upgrade prints `cookieA-after-restart 101` (curl then ends on its own `-m` limit, exit 28 is expected); all four capability URLs still answer `200` (T-982 C1, C3; T-987: the capability survives a restart). Proven by `hub/test/web-auth.test.ts` "a persisted cookie opens /ws after two hub starts on one project" and `hub/test/web-artifacts.test.ts` "capabilities survive hub restart and revocation invalidates only the minting session URLs" |
| M13 | hub-api | `cland web --no-open > "$EV/linkB.txt"; curl -si -m 5 "$(cat "$EV/linkB.txt")" \| tr -d '\r' \| sed -n 's/^[Ss]et-[Cc]ookie: \([^;]*\).*/\1/p' > "$Q/cookieB"; printf '{"type":"artifact.url","artifact":"%s"}\n' "$(cat "$Q/noteid")" \| QA_COOKIE="$Q/cookieB" node "$Q/frames.cjs" web > "$EV/M13-mintB.txt"; node "$Q/pick.cjs" "$EV/M13-mintB.txt" value.url > "$Q/capB"; (QA_HOLD=1 node "$Q/frames.cjs" web < /dev/null > "$EV/M13-holdA.txt" 2>&1 &); (QA_HOLD=1 QA_COOKIE="$Q/cookieB" node "$Q/frames.cjs" web < /dev/null > "$EV/M13-holdB.txt" 2>&1 &); sleep 2; cland web --sessions \| tee "$EV/M13-before.txt"; N0=$(grep -c web-session-socket-closed .cland/log/hub.log); cland web --revoke "$(cat "$Q/sidA")"; echo "revoke exit $?"; cat "$EV/M13-holdA.txt" "$EV/M13-holdB.txt"; sleep 1; grep web-session-socket-closed .cland/log/hub.log \| tail -n +$((N0+1)); cat "$EV/M13-holdA.txt" "$EV/M13-holdB.txt"; cland web --sessions \| tee "$EV/M13-after.txt"` | `$Q/capB` holds one capability URL; before: two rows, the `sidA` session and a new one, each with `1` socket; `cland web --revoke` prints `Revoked <sidA>` and exits 0; the hold captures printed right after the CLI returned already show `closed <code>` at the end of `M13-holdA.txt` (allow the second print, one second later, if the client close lagged), while `M13-holdB.txt` ends with `holding` in both prints (the other session stays connected); the log lines written since `N0` are exactly one `web-session-socket-closed` naming `sidA`; after: only the new session, with `1` socket (T-982 C3, C4). Proven by `hub/test/web-auth.test.ts` "cland web lists timestamps and socket counts and revokes only the chosen session within the call" |
| M14 | hub-api | `O="http://127.0.0.1:$(wp)"; UP='-H Connection:Upgrade -H Upgrade:websocket -H Sec-WebSocket-Version:13 -H Sec-WebSocket-Key:dGhlIHNhbXBsZSBub25jZQ=='; curl -s -o /dev/null -m 3 -w 'cookieA %{http_code}\n' $UP -H "Origin: $O" -H "Cookie: $(cat "$Q/cookieA")" "$O/ws"; curl -s -o /dev/null -m 3 -w 'cookieB %{http_code}\n' $UP -H "Origin: $O" -H "Cookie: $(cat "$Q/cookieB")" "$O/ws"; node "$Q/frames.cjs" web < /dev/null; for u in $(cat "$Q/caps.txt") $(cat "$Q/capB"); do curl -s -o /dev/null -m 5 -w "%{http_code} $u\n" "$u"; done; cland web --revoke "$(cat "$Q/sidA")"; echo "second revoke exit $?"; cland web --sessions --revoke x; echo "combined exit $?"; cland hub stop; cland hub start; for u in $(cat "$Q/caps.txt") $(cat "$Q/capB"); do curl -s -o /dev/null -m 5 -w "after-restart %{http_code} $u\n" "$u"; done; curl -s -o /dev/null -m 3 -w 'cookieA after-restart %{http_code}\n' $UP -H "Origin: $O" -H "Cookie: $(cat "$Q/cookieA")" "$O/ws"` | `cookieA 401`; `cookieB 101` (curl then ends on `-m`); the helper with cookie A prints a `qa-error` line `upgrade refused: HTTP 401`; the four capability URLs minted by session A answer `404`, the one minted by session B answers `200`; the second revoke of the same id fails (`second revoke exit 1`); combining `--sessions` and `--revoke` fails with `--no-open, --sessions and --revoke cannot be combined` (`combined exit 1`); after another restart the A capabilities still answer `404`, B's `200`, and cookie A `401`: revocation is durable and kills that session's capabilities only (T-982 C4; T-987 C4). Proven by `hub/test/web-artifacts.test.ts` "capabilities survive hub restart and revocation invalidates only the minting session URLs" and `hub/test/web-artifacts-unit.test.ts` "capability rows persist only digests and cascade away with revoked or expired sessions" |
| M15 | hub-api | from `$W`: `node hub/scripts/measure-snapshot.ts "$W/.cland/tasks" \| tee "$EV/M15.json"; git -C "$W" grep -c "T-983 C5: snapshot measurement" HEAD -- .cland/tasks` | exit 0; the JSON names the platform, `items` (at least the 1,032 the posted figures name), seven `domains` each with `percent` below 100, five `samples` and `framed: {"frameCount": 8}` (seven domain frames and the end marker); the tested tree's E-412 item file holds the posted measurement comment (`…E-412-the-web-edge-and-the-protocol-extension.md:1`). Record the items bytes and compose times beside the posted 571,512 bytes and ~120 ms; a difference is a note, not a failure, unless a domain reaches its cap (T-983 C5) |
| M16 | hub-api | from `$W`: `for s in 'code: "cli-neovim-only"' 'Unknown or unclassified frames are refused' '{type: "snapshot.end", epoch, seq}' 'features: ["snapshot", "numbered-deltas", "slim-frames"]' '**History pages.**' 'cland web --sessions' 'cland web --revoke <id>' '30 days after creation' 'artifact.url {artifact: "A-3"}' 'sandbox allow-scripts'; do printf '%s: ' "$s"; grep -c -F -- "$s" hub/README.md; done` | every count is at least `1`: `hub/README.md` lists the refused frames and the deny-by-default rule (T-981 C5), the feature list, snapshot frames and end marker (T-983 C6), the history pages (T-984 C5), `--sessions`, `--revoke` and the 30-day lifetime (T-982 C6) and the capability URLs (T-987 C5). Read the sections around each hit and record any statement that contradicts M1–M14 as a finding |
| M17 | hub-api | from `$W`, under cover-quiet admission (no cover is running, no other test run by this session): `node --test --test-concurrency=1 hub/test/web-authority-unit.test.ts hub/test/web-authority.test.ts hub/test/connection-snapshot.test.ts hub/test/snapshot-framing.test.ts hub/src/hub/store.test.ts hub/test/topics-component.test.ts hub/test/web-auth-unit.test.ts hub/test/web-auth.test.ts hub/test/web-artifacts-unit.test.ts hub/test/web-artifacts.test.ts \| tee "$EV/M17.txt"` | exit 0; the summary shows `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`. These files carry what the scratch hub cannot show: the per-frame Unix comparisons and the authority table's completeness (T-981 C1, C4: "the web denies absent rows and prototype names, including malformed request ids", "the web refuses any as field on every classified request, even a malformed value"), the raced composition and the size caps (T-983 C3, C4: "an oversized domain refuses the whole snapshot and leaves legacy reads usable", "snapshot refuses <domain> overflow before returning any frames", "a frame exactly at its byte cap is accepted; one extra byte refuses it"), the 30-day expiry on a fake clock (T-982 C5: `web-auth-unit.test.ts` "cookie sessions last thirty days and use a project-specific name"; T-987 C4: "capabilities and minting expire at the cookie session fixed thirty-day boundary") and the symlink confinement (T-987 C2: "moved file and folder capabilities refuse substituted ancestor symlinks", "a parent swap at final open cannot return an outside file") |
| M18 | hub-api | from `$W`, under cover-quiet admission: `C=$(git log --first-parent --format=%H -1 --grep "Item: T-984" dev); git diff --stat "$C^" "$C" -- nvim; echo "nvim diff done"; node --test --test-concurrency=1 nvim/test/thread.test.ts \| tee "$EV/M18.txt"` | the diff prints nothing before `nvim diff done` (T-984 changed no Neovim file); the Neovim thread tests exit 0 with `# fail 0` and `# skipped 0`: the message-id archive reader works unchanged (T-984 C4). They use the pinned Neovim (`nvim/NVIM_VERSION`, or `CLAND_NVIM`); without it they skip, which makes M18 BLOCKED, not PASS |
| M19 | hub-api | from `$W`: `node hub/test/lint-wire-imports.ts; echo "lint exit $?"; npm run typecheck; echo "typecheck exit $?"` | `lint exit 0` (the T0 import guard, which runs its own negative fixtures at load) and `typecheck exit 0` with no diagnostics. The typecheck includes `hub/test/wire-conformance.ts`: `WebAuthorityConformance` fails when a protocol frame has no row in `WEB_AUTHORITY` (T-981 C4), and the wire types of the snapshot frames, `TopicMessage.seq`, the history cursors, `web.sessions`/`web.revoke` and `artifact.url` must match the hub's |

Re-check helper, test and file names with grep at the tested build, renames happen. The guard is a plain script (it is in `npm run test:static`), not a `node --test` file. Test names quoted above with `<type>` or `<domain>` are generated per frame or domain; M17 runs all of them.

## Probes that mislead

- Process probes exclude their own shell: use `pgrep`'s bracket trick or exclude the probe's process tree.
- Never treat `hub status` of the live project as evidence: the scratch hub is the one whose `.cland/hub.json` sits under `$Q/p1`. Confirm `pwd` before each command; `frames.cjs` and `wp` read `.cland/hub.json` from the current directory.
- `curl` removes `../` and `./` segments before sending unless `--path-as-is` is given: a `200` on a traversal URL without it tested a different path. Percent-encoded segments go out as written.
- A curl WebSocket upgrade that succeeds prints `101` and then waits for frames until its `-m` limit (exit 28): the printed code is the evidence, not the exit status.
- `curl` with `-I` sends HEAD, which `/auth` answers `405` without spending the link: spend a link only with GET (M1, M13).
- An accepted `features` list in the welcome alone does not prove a snapshot; the `snapshot.end` line does (README). A `snapshot.refused` line is a failure of M6 here, since the scratch state is tiny.
- Invalid history cursors answer `ok: false` with `unknown request type "topic.history"`: that is the frame validator refusing the cursor, not a missing frame type.
- `node:sqlite` may print an `ExperimentalWarning` on stderr (M2); it is not a failure.
- `SOCKETS` counts open sockets only. Read `--sessions` at least two seconds after a hold starts (the commands sleep 2), and the curl upgrade probes of M12 and M14 close on their own; a stray count of one more right after them is the probe, not a leak.
- `.cland/log/hub.log` is written through an asynchronous append queue, and a client sees its close a few milliseconds after the server: neither is an exact clock for "within the call". M13 reads them right after the CLI returns and again a second later; the ordering itself (server close receipts before the CLI returns) is proven by the named test, which observes the log entries in process.
- `web --sessions`, `web --revoke` and `artifact new --path` refuse a session's shell: the commands must run with the `CLAND_SESSION_*` variables unset, as `env.sh` does. A refusal naming "only the human" means the environment leaked, not a product fault.
- The webPort is kept across restarts (stage 1, T-978): capability URLs in `$Q/caps.txt` stay valid only because of that. A changed `WP` after a restart is a stage 1 regression; record it and mint new URLs before judging T-987.
- Targeted test runs obey cover-quiet admission: if the Coordinator holds a cover slot, wait; `--test-concurrency=1` keeps one test file at a time.
- "No skip": all hub test files of M17 are platform-independent T1/T2 and must run on Linux and macOS (the parent-swap case in `web-artifacts.test.ts` asserts the Linux and macOS outcomes separately); the Neovim thread tests of M18 skip without the pinned Neovim, which is BLOCKED, not PASS.

## Out of scope

The browser itself (no real browser, no GUI), the `/ws` conversation beyond what the helper and the named tests show, deltas, resume, the network and the door (stage 3: T-985, T-986, T-988, T-989), the snapshot's live-data size (M15 measures a tracker copy only), the 30-day expiry on a real clock (fake-clock tests in M17 only), the symlink and parent-swap confinement cases on a live hub (M17 only), `npm run build --workspace web` and the bundle's content, Linux/macOS stage covers (the Coordinator's business, not judged here), and duration budget lines (report-only).

## Grants

none.

## Verdict

Fix nothing. Clear only when every check M1-M19 and S0 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "authority, cookie sessions, snapshot and pages"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-412 stage authority, cookie sessions, snapshot and pages` or `qa not clear E-412 stage authority, cookie sessions, snapshot and pages` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
