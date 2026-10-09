// The instructions every harness reads (spec 4.9, decision #17): `AGENTS.md` with cland's managed block, the
// `@AGENTS.md` import in an existing `CLAUDE.md` (cland never creates one: its presence stops Claude Code from
// reading `AGENTS.md`), and the `docs/agents/*` files the skills read. Their text is in `skills/templates/`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANAGED_BY } from '../project.ts';
import { isManagedFile, readText, refuseSymlink, writeIfChanged, type Report } from './files.ts';
import { territoryPath } from '../territory.ts';

export const TEMPLATES = fileURLToPath(new URL('../../../skills/templates/', import.meta.url));

/** The `docs/agents/*` files cland provisions, by their path in the project (and under `skills/templates/`). */
export const DOCS = ['docs/agents/issue-tracker.md', 'docs/agents/domain.md', 'docs/agents/triage-labels.md'] as const;

export const BLOCK_BEGIN = `<!-- cland:begin ${MANAGED_BY} — cland init and cland update rewrite this block; write your own instructions outside it -->`;
export const BLOCK_END = '<!-- cland:end -->';
const BLOCK = /<!-- cland:begin\b[^\n]*-->\n[\s\S]*?<!-- cland:end -->/;

/** The managed block of `AGENTS.md`, markers included. */
export const agentsBlock = (territory = false): string => {
  let text = readFileSync(join(TEMPLATES, 'AGENTS.block.md'), 'utf8').trimEnd();
  if (territory) text = text.replace(/- \*\*Push to GitHub[^\n]*/, '- **Only cland release pushes to GitHub:** only `cland release` pushes to `github`. Commit on your task branch; push it to the local territory (`origin`). Task work reaches `dev` through `cland merge`; `main` moves through `cland release` and `cland sync`.');
  return `${BLOCK_BEGIN}\n${text}\n${BLOCK_END}`;
};

/** `AGENTS.md`: the block written in place, appended to a file without it, or the whole file when there is none. */
export function provisionAgentsMd(report: Report, root: string): void {
  const path = join(root, 'AGENTS.md');
  if (refuseSymlink(report, path)) return;
  const current = readText(path);
  const block = agentsBlock(existsSync(territoryPath(root)));
  if (current === null) return writeIfChanged(report, path, `${block}\n`, null);
  if (BLOCK.test(current)) return writeIfChanged(report, path, current.replace(BLOCK, () => block), current);
  if (current.includes('<!-- cland:begin')) {
    report.add(path, 'kept', 'a cland:begin marker without its cland:end: fix the block by hand or remove it');
    return;
  }
  const sep = current === '' ? '' : current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  writeIfChanged(report, path, `${current}${sep}${block}\n`, current);
}

const IMPORT_MARK = `<!-- ${MANAGED_BY}: Claude Code reads AGENTS.md only through this import while CLAUDE.md exists -->`;
const OUR_IMPORT = /<!-- managed by cland\b[^\n]*-->\n@AGENTS\.md[ \t]*(?=\n|$)/;

/** An existing `CLAUDE.md` imports `AGENTS.md` (one managed line with its mark); none is ever created. */
export function provisionClaudeMd(report: Report, root: string): void {
  const path = join(root, 'CLAUDE.md');
  if (refuseSymlink(report, path)) return;
  const current = readText(path);
  if (current === null) return;
  const ours = `${IMPORT_MARK}\n@AGENTS.md`;
  if (OUR_IMPORT.test(current)) return writeIfChanged(report, path, current.replace(OUR_IMPORT, () => ours), current);
  if (/^@AGENTS\.md[ \t]*$/m.test(current)) {
    report.add(path, 'kept', 'imports AGENTS.md already');
    return;
  }
  const sep = current === '' ? '' : current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  writeIfChanged(report, path, `${current}${sep}${ours}\n`, current);
}

/** `docs/agents/*`: the templates with the mark as their first line; a file without the mark is the project's. */
export function provisionDocs(report: Report, root: string): void {
  for (const rel of DOCS) {
    const path = join(root, rel);
    if (refuseSymlink(report, path)) continue;
    const current = readText(path);
    if (current !== null && !isManagedFile(current)) {
      report.add(path, 'kept', 'no "managed by cland" mark: the project\'s own (compare it with cland\'s template, or delete it and run cland update)');
      continue;
    }
    const text = `<!-- ${MANAGED_BY}: cland update rewrites this file; remove this line to take it over -->\n${readFileSync(join(TEMPLATES, rel), 'utf8')}`;
    writeIfChanged(report, path, text, current);
  }
}
