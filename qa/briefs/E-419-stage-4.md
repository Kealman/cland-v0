# Stage QA brief: E-419 stage 4 — notifications and the guide

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` or `$B:h` as a modifier, and aborts the sealed subshell's `env` count). The run is local, on macOS (BSD tools; Chrome Headless Shell from the installed `playwright-core`). Binary formats are decoded with Node, never with `od` or `awk`.

## Stage

- Epic: E-419 (The phone and notifications, under R-377).
- Exact stage name: notifications and the guide.
- Items, in plan order: two lanes. Lane 1: T-1175 (Notifications on the phone through a service worker), then T-1176 (The tunnel guide in web/README.md). Lane 2: T-1183 (Web tests pause the page clock at the time it was installed). The run reads the stage's members, counts and state from `task plan show E-419` (E419S4-00 and E419S4-16), never from a number written here. Findings fixes added to this stage after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- **The run starts only once every member is on dev.** At writing T-1175 had landed as `267dfd13` and T-1183 as `d63d7e99`; dev was `b10c9119` (the tracker commit after both landings). T-1176 was in the merge queue at `f7450abf` on `t/T-1176-the-tunnel-guide-in-web-readme-md` (mode-free run A-10243 passed at that head), about to land. E419S4-00 checks every landing through `task plan show E-419` and the first-parent log; a missing landing is BLOCKED, reported to the requester, with nothing else run.
- **Where the expectations come from.** Two kinds, kept apart in every row:
  - **Verified at writing** (T-1175, T-1183, the desktop and the regression files): read at dev `b10c9119`. There `phone-notifications.test.ts` (6 of 6) and `notifications.test.ts` (8 of 8) ran clean in this brief's sealed setup, the T-1183 guard checks of E419S4-06 printed their expected values, and the QA probe's T-1175, T-1183 and desktop facts were observed.
  - **Read on the branch, grep at the build** (T-1176): written from its acceptance criteria and its branch head `f7450abf`. The probe's guide facts were observed at writing against `f7450abf`'s `web/README.md` with `b10c9119`'s hub (the branch changes no hub source). The landing squashes the branch, so its text can still change in a merge round. Every T-1176 name, heading, sentence, test name and count in this brief must be grep-checked at the tested build (E419S4-02 and E419S4-04 print them; the rows say how a changed name is judged).
- Scope: the combined changed behaviour of the three items at the tested build.
  - T-1175, notifications on the phone (§3.6; landed `267dfd13`): `web/public/sw.js` is a notification-only worker served at the root scope with no fetch handler; its `notificationclick` closes the notification and either focuses the first window client and posts `{ type: 'notification-open', target }`, or opens `/?area=<inbox|items>&row=<id>` when no window is open. The web edge (`hub/src/hub/web-edge.ts`) adds `Service-Worker-Allowed: /` for `/sw.js` (served as `text/javascript; charset=utf-8`, `no-cache`, CSP with `worker-src 'self'`). Below 640 px More (`Shell.tsx`, `PhoneNotifications.tsx`/`.module.css`) holds T-1142's **Needs you** and **Finished** switches and the **Subscribe to notifications** button: a tap requests the permission (only while `default`) and registers `/sw.js` with scope `/`, waits for activation and reads **Subscribed**; it creates no Web Push subscription. A denied permission turns both switches off and the button's tooltip reads the shared reason (`notification-state.ts`, new `refreshNotificationPermission`). Delivery (`browser-notifications.ts`): T-1128's rules re-checked after the registration lookup (the reviewer's M1); with an active registration through `showNotification` (title, body, tag, `data` = the row target), otherwise the page `Notification`; a worker message opens the row; a cold `/?area=inbox&row=<id>` entry focuses the row once and restores `/`. Harness: `pageCase(…, { serviceWorkers: 'allow' })`; the default stays `block`. Files also: `web/test/phone-notifications.test.ts`, `hub/test/web-notifications.test.ts` (the VM worker contract), `hub/test/web-edge.test.ts`, `hub/test/web-auth.test.ts`, `web/test/phone.test.ts` (More's button list), `hub/test/tiers.json`, `web/README.md`, `hub/README.md`, `docs/agents/tests.md`, `.agents/skills/implement/SKILL.md` and `CHANGES`.
  - T-1183, the paused page clock (landed `d63d7e99`): `pausePageClock(page, time)` in `web/test/harness.ts` installs the page clock one minute before `time` and pauses at `time`; 18 install-then-pause pairs at the same time across 8 Web files (`accounts`, `asks`, `composer`, `events`, `inbox`, `notifications`, `phone-disconnected`, `verification`) moved to it; the T0 guard `hub/test/lint-web-workspace.ts` (run by `npm run test:static`) parses every `web/test/**/*.test.ts` and refuses a raw same-time pair, with planted controls. Docs: `web/README.md` and `docs/agents/tests.md` (`### Paused page clocks`).
  - T-1176, the tunnel guide (read on the branch at `f7450abf`): `web/README.md` gains `## HTTPS on your phone` (why plain HTTP on the LAN gets no worker, notifications or install), `### Tailscale Serve` (one `toml` snippet `[web]` with `bind = "127.0.0.1"` and an HTTPS `origin`, the hub restart, `tailscale serve --bg http://127.0.0.1:<port>`, `cland web --qr`, any HTTPS reverse proxy of the human's own but never a cloud service) and `### Install and enable notifications` (Android and iOS Home Screen, iOS cookies apart from Safari, More's button and switches, the badge, no push with the page closed in 0.2.0). `hub/test/web-tunnel-guide.test.ts` (T2) starts a sealed hub with that literal snippet, runs `cland web --qr`, and redeems the link on loopback with the guide's Host and Origin. Files also: `hub/test/tiers.json`, `docs/agents/tests.md` (`### HTTPS tunnel guide contract`).
- Affected regression: the desktop notifications (`notifications.test.ts`, the Profile switches in Accounts); the earlier phone files (`phone`, `phone-more`, `phone-inbox`, `phone-asks`, `phone-approvals`, `phone-thread`, `phone-composer`, `phone-install`, `phone-sessions`); the 8 Web files T-1183 migrated; the web edge and sign-in (`web-edge.test.ts`, `web-auth.test.ts`); the typecheck with colour, contrast, HTML and hooks guards; the static guards (`npm run test:static`); the tier classifications.

Read membership, counts and other plan facts from `task plan show` at the run; retain its output instead of writing numeric stage totals here (A-9063 R3; E-413 stage 1/T-1093).

Criteria map (the stage verdict carries no item or epic marks; this tells the run which check proves what):

| criterion | proven by |
| --- | --- |
| T-1175 C1 (390×844: More holds the two switches and the button; a tap requests the permission and registers the worker without a push subscription) | E419S4-07, E419S4-15 (`moreBefore`, `subscribe`, `switchOn`), E419S4-02 |
| T-1175 C2 (worker registered, `showNotification` stubbed: a new ask while hidden raises one notification through the worker naming the session, the item and the question) | E419S4-07, E419S4-15 (`hiddenAsk`, `lookingAsk`) |
| T-1175 C3 (a waiting plan and a fake Claude Code approval each raise one notification through the worker) | E419S4-07 |
| T-1175 C4 (no fetch handler; the click focuses an open client and sends it the row, or opens the app at the row) | E419S4-08, E419S4-15 (`workerServed`, `messageOpen`, `coldEntry`), E419S4-02 |
| T-1175 C5 (a denied permission turns both switches off; the button's tooltip says why) | E419S4-07, E419S4-15 (`denied`) |
| T-1183 C1 (no raw same-time install/pauseAt pair; all use the helper; a guard fails on a new raw pair) | E419S4-06, E419S4-02, E419S4-12, E419S4-15 (`pausedClock`) |
| T-1183 C2 (`phone-disconnected.test.ts` passes 10 of 10 at two workers on macOS with two CPU loaders) | E419S4-13, E419S4-12 (12g) |
| T-1176 C1 (the README walks from Tailscale Serve with the hub on loopback, through `[web] origin` and `cland web --qr`, to installing and turning notifications on in More) | E419S4-04 |
| T-1176 C2 (plain HTTP on the LAN: no install or notification; iOS keeps the installed app's cookies apart; any HTTPS reverse proxy of one's own, never a cloud service) | E419S4-04 |
| T-1176 C3 (a hub started with the guide's `[web]` snippet accepts that origin on Host and Origin; `cland web --qr` prints a link on it) | E419S4-09, E419S4-15 (`guideSnippet`, `guideHub`, `guideQr`, `guideEdge`) |
| Desktop notifications regression | E419S4-10, E419S4-15 (`desktop`) |
| Earlier phone files regression | E419S4-11 |
| The 8 Web files T-1183 migrated | E419S4-12 (with E419S4-10 for `notifications.test.ts`) |
| The T-1183 guard (raw same-time pairs count 0) | E419S4-06 |

Not mapped to a check: the app badge's needs-you count named in the guide (T-1162's, regression in `phone-install.test.ts`, E419S4-11, not re-judged); the `.agents/skills/implement/` pointer and `CHANGES` line T-1175 added (provenance, checked by the static skill-provenance guard in E419S4-14). Definition-of-done pointer (no marks): E-419's notification and guide sentences (§3.6, §3.7) are exercised by E419S4-04, E419S4-07 to E419S4-09 and E419S4-15; a real notification, real installability and the full Chromium build are the epic demo's job (`qa/briefs/E-419.md`).

## Build

Use a clean detached worktree at dev at the SHA in the request (the full 40-hex SHA), created below. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev: for every member that `task plan show E-419` lists in stage `notifications and the guide`, `git log --first-parent --oneline --grep "Item: <id>" dev` prints exactly one commit. At writing T-1175 had landed as `267dfd13` and T-1183 as `d63d7e99`; T-1176 had not (see "Stage"). Dev may also carry work landed after these items that is outside this stage; it is not judged here beyond the regression files named. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id of its own on purpose: committing a brief changes the tested tree.

In this repository, give the detached worktree a `node_modules` symlink to the project's installed dependencies before any other step (the setup below does; the clean-tree checks ignore that one entry). Run E419S4-01's build before any Web file or the probe, or the shell never renders and `/sw.js` is not served. The browser is the suite's Chrome Headless Shell under `node_modules/playwright-core/.local-browsers`: each named Web test file and the QA probe start and close their own through the Web harness (`web/test/harness.ts`, `webFixture`); every phone check uses the harness's phone context (`pageCase(…, { phone: true, serviceWorkers: 'allow' })`: 390×844, `hasTouch`, `isMobile`, service workers allowed only where the row says). No real browser, phone or other GUI process starts, and no real notification is shown: the permission, `showNotification` and `PushManager.subscribe` are stubbed before navigation; the worker's registration and activation are real. The live hub is touched only by `quiet`, the Web harness's own read-only admission check and the plan reads of E419S4-00 and E419S4-16. Every session, ask, plan, approval and sign-in comes from sealed scratch hubs started from `$W`'s own source, with fake adapters, an in-process fake spoke and frame clients as senders, never a real session, account, provider binary or tunnel (see "Out of scope").

**The local test slot (cover-quiet).** No test may run while another session holds the live hub's local verify slot. The Coordinator's macOS stage cover for this stage (`verify all --occasion stage`, local) holds that slot for about 20 minutes, and it may still be running when this run starts. A wait for it is not BLOCKED: run the checks that need no slot first (E419S4-00 to E419S4-06: reads, greps, docs, the brief lint, the bundle build and the T0 guard), then wait for the slot with `quiet` (it waits up to 45 minutes and prints the holder every 5 minutes) before E419S4-07. Only a slot still held after those 45 minutes with no change of holder is BLOCKED, reported to the requester with the holder line. E419S4-13 adds CPU load: it starts only when the slot is free **and** nobody waits for it (`none waiters 0`).

## Setup (once, before E419S4-00)

Two shells, never mixed. **QA's own shell** keeps QA's session identity: it creates the worktree, runs `quiet`, the plan reads, reads the captures and records every check with `qa-record.sh`. **Every other command runs sealed** (rule 15) inside a subshell that sources `$Q/env.sh`: the full `fixtureEnvironment` result (`test-support/fixture-environment.ts`) after the scratch overlays (its synthesized HOME, XDG, Git, account and fake-harness paths included), which drops every `CLAND_*`, `GIT_*`, `XDG_*`, `CLAUDE_*`, `CODEX_*`, `FAKE_*`, provider and account variable while keeping `PATH`, `SHELL`, `TERM` and `TMPDIR`. Leave `TMPDIR` at the system default (on macOS `/var/folders/...`; never `/tmp`, T-1030). Never use `env -i`. The scratch root lives under `/private/tmp/qa-e419s4-` (its realpath). Never the live project's hub for anything but the reads named above and `quiet`; never the human's HOME, `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`. Fixtures are fake only: the Web harness's sealed scratch projects and hubs, seeded scratch items, a fake Coordinator spoke asking, the fake Claude Code adapter's approval, the stubbed permission and notification calls, and the guide's scratch hub with stub `open`/`xdg-open` openers; no real session, account, provider binary, tunnel or Tailscale process.

In QA's own shell:

```sh
R=/Users/evgeniyivanov/Projects/cland/v0       # the project root
S=<the full dev SHA from the request>
STAGE="notifications and the guide"
RUN=qa-s4-$(date +%F)-1                        # unique run id for E-419; bump the suffix on a rerun
W=$R/.cland/worktrees/qa-e419s4-$RUN           # the clean detached build
EV=$R/.cland/qa/E-419/$RUN                     # captures (qa-record.sh keeps its evidence here too)
git -C "$R" worktree add --detach "$W" "$S"
[ -e "$W/node_modules" ] || ln -s "$R/node_modules" "$W/node_modules"
mkdir -p "$EV"
Q=$(cd "$(mktemp -d /tmp/qa-e419s4-XXXXXX)" && pwd -P)   # scratch root, its realpath: /private/tmp/qa-e419s4-…
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/xdg/cache"
holder() { (cd "$W" && node hub/bin/cland.ts verify queue --json) | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);const h=v.holder;console.log(h?`${h.session??h.kind} ${h.occasion??"-"} ${h.executor??"-"} since ${h.since??"-"} waiters ${(v.waiters??[]).length}`:"none waiters "+(v.waiters??[]).length)})'; }
# quiet: wait (up to 45 minutes, a line every 5) until no session holds the local verify slot; a stage cover holds it ~20 minutes
quiet() { for i in $(seq 1 45); do h=$(holder) && case "$h" in "none "*) echo quiet; return 0;; esac; [ $((i % 5)) -eq 1 ] && echo "waiting for the local slot ($i min): $h"; sleep 60; done; echo "BLOCKED: the local verify slot is still held after 45 minutes: ${h:-queue read failed}"; return 1; }
# nt <id> <test files or node --test flags…>: named tests from $W, sealed, one file at a time, TAP output, after quiet; the log is $EV/<id>.log
nt() { id=$1; shift; quiet || return 1; ( . "$Q/env.sh"; cd "$W" && node --test --test-concurrency=1 --test-reporter=tap "$@" > "$EV/$id.log" 2>&1; echo "exit $?" >> "$EV/$id.log" ); tail -n 1 "$EV/$id.log"; grep -E '^# (tests|pass|fail|cancelled|skipped|todo) ' "$EV/$id.log"; grep -E '^ *not ok|# SKIP' "$EV/$id.log" | head -20; }
# oks <id>: the names on the passing (sub)test lines of $EV/<id>.log
oks() { grep -E '^ *ok [0-9]+ - ' "$EV/$1.log" | sed -E 's/^ *ok [0-9]+ - //'; }
# census <id>: the number of Web fixture census lines, then how many of them do not end cleanly
census() { grep -c -F 'Web fixture census' "$EV/$1.log"; grep -F 'Web fixture census' "$EV/$1.log" | grep -c -v 'after 0; scratch hub stopped'; }
# landed <id>: the full SHA of the commit that landed the item on dev (empty when it has not landed)
landed() { git -C "$W" log --first-parent --format=%H --grep "Item: $1" dev; }
# names <file>: the test and subtest names declared in a test file at the build
names() { grep -o -E "(^|[^.a-zA-Z])(test|t\.test)\((['\"\`])[^'\"\`]+" "$W/$1" | sed -E "s/^.*(test|t\.test)\(['\"\`]//"; }
```

The sealed environment. Apply the full `fixtureEnvironment` result after the scratch overlays; do not merely unset keys absent from it. Remove the broader credential prefixes last (including `GH_PAGER` and the fixture's synthetic `CLAND_EXECUTOR_STATE`). The generated shell first unsets dropped inherited names and then exports every retained value; never print or post those exports.

```sh
node --input-type=module - "$W/test-support/fixture-environment.ts" "$Q" "$W" > "$Q/env.sh" <<'JS'
const [m,root,worktree]=process.argv.slice(2);
const {fixtureEnvironment}=await import(m);
const env=fixtureEnvironment(root,process.env,{
  XDG_CONFIG_HOME: `${root}/xdg/config`, XDG_STATE_HOME: `${root}/xdg/state`,
  XDG_DATA_HOME: `${root}/xdg/data`, XDG_CACHE_HOME: `${root}/xdg/cache`,
  GIT_AUTHOR_NAME: 'qa', GIT_AUTHOR_EMAIL: 'qa@example.invalid',
  GIT_COMMITTER_NAME: 'qa', GIT_COMMITTER_EMAIL: 'qa@example.invalid',
  QA_W: worktree, QA_Q: root,
});
for(const k of Object.keys(env))if(/^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)/.test(k))delete env[k];
const quote=value=>"'"+value.replaceAll("'", "'\\''")+"'";
for(const k of Object.keys(process.env).sort())if(!(k in env)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`unset ${k}`);
for(const [k,v] of Object.entries(env))if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))console.log(`export ${k}=${quote(v)}`);
JS
cat >> "$Q/env.sh" <<'ENV'
cland() { node "$QA_W/hub/bin/cland.ts" "$@"; }
ENV
: > "$Q/home/.gitconfig"
grep -c '^unset ' "$Q/env.sh"; ( . "$Q/env.sh"; prefix_count=$(env | cut -d= -f1 | grep -c -E '^(CLAND_|DIGITALOCEAN_|ANTHROPIC_|OPENAI_|GH_|GITHUB_)'); echo "$prefix_count"; test "$prefix_count" -eq 0 ) || exit 1   # confirm 0 before any scratch process starts
```

The QA probe. `$Q/probe.test.mjs` is a two-test `node --test` file, independent of the items' own tests. **"phone notifications"**: one sealed scratch project and hub through the Web harness (`webFixture` with seeded scratch items `R-900400` and `T-900401`, a topic on `T-900401`, the production socket and web edge serving `$W/web/dist`), a fake Coordinator spoke `coord` as the sender, and three contexts, in order:
- **A** (phone, workers allowed, permission answers `granted`; T-1175 C1, C2, C4): `moreBefore` (More's buttons with their heights, the switches, the button's tooltip, no registration, no stub call, a secure context), `subscribe` (the tap; the label, the registration's scope, script, state and push subscription; the stub counters), `workerServed` (`fetch('/sw.js')` from the page: status and headers, the listeners the served script registers, equality with `web/public/sw.js`, any `fetch` or `caches` word outside comments), `switchOn` (Needs you on), `hiddenAsk` (with the page hidden and unfocused, `coord` asks `QA phone notice?` in the item topic; the worker notifications received after 1.5 s more), `messageOpen` (a `notification-open` message on `navigator.serviceWorker`, the shape the worker posts: the row focused in Inbox), `lookingAsk` (visible and focused: a second ask notifies nothing), `coldEntry` (`/?area=inbox&row=<ask>`: the row focused and the URL restored to `/`).
- **B** (phone, workers allowed, permission answers `denied`, both switches saved on; T-1175 C5): `denied` (switches before and after the tap, the tooltip, the label, the saved preference, no registration, one permission request across two taps, no push call).
- **C** (desktop 1440, workers blocked as by default): `desktop` (Accounts' Profile switches, no subscription button, no More), `pausedClock` (T-1183's `pausePageClock` at 12:00:00Z: `Date.now()` is exactly the target after one real second, and 1000 ms later after `runFor(1000)`).

**"tunnel guide"** (T-1176 C3): reads the first `toml` block of `web/README.md`'s `## HTTPS on your phone` section at the build, writes it as a sealed scratch project's `.cland/config.toml`, starts a `projectHub` there with stub `open` and `xdg-open` first on `PATH`, and records `guideSnippet`, `guideHub` (`hub.status`'s web listener), `guideQr` (`cland web --qr` against that scratch hub: the printed link's origin, path and token, the QR decoded with the harness's `decodeTerminalQr`, no opener run) and `guideEdge` (loopback requests carrying the guide's Host and Origin: a wrong Host, the page, `/sw.js`, the sign-in redirect and its `Secure` cookie, a WebSocket hello with the right Origin, a wrong Origin and an `http:` Origin). It contacts only the scratch edge's loopback port.

It asserts nothing about the product: every fact goes to `$QA_OUT` as one JSON line; a step that throws writes `{"step":{name,error}}` and the probe goes on. The Web fixture's own cleanup writes the census line (the guide test has none: it starts no browser). The `QA_README` variable exists only for writing time (the guide read from the branch before T-1176 landed); the run leaves it unset, so the guide is read from `$W/web/README.md` at the build. **T-1176's facts were read on its branch**: if the guide's heading or snippet changed at landing, E419S4-02/E419S4-04 show it; correct only the probe's section split in `$Q/probe.test.mjs`, keep the uncorrected capture and its log, label the correction in the record, and rerun the probe once; a probe correction is not a product finding.

```sh
cat > "$Q/probe.test.mjs" <<'JS'
// QA probe for E-419 stage 4 (node --test, sealed, cwd $QA_W): two tests. "phone notifications" runs one sealed scratch
// hub through the Web harness, phone contexts (390x844, touch, mobile flag) that allow service workers, with a stubbed
// permission, showNotification and PushManager.subscribe, and a desktop context; "tunnel guide" starts a sealed scratch
// hub from web/README.md's [web] snippet. It asserts nothing about the product: every fact goes to $QA_OUT as one JSON
// line {"fact": value}; a step that throws writes {"step": {name, error}} and the probe goes on.
import test from 'node:test';
import { appendFileSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const W = process.env.QA_W, OUT = process.env.QA_OUT;
const { webFixture, pausePageClock } = await import(`${W}/web/test/harness.ts`);
const { seedItem } = await import(`${W}/web/test/items-fixture.ts`);
const { connectUi, inProcessSpoke, projectHub, tempProject, clandWithEnv } = await import(`${W}/hub/test/harness.ts`);
const { askHubFrame } = await import(`${W}/hub/src/cli/socket-client.ts`);
const { decodeTerminalQr } = await import(`${W}/hub/test/qr-decode.ts`);
const { WebSocket } = createRequire(`${W}/package.json`)('ws');
const out = (key, value) => appendFileSync(OUT, `${JSON.stringify({ [key]: value })}\n`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function step(name, body) { try { await body(); } catch (error) { out('step', { name, error: String(error?.message ?? error).slice(0, 400) }); } }
async function poll(read, done, ms = 5000) { let value = await read(); for (let i = 0; i < ms / 100 && !done(value); i++) { await sleep(100); value = await read(); } return value; }
const box = async locator => { if (!(await locator.count())) return null; const b = await locator.first().boundingBox(); return b && { height: Math.round(b.height * 10) / 10, left: Math.round(b.left ?? b.x), right: Math.round(b.x + b.width) }; };
const PHONE = { phone: true, serviceWorkers: 'allow' };
// Stubs installed before navigation: hidden and unfocused unless qa.looking says otherwise; counters for every call.
const stub = answer => async page => page.addInitScript(answer => {
  const qa = globalThis.qa = { looking: false, requests: 0, push: 0, page: 0, notices: [] };
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => qa.looking ? 'visible' : 'hidden' });
  document.hasFocus = () => qa.looking;
  class QaNotification { constructor() { qa.page++; } static permission = 'default'; static async requestPermission() { qa.requests++; QaNotification.permission = answer; return answer; } }
  Object.defineProperty(globalThis, 'Notification', { configurable: true, value: QaNotification });
  ServiceWorkerRegistration.prototype.showNotification = async function (title, options) { qa.notices.push({ title, body: options?.body, tag: options?.tag, data: options?.data }); };
  PushManager.prototype.subscribe = async () => { qa.push++; throw new Error('QA: no push'); };
}, answer);
const qa = page => page.evaluate(() => ({ requests: globalThis.qa.requests, push: globalThis.qa.push, page: globalThis.qa.page, notices: globalThis.qa.notices }));
const more = page => page.getByRole('navigation', { name: 'More areas', exact: true });
const subscribe = page => more(page).getByRole('button', { name: 'Subscribe to notifications', exact: true });
async function openMore(page) { if (!(await more(page).count())) await page.getByRole('button', { name: 'More', exact: true }).tap(); await more(page).waitFor(); }
const switches = page => more(page).getByRole('switch').evaluateAll(nodes => nodes.map(n => ({ name: n.getAttribute('aria-label'), checked: n.getAttribute('aria-checked'), height: Math.round(n.getBoundingClientRect().height) })));

test('E-419 stage 4 QA probe: phone notifications', { timeout: 300000 }, async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900400', 'release', 'QA release', { version: '99.4.0' });
    await seedItem(root, 'T-900401', 'task', 'QA phone task', { parent: 'R-900400' });
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'topic.create', title: 'QA phone topic', item: 'T-900401' });
  const topic = made.value?.topic?.id;
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'qa-e419s4-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  out('seeded', { topic: made.ok === true && !!topic });
  let askId = null;
  // Context A (phone, permission granted; T-1175 C1, C2, C4).
  await fixture.pageCase(t, async page => {
    await step('moreBefore', async () => {
      await openMore(page);
      const buttons = await more(page).locator('button').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, height: Math.round(n.getBoundingClientRect().height), right: Math.round(n.getBoundingClientRect().right) })));
      out('moreBefore', { buttons, switches: await switches(page), title: await subscribe(page).getAttribute('title'),
        registration: await page.evaluate(async () => !!await navigator.serviceWorker.getRegistration('/')), stubs: await qa(page), secure: await page.evaluate(() => isSecureContext) });
    });
    await step('subscribe', async () => {
      await subscribe(page).tap();
      const label = await poll(() => subscribe(page).textContent(), v => v === 'Subscribed');
      const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('/'); return r && { scope: r.scope, script: r.active?.scriptURL ?? null, state: r.active?.state ?? null, subscription: await r.pushManager.getSubscription().then(s => !!s) }; });
      const origin = new URL(page.url()).origin;
      out('subscribe', { label, reg, expectScope: `${origin}/`, expectScript: `${origin}/sw.js`, stubs: await qa(page) });
    });
    await step('workerServed', async () => {
      const served = await page.evaluate(async () => { const r = await fetch('/sw.js', { cache: 'no-store' }); const text = await r.text();
        return { status: r.status, type: r.headers.get('content-type'), allowed: r.headers.get('service-worker-allowed'), cache: r.headers.get('cache-control'), csp: r.headers.get('content-security-policy'), listeners: [...text.matchAll(/addEventListener\(\s*['"]([a-z]+)['"]/g)].map(m => m[1]), text }; });
      const source = await readFile(`${W}/web/public/sw.js`, 'utf8');
      out('workerServed', { ...served, text: undefined, sameAsSource: served.text === source, workerSrc: /worker-src 'self'/.test(served.csp ?? ''), fetchWord: /\bfetch\b/.test(served.text.replace(/^\/\/.*$/gm, '')), caches: /\bcaches\b/.test(served.text) });
    });
    await step('switchOn', async () => {
      await openMore(page);
      await more(page).getByRole('switch', { name: 'Needs you', exact: true }).tap();
      await more(page).getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
      out('switchOn', { switches: await switches(page), stubs: await qa(page) });
    });
    await step('hiddenAsk', async () => {
      await page.getByRole('navigation', { name: 'Phone areas', exact: true }).getByRole('button', { name: 'Topics', exact: true }).tap();
      const asked = await coord.call('ask', { topic, question: 'QA phone notice?', free: true });
      askId = asked.ask;
      await poll(() => qa(page), v => v.notices.length > 0);
      await sleep(1500);
      out('hiddenAsk', { ask: asked.ok === true, askId, stubs: await qa(page) });
    });
    await step('messageOpen', async () => {
      await page.evaluate(target => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'notification-open', target } })), { area: 'Inbox', id: askId });
      const row = page.locator(`[data-area-module="Inbox"] [data-object-id="${askId}"]`);
      const focused = await poll(() => row.count().then(n => n === 1 && row.evaluate(node => node === document.activeElement)), v => v === true);
      out('messageOpen', { focused, area: await page.locator('main').getAttribute('aria-label'), more: await more(page).count() });
    });
    await step('lookingAsk', async () => {
      await page.evaluate(() => { globalThis.qa.looking = true; });
      const asked = await coord.call('ask', { topic, question: 'QA looking ask?', free: true });
      await sleep(1500);
      out('lookingAsk', { ask: asked.ok === true, stubs: await qa(page) });
    });
    await step('coldEntry', async () => {
      await page.goto(new URL(`/?area=inbox&row=${encodeURIComponent(askId)}`, page.url()).href);
      const row = page.locator(`[data-area-module="Inbox"] [data-object-id="${askId}"]`);
      const focused = await poll(() => row.count().then(n => n === 1 && row.evaluate(node => node === document.activeElement)), v => v === true);
      out('coldEntry', { focused, url: await poll(() => page.evaluate(() => location.pathname + location.search), v => v === '/'), area: await page.locator('main').getAttribute('aria-label') });
    });
  }, stub('granted'), PHONE);
  // Context B (phone, permission denied, both switches saved on; T-1175 C5).
  await fixture.pageCase(t, async page => {
    await step('denied', async () => {
      await openMore(page);
      const before = await switches(page);
      await subscribe(page).tap();
      await more(page).getByRole('switch', { name: 'Needs you', checked: false }).waitFor();
      const first = await qa(page);
      await subscribe(page).tap();
      await sleep(300);
      out('denied', { before, after: await switches(page), title: await subscribe(page).getAttribute('title'), label: await subscribe(page).textContent(),
        saved: await page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.notifications.v1') ?? 'null')), registration: await page.evaluate(async () => !!await navigator.serviceWorker.getRegistration('/')),
        requestsFirst: first.requests, requestsSecond: (await qa(page)).requests, push: (await qa(page)).push });
    });
  }, async page => { await stub('denied')(page); await page.addInitScript(() => localStorage.setItem('cland.ui.notifications.v1', JSON.stringify({ needsYou: true, finished: true }))); }, PHONE);
  // Context C (desktop 1440, workers blocked as by default): the Profile switches stay; no phone controls; the pausePageClock helper.
  await fixture.pageCase(t, async page => {
    await step('desktop', async () => {
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      const profile = page.getByRole('region', { name: 'Profile', exact: true });
      await profile.waitFor();
      out('desktop', { profileSwitches: await profile.getByRole('switch').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label'))),
        subscribe: await page.getByRole('button', { name: 'Subscribe to notifications', exact: true }).count(), more: await page.getByRole('button', { name: 'More', exact: true }).count() });
    });
    await step('pausedClock', async () => {
      const target = new Date('2026-10-23T12:00:00Z');
      await pausePageClock(page, target);
      await sleep(1000);
      const now = await page.evaluate(() => Date.now());
      await page.clock.runFor(1000);
      out('pausedClock', { atTarget: now === target.getTime(), afterRun: (await page.evaluate(() => Date.now())) - target.getTime() });
    });
  });
});

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers, agent: false }, res => { let body = ''; res.on('data', d => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); res.on('error', reject); });
    req.setTimeout(3000, () => req.destroy(new Error('QA HTTP timeout'))); req.on('error', reject); req.end();
  });
}
function socket(url, headers) {
  return new Promise(resolve => {
    const ws = new WebSocket(url, { headers });
    const done = value => { ws.terminate(); resolve(value); };
    ws.once('unexpected-response', (_req, res) => done({ refused: res.statusCode }));
    ws.once('error', error => done({ error: String(error.message).slice(0, 120) }));
    ws.once('open', () => { ws.once('message', data => { try { const f = JSON.parse(String(data)); done({ type: f.type, name: f.name ?? null }); } catch { done({ raw: String(data).slice(0, 80) }); } }); ws.send(JSON.stringify({ type: 'hello', protocol: 2, client: 'web' })); });
    setTimeout(() => done({ timeout: true }), 4000);
  });
}

test('E-419 stage 4 QA probe: tunnel guide', { timeout: 120000 }, async t => {
  const readme = await readFile(process.env.QA_README ?? `${W}/web/README.md`, 'utf8');   // QA_README: writing-time only
  const section = readme.split('\n## HTTPS on your phone\n')[1]?.split('\n## ')[0] ?? '';
  const blocks = [...section.matchAll(/```toml\n([\s\S]*?)```/g)].map(m => m[1]);
  const snippet = blocks[0] ?? '';
  const origin = snippet.match(/^origin = "([^"]+)"$/m)?.[1] ?? null;
  out('guideSnippet', { section: section.length > 0, tomlBlocks: blocks.length, snippet, bind: snippet.match(/^bind = "([^"]+)"$/m)?.[1] ?? null, origin });
  if (!origin) return;
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), snippet);
  const bin = join(root, 'qa-openers');
  await mkdir(bin);
  for (const name of ['open', 'xdg-open']) { await writeFile(join(bin, name), '#!/bin/sh\nprintf opened > "$QA_OPENED"\n'); await chmod(join(bin, name), 0o700); }
  const hub = await projectHub(t, root);
  const host = new URL(origin).host;
  let local = null, link = null;
  await step('guideHub', async () => {
    const status = await askHubFrame(hub.discovery, { type: 'hub.status' }, 3000, {});
    local = `http://127.0.0.1:${status.web?.port}`;
    out('guideHub', { available: status.web?.available ?? null, bind: status.web?.bind ?? null });
  });
  await step('guideQr', async () => {
    const result = await clandWithEnv(root, { PATH: `${bin}:${process.env.PATH ?? ''}`, QA_OPENED: join(root, 'opened') }, 'web', '--qr');
    const [first, ...qr] = result.stdout.trimEnd().split('\n');
    link = first;
    const printed = new URL(first);
    out('guideQr', { code: result.code, origin: printed.origin, path: printed.pathname, token: /^\?token=[a-f0-9]{64}$/.test(printed.search), qr: decodeTerminalQr(qr.join('\n')) === first,
      opened: await readFile(join(root, 'opened'), 'utf8').then(() => true, () => false) });
  });
  await step('guideEdge', async () => {
    const printed = new URL(link);
    const wrongHost = await get(`${local}/`, { Host: 'qa-wrong.example' });
    const page = await get(`${local}/`, { Host: host });
    const worker = await get(`${local}/sw.js`, { Host: host });
    const auth = await get(`${local}${printed.pathname}${printed.search}`, { Host: host, Origin: origin });
    const cookie = auth.headers['set-cookie']?.[0] ?? '';
    const pair = cookie.split(';')[0];
    const ws = `${local.replace('http:', 'ws:')}/ws`;
    out('guideEdge', { wrongHost: wrongHost.status, page: page.status, worker: { status: worker.status, type: worker.headers['content-type'], allowed: worker.headers['service-worker-allowed'] ?? null },
      auth: auth.status, secure: /; Secure$/.test(cookie),
      wsGood: await socket(ws, { Host: host, Origin: origin, Cookie: pair }),
      wsWrongOrigin: await socket(ws, { Host: host, Origin: 'https://qa-wrong.example', Cookie: pair }),
      wsHttpOrigin: await socket(ws, { Host: host, Origin: `http://${host}`, Cookie: pair }) });
  });
});
JS
node --check "$Q/probe.test.mjs" && echo "probe parses"
```

The check functions. Define them in QA's own shell (paste the block once). Each runs where its table row says, writes its captures under `$EV` and prints the facts the `expected` column judges.

```sh
k00() {   # QA shell: build, merges, plan, the stage's files, paths outside web/ and docs/, sealing
  git -C "$W" rev-parse HEAD refs/heads/dev
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  readlink "$W/node_modules"
  (cd "$W" && node hub/bin/cland.ts task plan show E-419 --json) > "$EV/E419S4-00-plan.json"
  node -e 'const [f,n]=process.argv.slice(1);const v=JSON.parse(require("fs").readFileSync(f,"utf8"));const s=v.stages.find(x=>x.name===n);console.log(JSON.stringify({stages: v.stages.map(x=>x.name), state: s.state, qa: s.qa, merged: s.merged, total: s.total, items: s.items}))' "$EV/E419S4-00-plan.json" "$STAGE" | tee "$EV/E419S4-00-stage.txt"
  for i in $(node -e 'const [f,n]=process.argv.slice(1);console.log(JSON.parse(require("fs").readFileSync(f,"utf8")).stages.find(x=>x.name===n).items.join(" "))' "$EV/E419S4-00-plan.json" "$STAGE"); do echo "== $i"; git -C "$W" log --first-parent --oneline --grep "Item: $i" dev; done
  ls "$W/web/public/sw.js" "$W/web/src/PhoneNotifications.tsx" "$W/web/src/PhoneNotifications.module.css" "$W/web/test/phone-notifications.test.ts" "$W/hub/test/web-notifications.test.ts" "$W/hub/test/lint-web-workspace.ts" "$W/hub/test/web-tunnel-guide.test.ts" "$W/web/test/harness.ts"
  for i in T-1175 T-1183 T-1176; do c=$(landed "$i"); echo "== $i paths outside web/ and docs/"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c" | grep -v -E '^(web/|docs/)'; done
  for i in T-1175 T-1183 T-1176; do c=$(landed "$i"); echo "== $i files"; [ -n "$c" ] && git -C "$W" show --format= --name-only "$c"; done
  echo "TMPDIR=$TMPDIR Q=$Q"
}
k02() {   # QA shell: the worker, More, delivery and the edge (T-1175), the clock helper and guard (T-1183), the guide test (T-1176), the probe's selectors and test names
  c() { printf '%s %s: %s\n' "$(cat "$W/$1" 2>/dev/null | grep -c -F -- "$2")" "$1" "$2"; }   # 0 also when the file is missing
  echo "-- verified at writing (T-1175 at b10c9119)"
  c web/public/sw.js "self.addEventListener('notificationclick', event => {"
  c web/public/sw.js "windows[0].postMessage({ type: 'notification-open', target });"
  c web/public/sw.js "url.searchParams.set('row', target.id);"
  c web/public/sw.js "await self.clients.openWindow(url.href);"
  c hub/src/hub/web-edge.ts "if (path === '/sw.js') res.setHeader('Service-Worker-Allowed', '/');"
  c web/src/PhoneNotifications.tsx "Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission"
  c web/src/PhoneNotifications.tsx "await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });"
  c web/src/PhoneNotifications.tsx 'aria-label="Subscribe to notifications"'
  c web/src/PhoneNotifications.tsx "([['needsYou', 'Needs you'], ['finished', 'Finished']] as const)"
  c web/src/browser-notifications.ts "const registration = await navigator.serviceWorker?.getRegistration('/').catch(() => undefined);"
  c web/src/browser-notifications.ts "await registration.showNotification(notice.title, { body: notice.body, tag: notice.tag, data: notice.target });"
  c web/src/notification-state.ts 'export function refreshNotificationPermission() {'
  c web/src/notification-state.ts "'Notifications are blocked in this browser; allow them in site settings'"
  c web/src/Shell.tsx '<PhoneNotifications />'
  c web/src/Shell.tsx "return id && (area === 'inbox' || area === 'items') ? { area: area === 'inbox' ? 'Inbox' : 'Items', id } : undefined;"
  c web/test/harness.ts "serviceWorkers: device.serviceWorkers ?? 'block'"
  echo "-- must print 0 (no fetch, push, install or activate listener in the worker; no push subscription in the page)"
  printf '%s web/public/sw.js: other listeners\n' "$(grep -c -E "addEventListener\(\s*['\"](fetch|push|install|activate|message)" "$W/web/public/sw.js")"
  printf '%s web/src: pushManager\n' "$(git -C "$W" grep -c -F 'pushManager' -- web/src | awk -F: '{n+=$2} END {print n+0}')"
  echo "-- verified at writing (T-1183 at b10c9119)"
  c web/test/harness.ts 'export async function pausePageClock(page: Page, time: Date): Promise<void> {'
  c web/test/harness.ts 'await page.clock.install({ time: new Date(time.getTime() - 60_000) });'
  c hub/test/lint-web-workspace.ts '`${file}:${line}: use pausePageClock for same-time install/pauseAt`'
  c hub/test/lint-web-workspace.ts "console.log('web page clock: no raw same-time install/pauseAt pairs');"
  c package.json 'node hub/test/lint-web-workspace.ts'
  echo "-- read on the branch (T-1176 at f7450abf): grep at the build"
  c hub/test/web-tunnel-guide.test.ts "assert.equal(snippets.length, 1, 'guide has one executable configuration snippet');"
  c hub/test/web-tunnel-guide.test.ts "assert.match(snippet, /^bind = \"127\.0\.0\.1\"\$/m);"
  c hub/test/web-tunnel-guide.test.ts "}, 'web', '--qr');"
  c hub/test/tiers.json '"hub/test/web-tunnel-guide.test.ts": "T2"'
  echo "-- colour values outside tokens.css in the stage's styles"
  git -C "$W" grep -n -E "#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(" -- web/src/PhoneNotifications.module.css
  echo "-- probe selectors (each count at least 1)"; for a in 'More areas' 'Phone areas' 'Subscribe to notifications' 'aria-label="Profile"' 'role="switch"' 'data-area-module' 'data-object-id' 'notification-open'; do printf '%s %s\n' "$(git -C "$W" grep -c -F -- "$a" -- web/src web/public | awk -F: '{n+=$2} END {print n+0}')" "$a"; done
  echo "-- test names at the build"; for f in web/test/phone-notifications.test.ts hub/test/web-notifications.test.ts hub/test/web-tunnel-guide.test.ts web/test/notifications.test.ts; do echo "== $f"; names "$f"; done
}
k03() {   # QA shell: AGENTS.md web/ rules at the build
  git -C "$W" grep -n -E "keydown|keyup|keypress|onKey(Down|Up|Press)" -- web/src
  git -C "$W" grep -n -E "localStorage|sessionStorage" -- web/src web/public
  git -C "$W" grep -n -E "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML" -- web/src web/public
  for i in T-1175 T-1183 T-1176; do c=$(landed "$i"); echo "== $i"; [ -n "$c" ] && git -C "$W" show --format= "$c" -- package.json package-lock.json web/package.json hub/package.json nvim/package.json | grep -E '^[+-] '; done
}
k04() {   # docs, in QA's own shell
  ( cd "$W" || exit 1
    chk() { printf '%s present %s: %s\n' "$(grep -c -F -- "$2" "$1")" "$1" "$2"; }
    echo "-- web/README.md headings around the guide, in file order"; grep -n -E '^#{2,3} ' web/README.md | sed -n '/## Phone$/,/## Components and colours/p'
    echo "-- T-1176 C1 (read on the branch)"
    chk web/README.md '## HTTPS on your phone'
    chk web/README.md '### Tailscale Serve'
    chk web/README.md 'bind = "127.0.0.1"'
    chk web/README.md 'origin = "https://cland.example-tailnet.ts.net"'
    chk web/README.md 'own tunnel. The hub and its web edge can both stay on loopback.'
    chk web/README.md 'tailscale serve --bg http://127.0.0.1:48123'
    chk web/README.md 'loopback web edge. Its HTTPS URL must match `[web] origin`. From the project,'
    chk web/README.md 'cland web --qr'
    chk web/README.md '### Install and enable notifications'
    chk web/README.md 'In the app, open **More**, tap **Subscribe to notifications** and allow the'
    chk web/README.md 'the **Needs you** and **Finished** switches as desired. The installed app'
    echo "-- T-1176 C1 order inside the section (line numbers must rise: loopback bind, origin, Serve, --qr, Home Screen, More)"
    s=$(grep -n -F '## HTTPS on your phone' web/README.md | head -n 1 | cut -d: -f1); e=$(awk -v s="${s:-1}" 'NR>s && /^## /{print NR; exit}' web/README.md)
    for p in 'bind = "127.0.0.1"' 'origin = "https://' 'tailscale serve --bg' 'cland web --qr' 'Add to Home' 'tap **Subscribe to notifications**'; do printf '%s %s\n' "$(grep -n -F -- "$p" web/README.md | awk -F: -v s="${s:-0}" -v e="${e:-0}" '$1>s && $1<e {print $1; exit}')" "$p"; done
    echo "-- T-1176 C2 (read on the branch)"
    chk web/README.md 'A phone visiting a plain-HTTP LAN address is not in a secure context: it gets no'
    chk web/README.md 'service worker, no notifications and no installable app. Use HTTPS through your'
    chk web/README.md 'On iOS, the installed app keeps its cookies apart from Safari: open the sign-in'
    chk web/README.md 'Any HTTPS reverse proxy of your own works the same way: forward to the loopback'
    chk web/README.md 'the workbench through a cloud service. Tailscale Serve keeps this example within'
    chk web/README.md 'is hidden or unfocused. Push with the page closed is not in 0.2.0.'
    chk docs/agents/tests.md '### HTTPS tunnel guide contract'
    echo "-- T-1175 docs (verified at writing)"
    chk web/README.md 'On the phone, **Subscribe to notifications** asks for permission and registers'
    chk web/README.md 'Notification switches and the subscription button live in More on'
    chk web/README.md 'is deferred. The worker has no fetch handler and never caches the shell.'
    chk hub/README.md 'Phone More also registers `/sw.js` at root scope after a permission tap, without'
    chk docs/agents/tests.md '### phone-notifications.test.ts'
    chk docs/agents/tests.md '### web-notifications.test.ts'
    echo "-- T-1183 docs (verified at writing)"
    chk web/README.md 'For an exact paused browser time, use `pausePageClock(page, time)` from the shared'
    chk docs/agents/tests.md '### Paused page clocks'
    for i in T-1175 T-1183 T-1176; do c=$(landed "$i"); echo "== $i docs diff"; [ -n "$c" ] && git show --format= "$c" -- web/README.md hub/README.md docs/agents/tests.md | grep -E '^[+-][^+-]' | cut -c1-200; done
    echo "-- statements to read against the implementation (candidates for low findings)"
    grep -n -i -E 'no service worker|later E-419 ticket|arrives in a later|only Items, *$|stay desktop only' web/README.md hub/README.md docs/agents/tests.md | cut -c1-200 )
}
k06() {   # sealed, in $W: the T-1183 guard, an independent raw-pair count, its control at d63d7e99^, and a planted raw pair
  ( . "$Q/env.sh"; cd "$W" && node hub/test/lint-web-workspace.ts; echo "guard exit $?" )
  cat > "$Q/rawpairs.mjs" <<'JS'
import { readFileSync, globSync } from 'node:fs';
const W = process.argv[2]; const norm = s => s.replace(/\s+/g, '');
let raw = 0; const sites = {};
for (const f of globSync('web/test/**/*.test.ts', { cwd: W })) {
  const text = readFileSync(`${W}/${f}`, 'utf8');
  const installed = new Map();
  for (const [, recv, op, arg] of text.matchAll(/([\w.]+)\.clock\.(install|pauseAt)\(([^;]*?)\);/g)) {
    if (op === 'install') installed.set(recv, norm(arg).match(/^\{time:(.*)\}$/)?.[1] ?? null);
    else if (installed.get(recv) && installed.get(recv) === norm(arg)) { raw++; console.log(`raw pair ${f}: ${recv} ${arg}`); }
  }
  const n = (text.match(/await pausePageClock\(/g) ?? []).length; if (n) sites[f] = n;
}
console.log(`raw same-time pairs ${raw}`);
console.log(`pausePageClock sites ${Object.values(sites).reduce((a, b) => a + b, 0)} in ${Object.keys(sites).length} files: ${JSON.stringify(sites)}`);
JS
  echo "-- at the build"; node "$Q/rawpairs.mjs" "$W"
  mkdir -p "$Q/pre" && git -C "$W" archive d63d7e99^ web/test | tar -x -C "$Q/pre"
  echo "-- control: the same count before T-1183"; node "$Q/rawpairs.mjs" "$Q/pre" | tail -n 2
  G=$Q/guard; mkdir -p "$G/hub/test" "$G/web"
  cp "$W/package.json" "$G/package.json"; cp "$W/web/package.json" "$G/web/package.json"; cp "$W/hub/tsconfig.json" "$G/hub/"; cp "$W/web/tsconfig.json" "$G/web/"
  cp "$W/hub/test/lint-web-workspace.ts" "$G/hub/test/"; cp -R "$W/web/test" "$G/web/test"; ln -s "$R/node_modules" "$G/node_modules"
  ( . "$Q/env.sh"; cd "$G" && node hub/test/lint-web-workspace.ts > /dev/null 2>&1; echo "unplanted copy exit $?" )
  cp -R "$G" "$Q/planted"   # the node_modules symlink is copied as a link
  printf '%s\n' "import test from 'node:test';" "test('qa planted', async () => {" "  const page = {} as any;" "  await page.clock.install({ time: new Date('2026-10-23T12:00:00Z') });" "  // a comment between" "  await page.clock.pauseAt(new Date('2026-10-23T12:00:00Z'));" "});" > "$Q/planted/web/test/qa-planted.test.ts"
  ( . "$Q/env.sh"; cd "$Q/planted" && node hub/test/lint-web-workspace.ts 2>&1 | grep -E 'use pausePageClock|web page clock' | cut -c1-160; echo "planted exit ${PIPESTATUS[0]}" )
}
k13() {   # sealed, in $W: T-1183 C2's shape: phone-disconnected.test.ts 10 times, two concurrent files per round, two CPU loaders
  quiet || return 1
  h=$(holder); case "$h" in "none waiters 0") ;; *) echo "deferred: $h"; return 1;; esac
  ( . "$Q/env.sh"; cd "$W" || exit 1
    yes > /dev/null & l1=$!
    yes > /dev/null & l2=$!
    trap 'kill "$l1" "$l2" 2>/dev/null' EXIT
    echo "loaders $l1 $l2"
    for r in 1 2 3 4 5; do
      node --test --test-concurrency=1 --test-reporter=tap web/test/phone-disconnected.test.ts > "$EV/E419S4-13-${r}a.log" 2>&1 & pa=$!
      node --test --test-concurrency=1 --test-reporter=tap web/test/phone-disconnected.test.ts > "$EV/E419S4-13-${r}b.log" 2>&1 & pb=$!
      wait "$pa"; echo "exit $?" >> "$EV/E419S4-13-${r}a.log"; wait "$pb"; echo "exit $?" >> "$EV/E419S4-13-${r}b.log"
    done
    kill "$l1" "$l2"; wait "$l1" "$l2" 2>/dev/null
    for p in "$l1" "$l2"; do kill -0 "$p" 2>/dev/null && echo "loader $p alive"; done; echo "loaders stopped" )
  for f in "$EV"/E419S4-13-*.log; do printf '%s | %s | %s | %s | census %s\n' "$(basename "$f")" "$(tail -n 1 "$f")" "$(grep -E '^# pass ' "$f")" "$(grep -E '^# fail ' "$f")" "$(census "$(basename "$f" .log)" | tr '\n' ' ')"; done
  grep -l -E '^ *not ok|# SKIP' "$EV"/E419S4-13-*.log
}
k14() {   # sealed, in $W: the full typecheck with the web guards, the static guards, the tier lint and the stage's classifications
  ( cd "$QA_W" && npm run typecheck > "$EV/E419S4-14.log" 2>&1; echo "typecheck exit $?"; npm run test:static > "$EV/E419S4-14-static.log" 2>&1; echo "static exit $?"; node hub/test/lint-tiers.ts > "$EV/E419S4-14-tiers.log" 2>&1; echo "tiers exit $?" )
  grep -F -e 'web HTML: raw-HTML sinks refused; seeded fixtures passed' -e 'web colours: token-only sources; colour fixtures passed' -e 'web tokens:' -e 'web hooks: conditional-hook fixture rejected by configured oxlint' "$EV/E419S4-14.log"
  grep -F -e 'web page clock: no raw same-time install/pauseAt pairs' "$EV/E419S4-14-static.log"
  grep -F -e '"web/test/phone-notifications.test.ts": "Web"' -e '"hub/test/web-notifications.test.ts": "T1"' -e '"hub/test/web-tunnel-guide.test.ts": "T2"' "$QA_W/hub/test/tiers.json"
}
k15() {   # sealed, in $W: the QA probe (Headless Shell and scratch hubs; facts to $EV/E419S4-15.jsonl)
  : > "$EV/E419S4-15.jsonl"                    # start the fact file empty
  ( cd "$QA_W" && QA_OUT="$EV/E419S4-15.jsonl" node --test --test-reporter=tap "$QA_Q/probe.test.mjs" > "$EV/E419S4-15.log" 2>&1; echo "exit $?" >> "$EV/E419S4-15.log" )
  tail -n 1 "$EV/E419S4-15.log"; grep -E '^# (tests|pass|fail) |Web fixture census' "$EV/E419S4-15.log"
  cat "$EV/E419S4-15.jsonl"
}
k17() {   # QA shell: cleanup of the fixture-owned processes and the scratch root
  for f in "$EV"/E419S4-0[7-9]*.log "$EV"/E419S4-1[0-5]*.log; do [ -e "$f" ] || continue; printf '%s ' "$(basename "$f")"; census "$(basename "$f" .log)" | tr '\n' ' '; echo; done
  git -C "$W" status --porcelain | grep -v -x -F '?? node_modules' | wc -l
  echo "$Q"
}
```

Cleanup after the evidence is recorded: print `$Q`, check it begins with `/private/tmp/qa-e419s4-`, and remove it by that literal path with a non-force `rm -r` (its `guard/node_modules` is a symlink; `rm -r` removes the link, not its target). Remove the worktree with `git -C "$R" worktree remove "$W"` once the verdict is recorded (remove its `node_modules` symlink first if Git refuses). A failed Web case writes a Playwright trace under `$W/web/test-results/` (ignored by Git); name a trace as evidence before removing the worktree.

## Cases

none. No headless-grid case covers the phone's notification controls, the worker or the guide; every check below is a manual check through named test files, the QA probe's Headless Shell pages and scratch hubs, git greps, the T0 guard or the docs, recorded with `qa-record.sh note`.

### Web cases (when in scope)

none: no `real-browser` case in this run (see "Out of scope"). Every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, mobile flag, service workers allowed) and a desktop context against sealed scratch hubs with fake senders and stubbed notification calls (E419S4-07 to E419S4-15).

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-419 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>` from `$W` in QA's own shell, naming where it ran at the start of the command text (`[QA shell]`, `[test $W]`, `[sealed $W]`, `[docs]`). The recorder takes `hub-api` for every check here; the probe's page steps are Headless Shell observations recorded the same way. Save each check's printed output as `$EV/<id>.txt` (pipe the row's command through `tee`) and name it, with the captures the row wrote, as evidence.

How to run a row, by its `where`:
- **sealed $W**: a single command runs as `( . "$Q/env.sh"; cd "$W" && <command> )`. `k06` and `k13` seal their own steps: call them directly from QA's own shell. `k14` and `k15` read `$QA_W` and `$QA_Q`: call them as their rows say, `( . "$Q/env.sh"; k14 )` after `quiet`.
- **test $W**: in QA's own shell; `nt` runs `quiet` first and seals the test run itself.
- **docs** and **QA shell**: in QA's own shell, as QA; the plan reads of E419S4-00 and E419S4-16 are the only checks that touch the live hub, and only to read.

Order: the setup and E419S4-00; then E419S4-01 to E419S4-06, which need no test slot (run them while a stage cover may still hold it); then `quiet` and E419S4-07 to E419S4-15 in id order (E419S4-01's bundle serves every Web file and the probe; E419S4-13 may be deferred to after E419S4-15 when someone waits for the slot); then E419S4-16 and E419S4-17.

**How a test row is judged.** Two separate things, never one:
1. **Clean**: the log shows `exit 0`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, `# pass` equal to `# tests`, no `not ok` and no `# SKIP`; every Web log's `census` prints a first count of at least `1` and a second count of `0` (hub T1/T2 logs print `0 0`, which is expected).
2. **Required names**: every test named in the row's "required" list appears in `oks` (a name that appears on no `ok` line proves nothing; a name pattern matching zero tests passes with exit 0 and `# tests 0`).

TAP totals are not judged: they move with unrelated landings. The row gives the totals at writing for orientation only; a different `# tests` count is fine when the log is clean and every required name passes. Required names come in two kinds: **verified** (read at `b10c9119`; `phone-notifications.test.ts` and `notifications.test.ts` also ran clean there in this sealed setup) and **read on the branch** (T-1176 at `f7450abf`: confirm each against `names` at the build in E419S4-02). A required name missing at the build is judged by the file's own names at the build: renamed with the same body is PASS with the rename recorded; removed is FAIL for the criterion it carried; for a read-on-the-branch name, a test at the build whose body (read there) asserts the same criterion replaces it, recorded as a mapping in `$EV/<id>-map.txt`.

| id | surface | where | covers | command | expected |
| --- | --- | --- | --- | --- | --- |
| E419S4-00 | hub-api | QA shell | build, plan, merges, sealing | `k00 \| tee "$EV/E419S4-00.txt"` | Both SHAs equal `$S`; `0` changed paths; the symlink reads `/Users/evgeniyivanov/Projects/cland/v0/node_modules`. The plan lists the stages `bottom bar and inbox home`, `asks, threads, the composer and install`, `sessions and disconnected`, `notifications and the guide`; this stage has `qa` `{scope: "affected", when: "after-stage"}`, `state` not `closed` (it closes only after this verdict and the covers), `items` T-1175, T-1176 and T-1183 plus any findings fixes the request names (nothing else), `total` equal to the number of printed items and `merged` equal to `total`; record the printed line as printed. Under every `== <id>` line exactly one commit line (T-1175 `267dfd13`, T-1183 `d63d7e99` at writing; T-1176 the commit that landed it); a missing line is BLOCKED "<id> not on dev". All eight files listed. Paths outside `web/` and `docs/`: T-1175 `.agents/skills/implement/CHANGES`, `.agents/skills/implement/SKILL.md`, `hub/README.md`, `hub/src/hub/web-edge.ts`, `hub/test/tiers.json`, `hub/test/web-auth.test.ts`, `hub/test/web-edge.test.ts`, `hub/test/web-notifications.test.ts`; T-1183 `hub/test/lint-web-workspace.ts`; T-1176 at most `hub/test/tiers.json`, `hub/test/web-tunnel-guide.test.ts`, `hub/test/durations.json` (no finding). Any `shared/` or `nvim/` path, or a `hub/src/` path other than `web-edge.ts`, is a scope finding to report, not judged here. Record the three file lists. `TMPDIR` is the system default (not `/tmp`) and `Q` begins `/private/tmp/qa-e419s4-`. Also record the setup's two counts (the first at least `1`, the second `0`) and `probe parses`. Repeat the first two commands after E419S4-17: unchanged (dev not moved) |
| E419S4-01 | hub-api | sealed $W | build | `npm run build --workspace web > "$EV/E419S4-01.log" 2>&1; echo "build exit $?"; ls web/dist/index.html web/dist/sw.js web/dist/assets; cmp web/public/sw.js web/dist/sw.js && echo "sw.js copied"; git status --porcelain \| grep -v -x -F '?? node_modules' \| wc -l` | `build exit 0`; `web/dist/index.html`, `web/dist/sw.js` and the `assets` directory listed; `sw.js copied`; `0` changed paths (`web/dist` is ignored). Needs no test slot |
| E419S4-02 | hub-api | QA shell | the worker, More, delivery and the edge (T-1175), the helper and guard (T-1183), the guide test (T-1176), colours, the probe's selectors and the members' test names | `k02 \| tee "$EV/E419S4-02.txt"` | Under both `-- verified at writing` headings every line starts with `1` or more; a `0` means the code changed after writing: read the file at the build and record what replaced it (same behaviour: no finding; behaviour missing: FAIL for the criterion it carries: `sw.js` and `Shell.tsx`'s row entry C4, `PhoneNotifications.tsx` C1/C5, `browser-notifications.ts` C2, `notification-state.ts` C5, the harness and guard lines T-1183 C1). Under `-- must print 0` both lines start with `0` (no fetch handler: T-1175 C4; no push subscription: C1). Under `-- read on the branch` every line starts with `1` or more; a `0` means T-1176 landed with a different test: read `hub/test/web-tunnel-guide.test.ts` at the build and record what replaced it (the same snippet, Host/Origin and `--qr` checks: no finding; missing: FAIL for T-1176 C3). The colour grep prints nothing (AGENTS.md: colour values live only in `tokens.css`). Every probe selector count is at least `1` (a `0` means a renamed label: correct the probe as "QA probe" says before E419S4-15). Record each file's test names: E419S4-07 to E419S4-10 judge them |
| E419S4-03 | hub-api | QA shell | AGENTS.md `web/` rules | `k03 \| tee "$EV/E419S4-03.txt"` | The key-listener grep lists only `web/src/keyboard.ts` (one `document.addEventListener('keydown', …)`, its handler and its removal): no component-local key listener in `PhoneNotifications.tsx` or `Shell.tsx`. Storage appears only in `web/src/interface-state.ts` under `cland.ui.<area>.v1` and in `web/src/connection.ts`'s `cland-reload-build` guard; `web/public/sw.js` uses none (the switches reach storage through `interface-state.ts`). The raw-HTML grep prints nothing. Under all three ids nothing: no dependency, devDependency or lockfile change |
| E419S4-04 | hub-api | docs | T-1176 C1, C2; docs of T-1175 and T-1183 | `k04 \| tee "$EV/E419S4-04.txt"` | The headings, in file order, hold `## HTTPS on your phone` with `### Tailscale Serve` and then `### Install and enable notifications` under it, before `## Components and colours` (where `## HTTPS on your phone` sits relative to `## Phone` and `## Installable app` is not judged). Every `present` line starts with `1 ` (or more). **T-1176 C1**: the six order line numbers are all printed and rise in the order printed (loopback bind, HTTPS origin, Serve, `cland web --qr`, Home Screen, More's button), all inside the section. **T-1176 C2**: the three statements (plain HTTP on the LAN gives no worker, notifications or install; iOS keeps the installed app's cookies apart; any HTTPS reverse proxy of one's own, never a cloud service). A `0` under `-- T-1176` is FAIL for the criterion the line carries unless the same statement landed in other words: then read `## HTTPS on your phone` at the build and confirm the walk (C1) or the statement (C2); no such text is FAIL, a missing detail a **low** finding. A `0` under `-- T-1175 docs` or `-- T-1183 docs` is a **low** docs finding (no docs criterion), recorded with the wording found. Then read the guide, `web/README.md`'s Phone, Accounts and notification sections, `hub/README.md`'s notification paragraph and the `docs/agents/tests.md` paragraphs for `phone-notifications`, `web-notifications`, `Paused page clocks` and `HTTPS tunnel guide contract`, and record any statement that contradicts E419S4-02 or E419S4-06 to E419S4-15 as a **low** finding with file and line (the row stays PASS when the only contradictions are docs ones). At writing the candidates grep prints one line, `web/README.md:88`'s "Plan and the view switcher stay desktop only" (unrelated to notifications: dismiss; the stage-3 candidate "their phone home in More arrives in a later E-419 ticket" was replaced by T-1175); any other printed line is a candidate to confirm or dismiss |
| E419S4-05 | hub-api | sealed $W | brief | `cland qa lint qa/briefs/E-419-stage-4.md; echo "exit $?"` | `qa/briefs/E-419-stage-4.md: qa lint passes at the build` and `exit 0` (this brief, committed at the build). Needs no test slot |
| E419S4-06 | hub-api | sealed $W | T-1183 C1; the guard | `k06 \| tee "$EV/E419S4-06.txt"` | Needs no test slot (T0: no browser, no hub). `web workspace: strict flags, shared compiler and post-typecheck build plan`, `web page clock: no raw same-time install/pauseAt pairs` and `guard exit 0`. **At the build `raw same-time pairs 0`** with no `raw pair` line (the independent count, by text, of every `<receiver>.clock.install({ time: X })` followed by `<receiver>.clock.pauseAt(X)` in `web/test/**/*.test.ts`); `pausePageClock sites` at least `18` in at least `8` files, the 8 files each at least their writing count `{"web/test/accounts.test.ts":2,"web/test/asks.test.ts":1,"web/test/composer.test.ts":1,"web/test/events.test.ts":4,"web/test/inbox.test.ts":4,"web/test/notifications.test.ts":1,"web/test/phone-disconnected.test.ts":3,"web/test/verification.test.ts":2}` (a later file using the helper is fine). **Control**: the same count at `d63d7e99^` prints `raw same-time pairs 18` (proves the count sees the pattern; a different number makes the at-build `0` INCONCLUSIVE, not PASS). **Planted pair**: the guard on an unplanted scratch copy exits `0` (`unplanted copy exit 0`); on a second copy with one planted file it refuses `web/test/qa-planted.test.ts:6: use pausePageClock for same-time install/pauseAt` with `planted exit 1` (a non-zero exit). Remaining `install`/`pauseAt` pairs at different times (for example `area-slots`, `connection`, `sessions`, `topics`) are allowed by T-1183 and not judged |
| E419S4-07 | hub-api | test $W | T-1175 C1, C2, C3, C5 | `nt E419S4-07 web/test/phone-notifications.test.ts; oks E419S4-07; census E419S4-07` | Clean. Required names (verified; ran clean at `b10c9119`): "phone More subscribes on a tap with root worker scope and shared switches without Web Push" (C1), "hidden phone ask goes once through the worker and its message opens the exact Inbox row" (C2, C4's message and cold entry), "waiting plan and TUI-bound Claude approval each notify through the phone worker" (C3), "phone subscription denial turns saved switches off and explains browser settings without registering" (C5), "held registration suppresses a notification after looking changes" and "held registration suppresses a notification after disabled changes" (C2, the reviewer's M1). Totals at writing (not judged): `# tests 6`, census `6` and `0` |
| E419S4-08 | hub-api | test $W | T-1175 C4; the edge serving the worker | `nt E419S4-08a hub/test/web-notifications.test.ts; oks E419S4-08a; nt E419S4-08b hub/test/web-edge.test.ts; oks E419S4-08b; nt E419S4-08c hub/test/web-auth.test.ts; oks E419S4-08c` | Each clean (hub T1/T2: no census). Required names (verified): web-notifications "worker notification clicks focus and message a window or open the exact row without a fetch handler" (C4: the production `sw.js` in a VM registers no `fetch` handler; a click closes, focuses and posts `{ type: 'notification-open', target }`, or opens `https://cland.example/?area=inbox&row=ask+1%2F%26`), "a now ask names its session, item and question with a stable row target", "notification policy suppresses looking, disabled, ungranted and non-now rows"; web-edge "the bundle has strict headers, revalidation for entry files and immutable assets" (`/sw.js` as JavaScript with `Service-Worker-Allowed: /` and `worker-src 'self'`); web-auth "the project manifest and linked PNG icons share the built panel theme" (the built worker served), "tunnel Host and exact Origin admit a web client and set Secure without trusting forwarded headers", "web --qr prints a decodable tunnel link without opening the browser". Totals at writing (not judged): web-notifications `5`, web-edge `8`, web-auth about `24` |
| E419S4-09 | hub-api | test $W | T-1176 C3 | `nt E419S4-09 hub/test/web-tunnel-guide.test.ts; oks E419S4-09` | Clean (hub T2: no census). Required name (read on the branch at `f7450abf`; judge a rename by the rule above): "the HTTPS tunnel guide config admits its Host and Origin and prints its QR sign-in link". Totals on the branch (not judged): `# tests 1` |
| E419S4-10 | hub-api | test $W | desktop notifications regression (also a T-1183 migrated file) | `nt E419S4-10 web/test/notifications.test.ts; oks E419S4-10; census E419S4-10` | Clean. Required names (verified; ran clean at `b10c9119`): "hidden now ask raises one named notification whose click focuses and opens its Inbox row", "profile switches persist Finished off across reload and request permission only on first enable", "looking, disabled and watch-layer asks stay silent without later replay", "denied permission keeps both switches off with a browser-settings tooltip", "hidden now task reaching done notifies once and its click opens the item card", "revoked browser permission disables saved switches on reload and explains why", "one browser shares switch changes between its open tabs", "a task moved out of Now by another item delta stays silent when it later finishes" (the page `Notification` path with workers blocked). Totals at writing (not judged): `# tests 8`, census `8` and `0` |
| E419S4-11 | hub-api | test $W | earlier phone files regression | `nt E419S4-11a web/test/phone.test.ts; oks E419S4-11a; census E419S4-11a; nt E419S4-11b web/test/phone-more.test.ts; oks E419S4-11b; census E419S4-11b; nt E419S4-11c web/test/phone-inbox.test.ts; oks E419S4-11c; census E419S4-11c; nt E419S4-11d web/test/phone-asks.test.ts; oks E419S4-11d; census E419S4-11d; nt E419S4-11e web/test/phone-approvals.test.ts; oks E419S4-11e; census E419S4-11e; nt E419S4-11f web/test/phone-thread.test.ts; oks E419S4-11f; census E419S4-11f; nt E419S4-11g web/test/phone-composer.test.ts; oks E419S4-11g; census E419S4-11g; nt E419S4-11h web/test/phone-install.test.ts; oks E419S4-11h; census E419S4-11h; nt E419S4-11i web/test/phone-sessions.test.ts; oks E419S4-11i; census E419S4-11i` | Each clean. Required names (verified): phone "the phone frame replaces the rail without losing desktop state" (More's six buttons, T-1175 changed its list), "More has no scrim, closes on Escape, selection and outside taps, and frame controls fit touch", "five touch slots open the four areas and Inbox is home", "phone badges share attention facts and count every event since the shared last look"; phone-more "phone Accounts retains registry and window facts while notification switches stay desktop only" (still true: the phone switches live in More, not in Accounts' Profile; the name's "desktop only" is a **low** naming candidate, not a failure); phone-inbox "phone message and request replies unfold inline, share topic drafts and reach the sender"; phone-asks "phone ask row opens a numbered touch sheet with header facts and a free answer"; phone-approvals "phone approval Escape, close, scrim and swipe leave the native request pending"; phone-thread "phone topic opens full screen with its facts and both Back paths return to Topics"; phone-composer "phone per-topic drafts survive navigation and reload with their chosen kind"; phone-install "the installed start URL opens Inbox over a saved Sessions area and leaves a plain root URL" (the `?area=inbox` launch T-1175's row entry shares), "the app badge follows needs-you counts and clears when the last ask is answered"; phone-sessions: clean only. Totals at writing (not judged): phone `7`, phone-more `5`, phone-install `4` |
| E419S4-12 | hub-api | test $W | the Web files T-1183 migrated | `nt E419S4-12a web/test/accounts.test.ts; oks E419S4-12a; census E419S4-12a; nt E419S4-12b web/test/asks.test.ts; oks E419S4-12b; census E419S4-12b; nt E419S4-12c web/test/composer.test.ts; oks E419S4-12c; census E419S4-12c; nt E419S4-12d web/test/events.test.ts; oks E419S4-12d; census E419S4-12d; nt E419S4-12e web/test/inbox.test.ts; oks E419S4-12e; census E419S4-12e; nt E419S4-12f web/test/verification.test.ts; oks E419S4-12f; census E419S4-12f; nt E419S4-12g web/test/phone-disconnected.test.ts; oks E419S4-12g; census E419S4-12g` | Each clean (the eighth file, `notifications.test.ts`, is E419S4-10). Required names (verified; each holds at least one migrated `pausePageClock` site at `b10c9119`): accounts "Accounts lists the fake registry with every window, path, source and limited mark", "Sessions account strip shows worst windows, limited reset, tooltips and a folding Accounts link"; asks "offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft"; composer "per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read"; events "Events groups newest 200 by local day and appends bounded older pages by button and physical A", "Events dims bookkeeping, shows hub coalescing, folds a local day with za and opens an item with Enter"; inbox "Inbox keeps four ordered sections, newest five rows, oldest wait, live ages and saved folds", "a fresh epoch recovers an approval answered by a peer while this browser was offline"; verification "Sessions verification queue shows hand runs, ages receipts and remembers its fold", "C3 elapsed running and wait times advance without a frame and a replacement resets their receipt"; phone-disconnected "phone disconnect shows a counting backoff and immediate Retry resets it without reloading", "phone keeps the last Inbox time and disables every answer and reply while disconnected", "phone reconnect keeps offline drafts unsent and refreshes a refused resume from the last sequence". Totals at writing (not judged): accounts `6`, asks `9`, composer `8`, events `11`, inbox `23`, verification `4`, phone-disconnected `3` |
| E419S4-13 | hub-api | sealed $W | T-1183 C2 | `k13 \| tee "$EV/E419S4-13.txt"` | Starts only on `none waiters 0` (a `deferred:` line is not a result: run it after E419S4-15, then again after `quiet`; still deferred when every other row is done: BLOCKED "load run deferred", reported). Ten logs `E419S4-13-1a` to `E419S4-13-5b`, each `exit 0`, `# pass 3`-or-more equal to its `# tests`, `# fail 0`, census at least `1` and `0`; the final `grep -l` prints nothing; `loaders stopped` with no `loader <pid> alive` line. 10 of 10 clean is PASS for the QA reproduction; any `not ok` naming `Cannot fast-forward to the past` is FAIL for C2; another failure is recorded with its log and judged by the flaky rule in the request (file it, one rerun of this row). The reviewer's macOS receipt (A-10227, A-10222: 10/10 at two workers with two `yes` loaders) is cited, not re-judged |
| E419S4-14 | hub-api | sealed $W | typecheck, colour, contrast, HTML and hooks guards; static guards; tiers | `quiet && ( . "$Q/env.sh"; k14 ) \| tee "$EV/E419S4-14.txt"` | `typecheck exit 0` with no diagnostic in the log (hub, Neovim, shared wire and web typechecks; `PhoneNotifications.module.css` holds no colour value; secondary text keeps 4.5:1 on ground and selection); the four guard lines appear (`web HTML: raw-HTML sinks refused; seeded fixtures passed`, `web colours: token-only sources; colour fixtures passed`, `web tokens: <n> text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`, `web hooks: conditional-hook fixture rejected by configured oxlint`); `static exit 0` with `web page clock: no raw same-time install/pauseAt pairs` printed (the guard wired into `npm run test:static`, with the skill-provenance guard covering T-1175's `CHANGES` line); `tiers exit 0`; the three classification lines print (`"Web"`, `"T1"`, `"T2"`) |
| E419S4-15 | hub-api | sealed $W | T-1175 C1, C2, C4, C5; T-1183 C1 (the helper); T-1176 C3; the desktop (independent probe) | `quiet && ( . "$Q/env.sh"; k15 ) \| tee "$EV/E419S4-15.txt"` | **The TAP pass and the facts are judged separately.** TAP: `exit 0`, `# tests 2`, `# pass 2`, `# fail 0`, one `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line: this proves only that the probe ran to its end and cleaned up, nothing about the product. Facts, each judged on its own; a `step` line means that step's facts are missing: FAIL for the criterion it carries when the product lacks the thing, or a probe correction (see "QA probe") when only a selector changed. All below were observed at writing (T-1175, T-1183 and the desktop at `b10c9119`; the guide against `f7450abf`'s README). `seeded` `{topic: true}`. **T-1175 C1**: `moreBefore` `buttons` texts exactly `["Items","Artifacts","Accounts","Needs youoff","Finishedoff","Subscribe to notifications"]`, each `height` at least 44 and `right` at most 390; `switches` `Needs you` and `Finished` both `checked: "false"`; `title: "Allow notifications for this browser"`; `registration: false`; `stubs` `{requests: 0, push: 0, page: 0, notices: []}` (nothing asked before the tap); `secure: true`. `subscribe` `{label: "Subscribed"}` with `reg` `{scope: <expectScope>, script: <expectScript>, state: "activated", subscription: false}` (scope and script equal to the printed `expectScope` and `expectScript`, the page's origin plus `/` and `/sw.js`) and `stubs` `{requests: 1, push: 0, page: 0, notices: []}`. `switchOn` `Needs you` `checked: "true"`, `Finished` `"false"`, `requests: 1` (no second prompt). **T-1175 C4**: `workerServed` `{status: 200, type: "text/javascript; charset=utf-8", allowed: "/", cache: "no-cache", listeners: ["notificationclick"], sameAsSource: true, workerSrc: true, fetchWord: false, caches: false}`. `messageOpen` `{focused: true, area: "Inbox", more: 0}`; `coldEntry` `{focused: true, url: "/", area: "Inbox"}`. **T-1175 C2**: `hiddenAsk` `{ask: true}` and `stubs.notices` exactly one entry `{title: "coord · T-900401", body: "QA phone notice?", tag: <askId>, data: {area: "Inbox", id: <askId>}}` with `page: 0` (through the worker, not the page `Notification`) and `push: 0`. `lookingAsk` `{ask: true}` with `notices` still that one entry and `page: 0` (looking suppresses). **T-1175 C5**: `denied` `before` both `"true"`, `after` both `"false"`, `title: "Notifications are blocked in this browser; allow them in site settings"`, `label: "Subscribe to notifications"`, `saved` `{needsYou: false, finished: false}`, `registration: false`, `requestsFirst: 1`, `requestsSecond: 1`, `push: 0`. **Desktop**: `desktop` `{profileSwitches: ["Needs you","Finished"], subscribe: 0, more: 0}`. **T-1183 C1**: `pausedClock` `{atTarget: true, afterRun: 1000}`. **T-1176 C3** (read on the branch): `guideSnippet` `{section: true, tomlBlocks: 1, bind: "127.0.0.1"}` with `origin` an `https:` origin (`https://cland.example-tailnet.ts.net` at writing) and `snippet` holding `[web]`; `guideHub` `{available: true, bind: "127.0.0.1"}`; `guideQr` `{code: 0, origin: <guideSnippet.origin>, path: "/auth", token: true, qr: true, opened: false}`; `guideEdge` `{wrongHost: 403, page: 200, worker: {status: 200, type: "text/javascript; charset=utf-8", allowed: "/"}, auth: 302, secure: true, wsGood: {type: "welcome", name: "human"}, wsWrongOrigin: {refused: 403}, wsHttpOrigin: {refused: 403}}` (the guide's origin admitted on Host and Origin, other origins refused) |
| E419S4-16 | hub-api | QA shell; the Coordinator's stage covers | stage covers | `(cd "$W" && node hub/bin/cland.ts task plan show E-419) \| tee "$EV/E419S4-16.txt"` and the cover results the request names | QA runs no full suite. The Coordinator owns the stage covers (`cland verify all --occasion stage`): full integrated suites at the tested SHA on Linux (the droplet) and macOS (local), which add T3 and the Web phase on both platforms and are cited evidence this run does not run. Record the plan's line for this stage exactly as printed (at writing: `notifications and the guide: open; stage cover missing Linux droplet, macOS`); Linux and macOS covers green at the tested SHA, each with its Web phase run (not "Web unavailable"); record each cover's run id, artifact, executor, platform, tiers and phases, wall time and cost as cited evidence. Any red cover is FAIL naming its failing tests. A cover still running when every other check is done: wait for its result in the epic topic (the macOS cover takes about 20 minutes; a wait is not BLOCKED); none queued or running at the tested SHA by then: BLOCKED "no stage cover at the tested SHA", reported to the requester |
| E419S4-17 | hub-api | QA shell | cleanup | `k17 \| tee "$EV/E419S4-17.txt"` | Every Web log line prints a first census count of at least `1` and a second of `0` (E419S4-07, E419S4-10 to E419S4-13, E419S4-15; the hub logs E419S4-08a to E419S4-09 print `0 0`, which is expected); `0` changed paths; `$Q` begins `/private/tmp/qa-e419s4-`. Then remove `$Q` and the worktree as "Setup" says |

Re-check helper, file and test names with grep at the tested build: renames happen. The named Web tests and the probe ask the live hub's verify slot for admission themselves (`suite.slot` check): an admission refusal or timeout while a cover holds the slot is not a product failure; run `quiet` and retry that row once.

Before requesting QA, run `cland qa lint <brief>` with this filled brief at the build under test. The brief is complete only when qa lint passes at the build.

## Probes that mislead

- Process cleanup probes use a fixture-owned pid/process-group census, registered at launch and checked through exit; a machine-wide `pgrep` counts other sessions too (A-9063 R2; E-413 stage 1/T-1093). Here: each Web fixture's `Web fixture census: browser group <pid>; before <n>; after 0; scratch hub stopped` line, the probe's included; the guide test's scratch hub is stopped by `projectHub`'s own cleanup; E419S4-13's two loaders are the row's own pids, killed by the row and checked with `kill -0`.
- Edit existing keys in initialized configs, list standalone-test build prerequisites, enumerate regular files only for file probes, and identify events by seq/id. A second-client check allows only defaults the new client writes itself (A-8634 R12; E-412 stage 2, E-415 stage 3/DoD, E-1006). Here: the guide test writes the snippet as a fresh scratch project's whole `config.toml` before its hub starts, as the item's own test does; the probe's frame client and fake spoke only send through public frames; the pages write their own preferences. The bundle (with `sw.js`) is served from E419S4-01's `web/dist`: a stale bundle shows stale facts, so build first.
- Transcript assertions identify stable item/topic/frame ids, with intervals starting at the result frame of the state-changing request. Preserve unaltered captures when correcting a probe and label the correction separately from product failures (A-8634 R13; E-412/E-415/E-1006; A-9063 R2; E-413 stage 1/T-1093). The probe finds the ask by the id its `ask` call returned and judges the notification's `tag` and `data.id` against it.
- Exact tracker copies replace the initialized tracker directory after its writers stop; apply the full `fixtureEnvironment` result after overlays, check zero credential-prefix names before launching scratch processes and report names/counts only (A-9063 R2; E-413 stage 1/T-1093). This run needs no tracker copy.
- An accessibility-tree count does not prove visible reachability (A-9063 R6; T-1095, T-1097). More's controls are judged by each button's bounding box (height and right edge), never by a count.
- A probe's TAP pass is not a product verdict: the probe asserts nothing about the product, so `# pass 2` with a `step` line or a wrong fact is still a finding. Judge each fact; the TAP lines only prove the run ended and cleaned up.
- A stubbed `showNotification` proves the call, not a shown notification; the worker's real `notificationclick` cannot be fired from a page in Headless Shell. The click contract is the VM test (E419S4-08a) plus the page side of its message (`messageOpen`) and its cold URL (`coldEntry`); a real click on a real notification is the epic demo's.
- "No fetch handler" is judged three ways: the served script's registered listeners (`notificationclick` only), no `fetch` word outside comments, and the VM test's handler map. A worker that controls the page is expected (root scope); it intercepts nothing without a fetch handler.
- The raw-pair count is textual and independent of the guard's parser: its control at `d63d7e99^` must print 18 before its `0` at the build means anything, and the guard's own refusal is shown on a planted copy, never on the build's files.
- E419S4-13 is the only row that adds CPU load. It starts on an idle slot with no waiter, runs about three minutes and stops its loaders itself; never run it beside a cover or another row.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file.
- A "ran" marker grep excludes the configuration echo line.
- Successful droplet prepare logs are in the run's `delivery.log`, not the suite log: not applicable, QA runs nothing on a droplet. Speed criteria use measured wall times, never projections: this stage has none; duration lines and E-880 allowances are report-only here.
- Slots due or queued before the build count even when their results arrive later.
- "No skip": the Web files and the probe need Chrome Headless Shell (local on macOS); a skipped or "Web unavailable" result is BLOCKED, never PASS. Linux runs of the same files are cited from E419S4-16, not run by QA.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

Real Chrome, a real phone and computer use: out of scope for this run, not BLOCKED, as in this epic's earlier stages: every stage criterion is proven in Chrome Headless Shell's phone context (390×844, touch, the mobile flag, workers allowed) against sealed scratch hubs. A real notification shown by the system, a real `notificationclick`, real installability (Add to Home Screen), iOS cookie separation, a real Tailscale Serve or any tunnel, and the full Chromium build: the epic demo's job (`qa/briefs/E-419.md`). Also out of scope: Web Push with the page closed (0.2.x); the live hub and real Codex, OpenCode or Claude Code sessions (every sender is a fake spoke, frame client or fake adapter of a sealed scratch hub); E-417's and E-418's behaviour beyond the named regression files; Neovim; work landed on dev after the stage's items, beyond the regression files named here; running a full suite, T3 or a stage cover (E419S4-16 cites the Coordinator's); T4; duration budget lines (report-only); the epic's Definition of done and its demo, a separate run; the live project's tracker, hub, crew, `ui.json` and HOME. Stage QA carries no criterion marks.

Nothing else in scope needs an authorization this brief does not give: a check that cannot run for lack of one is BLOCKED, not out of scope.

## Grants

none. No computer use, no real browser, no sign-in to the live hub, no tunnel. The Headless Shell instances of the Web files and the probe open only their own sealed scratch edges, under the crew browser rule (rule 18). Every other check uses the rule 15 sealed environment with credentials filtered; nothing reads or writes the human's real `~/.cland`, `~/.claude`, `~/.codex` or `~/.local/state`.

## Verdict

Fix nothing. Clear only when every check E419S4-00 to E419S4-17 passes (docs contradictions in E419S4-04 beyond T-1176 C1 and C2, and the facts this brief marks **low**, are low findings and do not block clear). Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "notifications and the guide"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-419 stage notifications and the guide` or `qa not clear E-419 stage notifications and the guide` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
