## Web workspace

To build a fresh checkout and reach a signed-in browser, follow the single
[getting-started sequence](../../web/README.md#getting-started). The web workbench
has Inbox, Items, Sessions, Topics, Events, Artifacts and Accounts. Its README
describes each area's keys, desktop panes and drawer, the below-640-px phone
frame, install and [HTTPS tunnel guide](../../web/README.md#https-on-your-phone).
The [web edge](web-edge.md#web-edge) below documents every CLI option and `[web]` setting.

Classify each new human frame in the web authority table before admitting it; the default is refusal. Validate routing inputs before permission classification, apply the sandbox response policy to executable artifacts as well as their iframe, and close credential admission before closing sockets and observing their close receipts (A-8634 R9; T-966, T-981, T-982, T-987, T-988, T-1042).

The sibling `web/` workspace builds the browser bundle with React 19 and Vite.
The edge adds the configured project name to the build's `/manifest.webmanifest`
template and computes its ETag from the final response. The standalone app starts
on Inbox; its badge follows the authoritative needs-you count where supported.
See [Installable app](../../web/README.md#installable-app) for token-derived theme,
committed brand icons and the isolated QR/cookie test seam.
Open-page browser notifications use the hub's Inbox row layers and task transitions;
there is no new frame, authority or hub-side setting. The desktop Profile block in Accounts
and phone More offer independent Needs you and Finished switches, saved per browser/origin; the palette
has no notification actions. Only Now work
can notify, and only while the page is hidden or unfocused. Permission is requested
from the enabling gesture; denial disables both with a tooltip. Clicks select the
Inbox row or open the finished item's card. Snapshots never replay old waits.
Phone More also registers `/sw.js` at root scope after a permission tap, without
a Web Push subscription. The edge serves it as JavaScript with root scope allowed
and revalidation; the worker has no fetch handler. Active registrations deliver
through `showNotification`, falling back to page Notification when absent.
See [Browser notifications](../../web/README.md#browser-notifications) for the shared
pure rules/store and open-page scope.
Message Markdown uses the pure token parser in `web/src/markdown.ts`; renderers
create elements from its tokens. Web typecheck rejects named raw-HTML sinks
(`dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`) with
seeded source fixtures. See [Message Markdown](../../web/README.md#message-markdown).
Keep development dependencies installed in development checkouts: the prepare hook
needs Vite. The install script builds before pruning them. Root `npm install`
builds `web/dist` through `prepare`. Verification's `npm run check`
runs the shared strict typecheck, builds the bundle, then static/test lint, on local
and remote executors. Remote `verification.prepare` still handles dependencies
and Neovim; it is not the local bundle build hook. `web/dist` stays ignored.

`cland doctor` includes a **web bundle** row for this cland installation (independent
of the project being diagnosed). It compares `web/dist/build-stamp.json` with the
source filenames, content digest and latest modification time. Missing, invalid,
changed or newer inputs warn to run `npm run build` in the installation. A Vite
build, including watch rebuilds, writes a stamp only after checking local asset
references and unchanged inputs. See [web/README.md](../../web/README.md) for tokens,
fonts and the development loop. The hub serves this bundle on its web edge.

### Merge-delta assessments (report mode)

The hosting hub publishes the existing patch-id freshness result before scheduling
a separate serial advisory worker to record an ordinary item comment for an exact,
conflict-free two-parent merge of a reviewed head and a dev ancestor. Git's computed merge tree must equal the committed tree. The comment
contains immutable reviewed/head/dev/merge-base identities, changed paths on both
sides (deletions and both rename endpoints), shared paths and the applied
`conservative-runtime-coupling-v1` rule. That rule reports overlap whenever either
side includes a path outside the existing tracker/documentation override scope;
only documentation/tracker-only, path-disjoint changes can report disjoint.

Dependency facts reuse the batch import graph against committed candidate bytes:
branch-changed JS/TS importers are traced transitively to dev-changed paths.
Unsupported executable forms or exhausted budgets report unknown, never no
dependency. The shared graph lazily loads the existing TypeScript parser and follows static
and literal runtime imports, including template substitutions and literal require
calls. Computed or unproven indirect loading stays unknown. A missing parser
reports unknown; plain scalar template text does not hide dependency edges.
The native reader caps 256 object reads and 8 MiB; the shared graph also caps
source bytes, reads and traversed edges. Path censuses cap 2,000 paths and 128 KiB
per side. An unavailable assessment is logged in report mode and cannot alter
freshness or refuse an operation. The comment's `patchIdCurrent` records actual
patch-id carry-over eligibility; it does not claim a merge gate has been called.

The advisory lane deduplicates pending immutable inputs and is joined on stop,
including native Git and already-entered persistence. Held work, persistence
failures and throwing diagnostic sinks cannot delay the foreground freshness
answer or unrelated verdicts.

Comments persist on the item and deduplicate across restart by their immutable
facts. They carry no verdict fields and grant no review authority. Existing
patch-id freshness and merge gates stay unchanged. Rule 11 still requires the
responsible item lead to obtain merge-delta review before the next verification.
Enforcing finer disjointness rules requires the separate T-1486 replay rollout.

