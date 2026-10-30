# Screenshots

Every screenshot on the landing and in the docs, by number. Every listed image is present. The verification queue and the release are drawn as diagrams instead of screenshots.

**How to add one.** Save the PNG under the file name below in `site/src/assets/screens/` and rebuild. The `Screenshot` component (`src/components/Screenshot.astro`) finds the file by name and shows the image in place of the placeholder, on every page that uses the number: no page needs editing. The description becomes the image's alt text. The list itself lives in `src/screens.ts`; change a description there and here together.

- **Where:** `site/src/assets/screens/<file>`.
- **Format:** PNG, any size and aspect ratio: crop to the part that matters. The image keeps its own proportions and is never drawn wider than half its pixel width, so take it on a 2x (Retina) screen and keep it at least 1200 px wide. Astro makes the WebP sizes at build time.
- **Look:** dark theme, the brand's colours, a real-looking project (no internal ids, people's names, e-mail addresses or local paths). Placeholders in the descriptions such as `R-1`, `T-42` or `A-n` are examples: any plausible id works.

| No. | File | Size | Pages | Status |
| --- | --- | --- | --- | --- |
| 1 | `hero.png` | 2881×1675 | Landing: hero (below the crew window); Docs: The workbench | exists |
| 2 | `accounts.png` | 1601×1200 | Landing: “Get more from every plan you pay for”; Docs: Accounts and limits; Docs: Sessions and harness access | exists |
| 3 | `web.png` | 2400×1500 | Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, The layout | exists |
| 4 | `phone.png` | 1170×2532 | Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, What the phone shows | exists |
| 5 | `explorer.png` | 2940×1716 | Docs: Items and the tracker, top | exists |
| 6 | `inbox.png` | 1377×800 | Docs: Topics and the inbox, The inbox | exists |
| 7 | `attach.png` | 2934×1683 | Docs: Sessions and harness access, top | exists |
| 8 | `plan.png` | 2917×1677 | | exists |
| 9 | `task-card.png` | 2252×1683 | Docs: Items and the tracker, Acceptance criteria; Docs: Verification and release, The merge gate | exists |
| 11 | `artifact.png` | 1851×1200 | Docs: Web and phone, Threads and asks | exists |
| 13 | `topics.png` | 1600×1200 | Docs: Topics and the inbox, top | exists |

## 1. `hero.png` (exists)

- **Size:** 2881×1675
- **Save as:** `site/src/assets/screens/hero.png`
- **Shown on:** Landing: hero (below the crew window); Docs: The workbench

The cland workbench in Neovim, dark theme: on the left the items panel with a release and its epics, in the centre a topic thread with a Coordinator's ask waiting for an answer, and on the right the sessions panel with the plans' limit windows and the live sessions.

## 2. `accounts.png` (exists)

- **Size:** 1601×1200
- **Save as:** `site/src/assets/screens/accounts.png`
- **Shown on:** Landing: “Get more from every plan you pay for”; Docs: Accounts and limits; Docs: Sessions and harness access

The cland sessions panel up close: the Accounts block on top shows two plans with their 5-hour and weekly limit windows, and the crew's sessions are listed below with harness, model and account.

## 3. `web.png` (exists)

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/web.png`
- **Shown on:** Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, The layout

The browser workbench, dark. The rail on the left, the Items explorer in the centre with a release unfolded into epics and tasks, the drawer on the right with an epic's card: progress, plan stage, latest verdict. Inbox badge shows 2.

## 4. `phone.png` (exists)

- **Size:** 1170×2532
- **Save as:** `site/src/assets/screens/phone.png`
- **Shown on:** Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, What the phone shows

The phone workbench in a mobile viewport: the inbox, with the Coordinator's ask "Start epic Checkout flow?" open as a bottom sheet with Approve, Review the plan first, a free answer and Decline.

## 5. `explorer.png` (exists)

- **Size:** 2940×1716
- **Save as:** `site/src/assets/screens/explorer.png`
- **Shown on:** Docs: Items and the tracker, top

The terminal workbench, dark, with the explorer in the centre: the current release unfolded into its epics and their tasks (status glyph, id, title, claim, criteria fraction on each row), and below it the folded roots Categories (Bugs, Tech debt, Follow-ups, Ideas, with counts), Unscheduled and Other releases. On the right, the card of the task under the cursor: its summary, status, size, parent path, the acceptance criteria with their marks, the latest verdict and the branch.

## 6. `inbox.png` (exists)

- **Size:** 1377×800
- **Save as:** `site/src/assets/screens/inbox.png`
- **Shown on:** Docs: Topics and the inbox, The inbox

The inbox full width in the terminal workbench (Space N): Asks and approvals first, with the Coordinator's ask unfolded to its numbered options and the free-answer hint; then Plan approvals with one epic plan waiting, Requests with one QA request, and Messages. Every row shows how long it has waited. Below the sections, the events line counting new events since your last look.

## 7. `attach.png` (exists)

- **Size:** 2934×1683
- **Save as:** `site/src/assets/screens/attach.png`
- **Shown on:** Docs: Sessions and harness access, top

The terminal workbench with an Implementer's Claude Code session attached in the centre: the harness's own interface exactly as Claude Code draws it, mid-task in the task's worktree. The sessions panel on the right has that session selected and expanded: role, harness, model, account and state busy.

## 8. `plan.png` (exists)

- **Size:** 2917×1677
- **Save as:** `site/src/assets/screens/plan.png`
- **Shown on:** Not currently placed

The plan view of an epic in the terminal workbench (gp on the epic): the stages in order, each with its parallel lanes of tasks and the stage's QA policy (scope and when), the stage in work marked, and the approve key shown because plan approval is the human's.

## 9. `task-card.png` (exists)

- **Size:** 2252×1683
- **Save as:** `site/src/assets/screens/task-card.png`
- **Shown on:** Docs: Items and the tracker, Acceptance criteria; Docs: Verification and release, The merge gate

The explorer with the card of a task at ready: status ready, size, parent path; every acceptance criterion with its done mark from the Implementer and its verified mark from the Reviewer, with the run id and the commit; the latest verdict, review clear, with its scope; the branch and the latest cland verify result, passed.

## 11. `artifact.png` (exists)

- **Size:** 1851×1200
- **Save as:** `site/src/assets/screens/artifact.png`
- **Shown on:** Docs: Web and phone, Threads and asks

The web workbench with a topic thread in the drawer: the Coordinator's message with an HTML artifact rendered inline in its sandboxed frame (a short report with a table), its artifact chip and id A-n above it, and the composer below.

## 13. `topics.png` (exists)

- **Size:** 1600×1200
- **Save as:** `site/src/assets/screens/topics.png`
- **Shown on:** Docs: Topics and the inbox, top

The terminal workbench with the topics panel on the right (groups needs you, open and closed, with unread badges) and a task's topic in the centre: the Coordinator's brief, a folded run of agent-to-agent messages shown as one line such as "impl-42 → rev-1 · 4 messages", a review verdict, and an ask with numbered options. The composer sits under the thread.

## Refreshing the web and phone captures

From the repository root, run `npm run build`, then
`node site/scripts/capture-screenshots.ts`. The manual capture uses the existing
Web fixture's admission check, a disposable project and its own in-process hub,
and the lockfile-pinned Chrome Headless Shell with a scratch user-data-dir. It
uses the shared sealed HOME, XDG, account and Git environment builders. All items,
messages and the Coordinator session are synthetic; it reads no live project or
real session content. No GUI browser opens.

The desktop viewport is 1600×1000 at 1.5×, producing 2400×1500 pixels. The mobile
viewport is 390×844 at 3×, producing 1170×2532 pixels. The phone image demonstrates
the responsive app, without browser chrome; it is not evidence of installation
on a physical phone. The mobile sheet offers Decline; tapping it asks for a reason.

The capture waits for Live, the selected epic's rendered card and verdict, and
the phone's exact ask sheet. It waits for fonts before capturing. Positive-control
secret scans reject planted bearer text and a planted hub secret, then check
rendered text and PNG bytes before writing. Failures keep a rejected outcome but
emit only a fixed phase diagnostic: original messages, stacks, causes, assertion
values and custom fields never reach the reporter. Navigation and fixture cleanup
use the same boundary. Pure T1 controls exercise the actual spec and TAP reporter
output with planted bearer, token and sign-in link values; run
`node --test hub/test/screenshot-capture.test.ts` without recapturing images.
The export directory contains only
`web.png`, `phone.png` and `receipt.json` (platform, browser revision/version,
dimensions and SHA-256 hashes). It excludes HOME, traces, environment files,
cookies and one-use sign-in URLs. Teardown observes the browser process group
empty and the scratch hub stopped before removing fixture directories.

Inspect both images visually, then copy only the two PNGs from
`.tmp/workbench-capture/` into `site/src/assets/screens/`. Rebuild the standalone
site with `cd site && npm run build`; confirm that the landing workbench section
and `/docs/web-and-phone/` render images rather than placeholders. Refresh the
matching descriptions in this file and `src/screens.ts` when the visible app changes.

The committed captures were made on macOS arm64 using Headless Shell
156.0.8078.4, Playwright revision 1248. No physical phone or real-device install
check was run. These captures document the interface, not a complete Web test run.
