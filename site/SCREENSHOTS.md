# Screenshots to make

Every screenshot on the landing and in the docs, by number. Numbers 1 and 2 exist; the rest show a placeholder with the number, the size and the description until their file is there.

**How to add one.** Save the PNG under the file name below in `site/src/assets/screens/` and rebuild. The `Screenshot` component (`src/components/Screenshot.astro`) finds the file by name and shows the image in place of the placeholder, on every page that uses the number: no page needs editing. The description becomes the image's alt text. The list itself lives in `src/screens.ts`; change a description there and here together.

- **Where:** `site/src/assets/screens/<file>`.
- **Format:** PNG at the target size or larger with the same aspect ratio. Astro makes the WebP sizes at build time.
- **Look:** dark theme, the brand's colours, a real-looking project (no internal ids, people's names, e-mail addresses or local paths). Placeholders in the descriptions such as `R-1`, `T-42` or `A-n` are examples: any plausible id works.

| No. | File | Size | Pages | Status |
| --- | --- | --- | --- | --- |
| 1 | `hero.png` | 2880×1675 | Landing: hero (below the crew window); Landing: features carousel, slide 2 (Topics); Docs: The workbench | exists |
| 2 | `accounts.png` | 1600×1200 | Landing: “Get more from every plan you pay for”; Landing: features carousel, slide 5 (Accounts); Docs: Accounts and limits; Docs: Sessions and harness access | exists |
| 3 | `web.png` | 2400×1500 | Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, The layout | to make |
| 4 | `phone.png` | 1170×2532 | Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, What the phone shows | to make |
| 5 | `explorer.png` | 2400×1500 | Landing: features carousel, slide 1 (Items); Docs: Items and the tracker, top | to make |
| 6 | `inbox.png` | 2400×1500 | Landing: features carousel, slide 4 (Inbox); Docs: Topics and the inbox, The inbox | to make |
| 7 | `attach.png` | 2400×1500 | Landing: features carousel, slide 3 (Harness access); Docs: Sessions and harness access, top | to make |
| 8 | `plan.png` | 2400×1500 | Landing: features carousel, slide 6 (Plans) | to make |
| 9 | `task-card.png` | 2400×1500 | Landing: features carousel, slide 7 (Merge gate); Docs: Items and the tracker, Acceptance criteria; Docs: Verification and release, The merge gate | to make |
| 10 | `verify-queue.png` | 2400×1500 | Landing: features carousel, slide 8 (Verification); Docs: Verification and release, Running a verification | to make |
| 11 | `artifact.png` | 2400×1500 | Landing: features carousel, slide 9 (Artifacts); Docs: Web and phone, Threads and asks | to make |
| 12 | `release.png` | 2400×1500 | Landing: features carousel, slide 10 (Releases); Docs: Verification and release, Releasing | to make |
| 13 | `topics.png` | 2400×1500 | Docs: Topics and the inbox, top | to make |
| 14 | `agents-topic.png` | 2400×1500 | Docs: Topics and the inbox, The Agents topic | to make |

## 1. `hero.png` (exists)

- **Size:** 2880×1675
- **Save as:** `site/src/assets/screens/hero.png`
- **Shown on:** Landing: hero (below the crew window); Landing: features carousel, slide 2 (Topics); Docs: The workbench

The cland workbench in Neovim, dark theme: on the left the items panel with a release and its epics, in the centre a topic thread with a Coordinator's ask waiting for an answer, and on the right the sessions panel with the plans' limit windows and the live sessions.

## 2. `accounts.png` (exists)

- **Size:** 1600×1200
- **Save as:** `site/src/assets/screens/accounts.png`
- **Shown on:** Landing: “Get more from every plan you pay for”; Landing: features carousel, slide 5 (Accounts); Docs: Accounts and limits; Docs: Sessions and harness access

The cland sessions panel up close: the Accounts block on top shows two plans with their 5-hour and weekly limit windows, and the crew's sessions are listed below with harness, model and account.

## 3. `web.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/web.png`
- **Shown on:** Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, The layout

The browser workbench, dark. The rail on the left, the Items explorer in the centre with a release unfolded into epics and tasks, the drawer on the right with an epic's card: progress, plan stage, latest verdict. Inbox badge shows 2.

## 4. `phone.png`

- **Size:** 1170×2532
- **Save as:** `site/src/assets/screens/phone.png`
- **Shown on:** Landing: “In the terminal, the browser or your pocket”; Docs: Web and phone, What the phone shows

The installed phone app: the inbox, with the Coordinator's ask "Start epic Checkout flow?" open as a bottom sheet with Approve and Decline with a reason.

## 5. `explorer.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/explorer.png`
- **Shown on:** Landing: features carousel, slide 1 (Items); Docs: Items and the tracker, top

The terminal workbench, dark, with the explorer in the centre: the current release unfolded into its epics and their tasks (status glyph, id, title, claim, criteria fraction on each row), and below it the folded roots Categories (Bugs, Tech debt, Follow-ups, Ideas, with counts), Unscheduled and Other releases. On the right, the card of the task under the cursor: its summary, status, size, parent path, the acceptance criteria with their marks, the latest verdict and the branch.

## 6. `inbox.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/inbox.png`
- **Shown on:** Landing: features carousel, slide 4 (Inbox); Docs: Topics and the inbox, The inbox

The inbox full width in the terminal workbench (Space N): Asks and approvals first, with the Coordinator's ask unfolded to its numbered options and the free-answer hint; then Plan approvals with one epic plan waiting, Requests with one QA request, and Messages. Every row shows how long it has waited. Below the sections, the events line counting new events since your last look.

## 7. `attach.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/attach.png`
- **Shown on:** Landing: features carousel, slide 3 (Harness access); Docs: Sessions and harness access, top

The terminal workbench with an Implementer's Claude Code session attached in the centre: the harness's own interface exactly as Claude Code draws it, mid-task in the task's worktree. The sessions panel on the right has that session selected and expanded: role, harness, model, account and state busy.

## 8. `plan.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/plan.png`
- **Shown on:** Landing: features carousel, slide 6 (Plans)

The plan view of an epic in the terminal workbench (gp on the epic): the stages in order, each with its parallel lanes of tasks and the stage's QA policy (scope and when), the stage in work marked, and the approve key shown because plan approval is the human's.

## 9. `task-card.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/task-card.png`
- **Shown on:** Landing: features carousel, slide 7 (Merge gate); Docs: Items and the tracker, Acceptance criteria; Docs: Verification and release, The merge gate

The explorer with the card of a task at ready: status ready, size, parent path; every acceptance criterion with its done mark from the Implementer and its verified mark from the Reviewer, with the run id and the commit; the latest verdict, review clear, with its scope; the branch and the latest cland verify result, passed.

## 10. `verify-queue.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/verify-queue.png`
- **Shown on:** Landing: features carousel, slide 8 (Verification); Docs: Verification and release, Running a verification

The verification queue view (Enter on the sessions panel's verify line): the local run in progress with its task and elapsed time, two runs on cloud machines with their size and region, and the runs waiting with their admission estimate.

## 11. `artifact.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/artifact.png`
- **Shown on:** Landing: features carousel, slide 9 (Artifacts); Docs: Web and phone, Threads and asks

The web workbench with a topic thread in the drawer: the Coordinator's message with an HTML artifact rendered inline in its sandboxed frame (a short report with a table), its artifact chip and id A-n above it, and the composer below.

## 12. `release.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/release.png`
- **Shown on:** Landing: features carousel, slide 10 (Releases); Docs: Verification and release, Releasing

A terminal running cland release --item R-1 --dry-run: the release notes it would publish (the release's Notes, each epic with its one-line goal, one line per merged task) and the refs: the tag v0.1.0 at dev, and dev pushed as GitHub main.

## 13. `topics.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/topics.png`
- **Shown on:** Docs: Topics and the inbox, top

The terminal workbench with the topics panel on the right (groups needs you, open and closed, with unread badges) and a task's topic in the centre: the Coordinator's brief, a folded run of agent-to-agent messages shown as one line such as "impl-42 → rev-1 · 4 messages", a review verdict, and an ask with numbered options. The composer sits under the thread.

## 14. `agents-topic.png`

- **Size:** 2400×1500
- **Save as:** `site/src/assets/screens/agents-topic.png`
- **Shown on:** Docs: Topics and the inbox, The Agents topic

The Agents topic in the terminal workbench (Space L): the read-only record of agent-to-agent messages, review requests and verdict reports between sessions, and session lifecycle events (launched, stopped, role assigned), each with its time and sender in the role's colour.
