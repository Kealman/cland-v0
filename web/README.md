# Web workbench

`@cland/web` is the React 19/Vite workspace beside `hub`. The root owns the lockfile
and the existing TypeScript compilers; the web reuses `hub/bin/typecheck.ts`. Browser code
has the hub's strict flags plus DOM libraries, JSX, bundler resolution and
`vite/client` types, with no Node globals. Tooling has its own strict Node project.

From the repository root:

```sh
npm install                         # prepare builds web/dist
npm run typecheck                   # hub, Neovim, web and web guards
npm run build                       # production browser bundle
npm run watch --workspace web       # vite build --watch; reload the page
```

Open the workbench with `cland web` from the project. `cland web --no-open`
prints the one-time sign-in link instead of opening a browser. The edge trades
that link for an HttpOnly, SameSite=Strict cookie and redirects to `/`.
The shell connects to the same origin's `/ws` with a secret-free client hello;
its types come from `shared/wire/`. After the authenticated `hub.status` reply,
the top strip shows the project directory's name and a live dot. On disconnect
the dot turns down, keeping the project name, and the shell retries after 250 ms,
doubling to a 10 s cap. A successful status reply resets the backoff. Each
connection has a 5 s hello/status deadline. A hub restart reuses the edge port
and cookie, so an open shell reconnects without reloading when the bundle matches.
The entry HTML's `cland-build-stamp` meta tag and the web welcome's `buildStamp`
identify the same source digest. A mismatched page reloads once per target build
per tab; session storage bounds retries if old HTML persists. Without session
storage the page remains usable. A protocol refusal displays **Restart hub**
and stops reconnecting; restart it through the CLI or Neovim.

Verification's `npm run check` typechecks, builds `web/dist`, then runs static/test
lint. This build runs locally as well as remotely; remote prepare remains the
installation/Neovim step. `web/dist` is generated and ignored. Never commit it.
Install with development dependencies included: prepare needs Vite.
Vite checks local resource references and the fonts, then writes
`dist/build-stamp.json` with the input digest and build time. Doctor compares that
stamp with the installation's sources, including filenames and modification times;
changed, added, deleted or newer sources warn as stale. Run `npm run build` to refresh.
Watch builds use the same stamp hook. Inputs changing during a build refuse a stamp.
The welcome reads the served receipt at connection time, including a configured
`[web] dist`; a missing or invalid receipt is reported as `buildStamp: null`.

The development loop uses a build and reload, with E-412's same-origin web edge.
There is no Vite dev server or development bridge. The shell navigates the seven
areas through the rail or physical `Digit1`–`Digit7` keys. The main area has its
heading; area contents and the split/drawer land in later slices. Dashes represent
unavailable facts. The palette and help buttons are the controls for the later
palette/key-help slice.
Ported from `prototype/web-shell`'s frame and tokens, slice by
slice, following spec v0.2 before prototype behaviour before the accepted boards.

## Components and colours

Copy `src/Shell.tsx` and `src/Shell.module.css`. Components use CSS Modules and
`var(--token)`; `src/tokens.css` is the sole colour-value file. The colour guard
scans every file below `src/` and rejects hex, rgb/rgba and hsl/hsla values elsewhere,
including a nested file named tokens.css. In-memory fixtures cover the rejected forms.
The typecheck runs that guard, contrast/role checks and oxlint with
`react/rules-of-hooks` and `react/exhaustive-deps` as errors; a scratch conditional-hook
fixture must fail the actual configured linter. No UI library or Tailwind is used;
the human approves every new dependency. See the root AGENTS.md web rule.

All 23 normal foreground tokens, including every role, reach 4.5:1 on ground and
selection. The two dark ink tokens are inverse badge text checked on their bright
badge surfaces. Surface/line tokens are not text. Role colours match
`nvim/lua/cland/hl.lua`, including the raised hub grey. Names, counts and facts
belong on screen; explanations belong in help, tooltips and docs. All keyboard actions use `src/keymap.ts`: its single code/modifier table resolves
actions and supplies their displayed keys. `src/keyboard.ts` owns the only
raw keyboard listener; components receive actions. Fields, composition and
prevented events keep their keys, and reserved browser chords stay unbound.

## Rail and top strip

The rail shows Inbox, Items, Sessions, Topics, Events, Artifacts and Accounts.
Badges report attention: Inbox uses the hub's needs-you count, Items pending
plans, Sessions approval waits and Topics human waits without an ask. Busy
sessions and ordinary inventory totals do not produce badges. The top strip
shows the project directory name, open-release picker, Coordinator name,
needs-you count (a green check at zero) and connection state. A nonzero
needs-you count prefixes the tab title. The Coordinator and needs-you controls
navigate to Sessions and Inbox respectively.

Until the snapshot client lands, the connection subscribes to ordinary hub
frames and reads `hub.status`, `inbox.list` and summary `task.list` for open
releases. Inbox pushes update attention immediately; presence/Coordinator
changes refresh status, and release changes refresh the picker. Reconnection
reads those facts again, retaining the previous display while offline.

The button collapses the rail to a 60 px icon column; below 1280 px CSS forces
that width without overwriting the button choice. Icons keep native tooltips,
accessible names and attention badges. Keyboard focus has a 2 px blue ring on
the selection surface; hover only lightens a row. IDs use non-wrapping
JetBrains Mono.

Browser preferences use `src/interface-state.ts`, one `cland.ui.<area>.v1` key
per area. The shell's rail choice, selected area and release ID share
`cland.ui.shell.v1`. Reads, parsing and writes (including access to the storage
property) are guarded; invalid fields fall back independently and denied
storage leaves navigation working. This state is local to the browser and
never writes the hub's or Neovim's interface state.

## Fonts and asset checks

Golos Text (400–900) and JetBrains Mono (100–800), normal variable WOFF2 subsets
for Latin and Cyrillic, live in `public/fonts/`. CSS requests only `/fonts/…` from
the serving origin. Their unmodified SIL OFL 1.1 licences are alongside the fonts.
`public/fonts/SOURCES.md` records the upstream URLs. Every production build checks
WOFF2 signatures, licences, no absolute external resource URL in HTML/CSS and no
external literal import/fetch/XHR/WebSocket/EventSource target in JS. React's diagnostic links,
namespace strings and OFL licence links are metadata, not network requests.
Browser request observation belongs to T-991's Web phase.

## Browser tests

The separate **Web** phase uses `node:test`, the pinned `playwright-core` and its
Chrome Headless Shell. `npm install` builds the bundle and installs only the
headless shell under `node_modules/playwright-core/.local-browsers`; no installed
Chrome, Safari, human profile or GUI browser is used. To repair the test binary,
run `npm run test:web:install`; on a Linux executor, pass `-- --with-deps` to install
the shell's OS libraries too. Executor snapshots must be refreshed after a lockfile
change; the preparation step's `npm ci` installs the pinned shell on a cold image.

```sh
npm run test:web                     # just Web, under the normal suite queue
node --test web/test/smoke.test.ts    # targeted file; build first with npm run build
node --test web/test/connection.test.ts # sign-in, connection and hub restart
node --test web/test/shell.test.ts      # rail, top strip, state, keys and focus
node --test hub/test/web-keymap.test.ts # T1 shortcut resolution and reserved chords
```

Full runs place Web after the hub phases, with resource `machine`, two local
workers and four droplet workers. Web is outside T0–T3. A `web/**` diff selects
`web-only`: Web plus hub and Neovim smoke. Other package selections retain
`web/test/smoke.test.ts`. Protocol, shared wire, edge and mixed web/package diffs
force full. Task verification includes Web even with the T0–T2 cap; merge batches
exclude it. Periodic dev, integrated, stage, epic, release and soak runs include it.
The root check builds `web/dist` once; a hand-run package suite reuses that source
receipt or builds once before workers if it is missing/stale.

`test/harness.ts` creates one scratch `projectHub` and one Headless Shell per file.
Use `webFixture(t)` and `fixture.pageCase(t, body)` in sequential cases. Each case
gets a fresh context, a one-time `web.link` minted by a local test-client frame,
a real `/auth` cookie trade and a `Notification` init stub. HOME/XDG/Git and child
environments use the shared credential filter. Browser profiles and TMPDIR paths
belong to short scratch roots. Keep CSP enabled; `pageUntil` polls with
`page.evaluate`, retaining the final assertion. Observe the exact DOM/event
boundary before asserting a result, with setup bounded separately.

A failed case writes a Playwright trace ZIP under ignored `web/test-results/` and
closes its context. Publish the file with `artifact.create` when reporting a
failure. Teardown explicitly closes the browser, observes its process exit and
an empty process-group census, then stops the scratch hub before removing roots.
The smoke includes a planted failure to prove trace writing and context disposal.
The budgets are 4 seconds per top-level test and 40 seconds for the phase, currently
reported under the repository's duration report mode. A 60-second gross hang
guard reaps a stuck phase. Web never receives load-gate repetitions; browser
assertions use deterministic facts and bounded waits, not latency assertions.

The connection case opens the link printed by `cland web --no-open` in its
disposable project (with both browser openers stubbed). It proves the rendered
project/live state, `/auth` redirect, cookie flags and the served JS bundle's CSP.
It scans every served bundle file, browser storage, cookie values, HTTP responses
and WebSocket frames for the scratch hub's secret. Restarting the in-process hub
proves offline/live rendering and cookie persistence without navigation; a
controlled browser clock proves the retry schedule without latency assertions.

The runner calls `test/prerequisite.ts` before a selected Web phase. It resolves
the pinned package's Headless Shell revision and checkout-local executable; Linux
also checks the shell and bundled shared libraries with bounded `ldd` calls in a
sealed scratch environment. It launches no browser. Until T-993 supplies Linux
libraries, an incapable droplet reports Web unavailable, with no passing Web
receipt, while preserving other phase results. The fixture uses the probe's exact
executable path, with no fallback to an installed browser.
