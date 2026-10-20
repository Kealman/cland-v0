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

Verification's `npm run check` typechecks, builds `web/dist`, then runs static/test
lint. This build runs locally as well as remotely; remote prepare remains the
installation/Neovim step. `web/dist` is generated and ignored. Never commit it.
Install with development dependencies included: prepare needs Vite.
Vite checks local resource references and the fonts, then writes
`dist/build-stamp.json` with the input digest and build time. Doctor compares that
stamp with the installation's sources, including filenames and modification times;
changed, added, deleted or newer sources warn as stale. Run `npm run build` to refresh.
Watch builds use the same stamp hook. Inputs changing during a build refuse a stamp.

The development loop uses a build and reload, with E-412's same-origin web edge.
There is no Vite dev server or development bridge. This initial slice is a static
frame: the seven area names, top strip and main area, with the drawer closed.
Dashes represent unavailable facts; navigation, live data and keys land in the
later shell slices. Ported from `prototype/web-shell`'s frame and tokens, slice by
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
belong on screen; explanations belong in help, tooltips and docs. All future
keyboard actions use the one physical-code key map introduced by the key slice.

## Fonts and asset checks

Golos Text (400–900) and JetBrains Mono (100–800), normal variable WOFF2 subsets
for Latin and Cyrillic, live in `public/fonts/`. CSS requests only `/fonts/…` from
the serving origin. Their unmodified SIL OFL 1.1 licences are alongside the fonts.
`public/fonts/SOURCES.md` records the upstream URLs. Every production build checks
WOFF2 signatures, licences, no absolute external resource URL in HTML/CSS and no
external literal import/fetch/XHR/WebSocket/EventSource target in JS. React's diagnostic links,
namespace strings and OFL licence links are metadata, not network requests.
Browser request observation belongs to T-991's Web phase.
