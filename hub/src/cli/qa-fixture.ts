import { parseItemReference } from '../tracker/prefixes.ts';
// `cland --qa-fixture`: a QA case's fixture project written to disk (#57). The case's Neovim
// (`nvim/lua/cland/qa.lua`) runs it before it starts the fixture's hub, with the fixture as JSON on stdin:
// `{ dir, project, items, roles, config }`. The item files come from the tracker's own writer, so a fixture
// item reads back as it was given; every path stays inside `dir`, the run's directory.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { defaultConfig, parseConfig } from '../init/config.ts';
import { kindsFor } from '../tracker/kinds.ts';
import { join, resolve, sep } from 'node:path';
import { fileNameOf, parseItem, serializeItem, STATES, type Comment, type Item, type Kind, type State } from '../tracker/item.ts';

/** The time a fixture item or comment carries when the case gives none: every run shows the same. */
export const FIXTURE_STAMP = '2026-01-01T00:00:00.000Z';
const PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

type FixtureItem = Record<string, unknown> & { id?: unknown; title?: unknown; comments?: unknown };
export type Fixture = { dir: string; project: string; items?: FixtureItem[]; roles?: string; config?: string };

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function itemOf(raw: FixtureItem, levels: readonly string[]): Item {
  const id = String(raw.id);
  if (!parseItemReference(id, [...kindsFor(levels), 'category'])) throw new Error(`the fixture's item id ${JSON.stringify(raw.id)} is not an item id`);
  const kind = (text(raw.kind) ?? 'task') as Kind;
  const kinds = kindsFor(levels);
  if (!kinds.includes(kind)) throw new Error(`${id}: unknown kind "${kind}" (one of ${kinds.join(', ')})`);
  const state = (text(raw.state) ?? 'open') as State;
  if (!STATES.includes(state)) throw new Error(`${id}: unknown state "${state}" (open or closed)`);
  const comments: Comment[] = (Array.isArray(raw.comments) ? (raw.comments as Array<Record<string, unknown>>) : []).map((c) => ({
    author: String(c.author),
    at: text(c.at) ?? FIXTURE_STAMP,
    text: String(c.text ?? ''),
  }));
  return {
    fm: {
      id,
      kind,
      ...(raw.version !== undefined ? { version: String(raw.version) } : {}),
      title: String(raw.title ?? ''),
      state,
      labels: texts(raw.labels),
      assignee: text(raw.assignee),
      parent: text(raw.parent),
      blocked_by: texts(raw.blocked_by),
      topic: text(raw.topic),
      branch: text(raw.branch),
      created: text(raw.created) ?? FIXTURE_STAMP,
      updated: text(raw.updated) ?? FIXTURE_STAMP,
    },
    body: text(raw.body) ?? '',
    comments,
  };
}

/** Write a new fixture project under `fixture.dir` and return its root. Nothing is written when any part is refused, or when the project's directory exists. */
export function writeFixture(fixture: Fixture): string {
  if (!PROJECT_NAME.test(fixture.project)) throw new Error(`the fixture's project ${JSON.stringify(fixture.project)} is not a plain directory name`);
  const root = join(resolve(fixture.dir), fixture.project);
  // a fixture is new: whatever stands at its path is not written over
  if (existsSync(root)) throw new Error(`the fixture project ${root} already exists`);
  const tasks = join(root, '.cland', 'tasks');
  const levels = (fixture.config === undefined ? defaultConfig(fixture.project) : parseConfig(fixture.config, fixture.project)).tracker.levels;
  const files = (fixture.items ?? []).map((raw) => {
    const item = itemOf(raw, levels);
    const name = fileNameOf(item.fm.id, item.fm.title);
    const path = join(tasks, name);
    if (!path.startsWith(tasks + sep)) throw new Error(`${item.fm.id}: its file ${name} would leave the fixture`);
    const content = serializeItem(item);
    parseItem(content, name, levels);
    return { path, content };
  });
  mkdirSync(tasks, { recursive: true });
  for (const f of files) writeFileSync(f.path, f.content);
  if (typeof fixture.roles === 'string') writeFileSync(join(root, '.cland', 'roles.toml'), fixture.roles);
  if (typeof fixture.config === 'string') writeFileSync(join(root, '.cland', 'config.toml'), fixture.config);
  return root;
}

/** The fixture as JSON on stdin; the root on stdout, or the refusal on stderr and exit 1. */
export async function runQaFixture(): Promise<number> {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  try {
    process.stdout.write(`${writeFixture(JSON.parse(input) as Fixture)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}
