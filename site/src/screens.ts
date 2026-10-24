// The screenshots of the landing and the docs, by number. SCREENSHOTS.md is the
// human-readable list of the same entries.
//
// A screenshot whose file is in src/assets/screens/ is shown as an image; until
// then, the Screenshot component shows a placeholder with the number, the target
// size and the description. Dropping the file in with the listed name is the
// whole swap: no page needs editing.
import type { ImageMetadata } from 'astro';

export interface Screen {
  /** The number on the placeholder and in SCREENSHOTS.md. */
  n: number;
  /** The file name in src/assets/screens/. */
  file: string;
  /** The target size in pixels, width × height. */
  size: string;
  /** What it must show; also the image's alt text once it exists. */
  desc: string;
}

const list: Screen[] = [
  {
    n: 1,
    file: 'hero.png',
    size: '2881×1675',
    desc: 'The cland workbench in Neovim, dark theme: on the left the items panel with a release and its epics, in the centre a topic thread with a Coordinator\'s ask waiting for an answer, and on the right the sessions panel with the plans\' limit windows and the live sessions.',
  },
  {
    n: 2,
    file: 'accounts.png',
    size: '1601×1200',
    desc: 'The cland sessions panel up close: the Accounts block on top shows two plans with their 5-hour and weekly limit windows, and the crew\'s sessions are listed below with harness, model and account.',
  },
  {
    n: 3,
    file: 'web.png',
    size: '2400×1500',
    desc: 'The browser workbench, dark. The rail on the left, the Items explorer in the centre with a release unfolded into epics and tasks, the drawer on the right with an epic\'s card: progress, plan stage, latest verdict. Inbox badge shows 2.',
  },
  {
    n: 4,
    file: 'phone.png',
    size: '1170×2532',
    desc: 'The phone workbench in a mobile viewport: the inbox, with the Coordinator\'s ask "Start epic Checkout flow?" open as a bottom sheet with Approve, Review the plan first, a free answer and Decline.',
  },
  {
    n: 5,
    file: 'explorer.png',
    size: '2940×1716',
    desc: 'The terminal workbench, dark, with the explorer in the centre: the current release unfolded into its epics and their tasks (status glyph, id, title, claim, criteria fraction on each row), and below it the folded roots Categories (Bugs, Tech debt, Follow-ups, Ideas, with counts), Unscheduled and Other releases. On the right, the card of the task under the cursor: its summary, status, size, parent path, the acceptance criteria with their marks, the latest verdict and the branch.',
  },
  {
    n: 6,
    file: 'inbox.png',
    size: '1377×800',
    desc: 'The inbox full width in the terminal workbench (Space N): Asks and approvals first, with the Coordinator\'s ask unfolded to its numbered options and the free-answer hint; then Plan approvals with one epic plan waiting, Requests with one QA request, and Messages. Every row shows how long it has waited. Below the sections, the events line counting new events since your last look.',
  },
  {
    n: 7,
    file: 'attach.png',
    size: '2934×1683',
    desc: 'The terminal workbench with an Implementer\'s Claude Code session attached in the centre: the harness\'s own interface exactly as Claude Code draws it, mid-task in the task\'s worktree. The sessions panel on the right has that session selected and expanded: role, harness, model, account and state busy.',
  },
  {
    n: 8,
    file: 'plan.png',
    size: '2917×1677',
    desc: 'The plan view of an epic in the terminal workbench (gp on the epic): the stages in order, each with its parallel lanes of tasks and the stage\'s QA policy (scope and when), the stage in work marked, and the approve key shown because plan approval is the human\'s.',
  },
  {
    n: 9,
    file: 'task-card.png',
    size: '2252×1683',
    desc: 'The explorer with the card of a task at ready: status ready, size, parent path; every acceptance criterion with its done mark from the Implementer and its verified mark from the Reviewer, with the run id and the commit; the latest verdict, review clear, with its scope; the branch and the latest cland verify result, passed.',
  },
  {
    n: 11,
    file: 'artifact.png',
    size: '1851×1200',
    desc: 'The web workbench with a topic thread in the drawer: the Coordinator\'s message with an HTML artifact rendered inline in its sandboxed frame (a short report with a table), its artifact chip and id A-n above it, and the composer below.',
  },
  {
    n: 13,
    file: 'topics.png',
    size: '1600×1200',
    desc: 'The terminal workbench with the topics panel on the right (groups needs you, open and closed, with unread badges) and a task\'s topic in the centre: the Coordinator\'s brief, a folded run of agent-to-agent messages shown as one line such as "impl-42 → rev-1 · 4 messages", a review verdict, and an ask with numbered options. The composer sits under the thread.',
  },
];

export const screens: ReadonlyMap<number, Screen> = new Map(list.map((s) => [s.n, s]));

export function getScreen(n: number): Screen {
  const screen = screens.get(n);
  if (!screen) throw new Error(`No screenshot number ${n} in src/screens.ts`);
  return screen;
}

const files = import.meta.glob<{ default: ImageMetadata }>('./assets/screens/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
});

/** The image for a screenshot, when its file exists in src/assets/screens/. */
export function findImage(screen: Screen): ImageMetadata | undefined {
  return files[`./assets/screens/${screen.file}`]?.default;
}
