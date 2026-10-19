// `cland init` and `cland update` (spec 4.9, decision #17): what cland provisions into a project, idempotently.
// Every managed file or block carries "managed by cland <version>"; a file without the mark is the project's own and
// is never written. Running it again changes nothing; after a version change it rewrites the managed parts only.
//
//   .cland/.gitignore, config.toml, crew.toml, roles.toml and RULES.md (written once, then the human's), tasks/.gitkeep
//   init's four root categories in tasks/, through the tracker, before the first commit
//   the General and Agents topics, in .cland/hub.db (not committed), through the store: no hub is needed
//   .agents/skills/<name>/ and its manifest, .claude/skills (a symlink, or one per skill in the project's own folder)
//   docs/agents/issue-tracker.md, domain.md, triage-labels.md
//   AGENTS.md's managed block, the @AGENTS.md import of an existing CLAUDE.md
//   the cland hooks and worktree.bgIsolation = "none" in .claude/settings.json, so background sessions edit the
//   working copy without EnterWorktree; settings.local.json can override it and is never read or written
//
// The territory runs first: root cleanliness must be checked before generated files appear.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS, GENERAL } from '../hub/core.ts';
import { Store } from '../hub/store.ts';
import { Tracker } from '../tracker/tracker.ts';
import { DEFAULT_CATEGORIES } from '../tracker/categories.ts';
import { GITIGNORE, MANAGED_BY, layout } from '../project.ts';
import { DEFAULT_CREW_TOML } from '../crew.ts';
import { RULEBOOK_HEADER } from '../rules/rulebook.ts';
import { rolesTemplate } from '../roles/template.ts';
import { installedHarnesses } from '../doctor/harnesses.ts';
import { provisionClaudeSettings } from './claude-settings.ts';
import { provisionConfig, readProjectConfig } from './config.ts';
import { isManagedFile, readText, refuseSymlink, Report, writeIfChanged, type Change } from './files.ts';
import { provisionAgentsMd, provisionClaudeMd, provisionDocs } from './instructions.ts';
import { provisionClaudeSkills, provisionSkills, SKILLS_SOURCE } from './skills.ts';
import { provisionTerritory } from '../territory.ts';
import { commitClandFiles, createRepository, foldReport } from './repository.ts';

export type ProvisionOptions = {
  /** Where the shipped skills are read from; this repository's `.agents/skills/` unless a test says otherwise. */
  skillsSource?: string;
  /** Harness discovery is isolated from the host in fixture and setup callers. */
  env?: NodeJS.ProcessEnv;
  /** Update refreshes an existing territory, but does not opt a project into one. Init does. */
  territory?: boolean;
  /** Only init may create a repository and its first commit; update never does. */
  repository?: boolean;
  /** Init seeds the root categories; update only refreshes managed files. */
  categories?: boolean;
};

export const TASKS_KEEP = `# ${MANAGED_BY}: keeps .cland/tasks/ in git until it holds an item\n`;

/** Provision `root`; returns what was done to each path. */
export async function provision(root: string, options: ProvisionOptions = {}): Promise<Change[]> {
  const report = new Report(root);
  const l = layout(root);
  const createdRepository = options.territory !== false && options.repository !== false && createRepository(report, root);
  mkdirSync(l.dir, { recursive: true });
  if (options.territory !== false) provisionTerritory(report, root);

  // .cland/: the managed .gitignore (the hub's own rule: rewritten while marked), config, roles, tasks
  const ignore = readText(l.gitignore);
  if (ignore !== null && !isManagedFile(ignore)) report.add(l.gitignore, 'kept', 'no "managed by cland" mark: the project\'s own');
  else writeIfChanged(report, l.gitignore, GITIGNORE, ignore);
  provisionConfig(report, l.config, root);
  if (existsSync(l.roles)) report.add(l.roles, 'unchanged', 'written once with the defaults, then the human\'s: cland never rewrites it');
  else {
    const installed = installedHarnesses(options.env ?? process.env);
    writeIfChanged(report, l.roles, rolesTemplate(installed), null);
    if (!installed.length) {
      const change = report.changes.find(change => change.path === '.cland/roles.toml' && change.action === 'created');
      if (change) change.note = 'no harness was found; wrote the shipped harness mapping';
    }
  }
  if (existsSync(l.crew)) report.add(l.crew, 'unchanged', 'project staffing: cland never rewrites it');
  else writeIfChanged(report, l.crew, DEFAULT_CREW_TOML, null);
  if (existsSync(l.rules)) report.add(l.rules, 'unchanged', 'project rulebook: cland never rewrites it');
  else writeIfChanged(report, l.rules, RULEBOOK_HEADER, null);
  const keep = join(l.tasks, '.gitkeep');
  const keepText = readText(keep);
  if (keepText !== null && keepText !== '' && !isManagedFile(keepText)) report.add(keep, 'kept', 'the project\'s own');
  else writeIfChanged(report, keep, TASKS_KEEP, keepText);

  // the standing topics, as the hub creates them at its first start
  const store = new Store(l.db);
  try {
    const had = store.topic(GENERAL.id) !== null && store.topic(AGENTS.id) !== null;
    const now = new Date().toISOString();
    for (const t of [GENERAL, AGENTS]) store.ensureTopic(t.id, t.title, true, now);
    report.add(l.db, had ? 'unchanged' : 'created', 'the General and Agents topics');
  } finally {
    store.close();
  }

  if (options.categories && !refuseSymlink(report, l.tasks)) {
    const config = readProjectConfig(l.config, root, undefined, options.env);
    const tracker = new Tracker({ root, db: l.db, env: options.env ?? process.env, ...(config ? { levels: config.tracker.levels } : {}) });
    try {
      if (!tracker.ladder.roots.includes('category')) {
        report.add(l.tasks, 'unchanged', 'categories skipped: the ladder has no root category');
      } else {
        tracker.rescan();
        const present = tracker.list({ kind: 'category', state: 'open' }).filter(item => item.parent === null);
        let created = false;
        for (const title of DEFAULT_CATEGORIES) {
          const existing = present.find(item => item.title === title);
          if (existing) {
            report.add(join(l.tasks, existing.file), 'unchanged', `category ${title}`);
            continue;
          }
          const item = await tracker.create({ id: 'cland-init', name: 'cland init', role: null, human: true }, { kind: 'category', title });
          report.add(join(root, item.path), 'created', `category ${title}`);
          created = true;
        }
        if (!created) report.add(l.tasks, 'unchanged', 'the four categories are present');
      }
    } finally {
      await tracker.stop();
    }
  }

  const managed = provisionSkills(report, root, options.skillsSource ?? SKILLS_SOURCE);
  provisionClaudeSkills(report, root, managed);
  provisionDocs(report, root);
  provisionAgentsMd(report, root);
  provisionClaudeMd(report, root);
  provisionClaudeSettings(report, root);
  if (createdRepository) {
    commitClandFiles(report, root);
    const again = new Report(root);
    provisionTerritory(again, root);
    foldReport(report, again);
  }
  return report.changes;
}
