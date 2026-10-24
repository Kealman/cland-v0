// T3: native Git commit/blob reads prove that offline lint ignores uncommitted source.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeSources } from '../src/git-tree-sources.ts';
import { lintQaBrief } from '../src/qa-lint.ts';
import ts from 'typescript';
import { CLI_ENTRY, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

test('qa lint reads named tests and selectors from the requested commit rather than the working tree', async t => {
  const root = await tempProject(t);
  const git = (...args: string[]) => execFileSync('git', ['-c', 'gc.auto=0', ...args], { cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 5000 }).trim();
  const lint = (...args: string[]) => {
    try {
      return { code: 0, stdout: execFileSync(process.execPath, [CLI_ENTRY, 'qa', 'lint', 'brief.md', ...args], { cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 10_000, stdio: 'pipe' }), stderr: '' };
    } catch (error) {
      const result = error as { status: number; stdout: string; stderr: string };
      if (result.status === null || result.status === undefined) throw error;
      return { code: result.status, stdout: result.stdout, stderr: result.stderr };
    }
  };
  await mkdir(join(root, 'web/src'), { recursive: true });
  await mkdir(join(root, 'web/test'), { recursive: true });
  await writeFile(join(root, 'web/src/Card.tsx'), '<button data-testid="old" />');
  await writeFile(join(root, 'web/test/card.test.ts'), "test('old case', () => {});");
  git('init', '-qb', 'dev');
  git('add', 'web'); git('commit', '-qm', 'Old build');
  const old = git('rev-parse', 'HEAD');
  await writeFile(join(root, 'web/src/Card.tsx'), '<button data-testid="new" />');
  await writeFile(join(root, 'web/test/card.test.ts'), "test('new case', () => {});");
  await writeFile(join(root, 'brief.md'), '`web/test/card.test.ts` test: `new case`\nSelector: `[data-testid="new"]`');
  const dirty = lint();
  assert.equal(dirty.code, 1, dirty.stderr);
  assert.match(dirty.stderr, /brief.md:1: test title.*new case.*absent/);
  assert.match(dirty.stderr, /brief.md:2: selector.*absent/);
  git('add', 'web'); git('commit', '-qm', 'New build');
  const current = lint();
  assert.equal(current.code, 0, current.stderr);
  assert.match(current.stdout, new RegExp(git('rev-parse', 'HEAD')));
  assert.equal(lint('--commit', old).code, 1);
  await writeFile(join(root, 'brief.md'), '`web/test/missing.test.ts`');
  assert.match(lint().stderr, /test file.*missing.*absent/);
  assert.equal(lint('--commit', 'not-a-commit').code, 2);
});


test('qa lint validates named titles from a production install without dev dependencies', async t => {
  const root = await tempProject(t);
  const install = join(root, 'install');
  await cp(new URL('../src/', import.meta.url), join(install, 'hub/src'), { recursive: true });
  await cp(new URL('../bin/', import.meta.url), join(install, 'hub/bin'), { recursive: true });
  await writeFile(join(install, 'package.json'), '{"type":"module"}');
  await writeFile(join(root, 'current.test.ts'), "test('installed title', () => {});");
  await writeFile(join(root, 'brief.md'), '`current.test.ts` test: `installed title`');
  const git = (...args: string[]) => execFileSync('git', ['-c', 'gc.auto=0', ...args], { cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 5000 });
  git('init', '-qb', 'dev'); git('add', 'current.test.ts'); git('commit', '-qm', 'Build');
  const entry = join(install, 'hub/bin/cland.ts');
  const output = execFileSync(process.execPath, [entry, 'qa', 'lint', 'brief.md'], { cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 10_000, stdio: 'pipe' });
  assert.match(output, /qa lint passes at the build [a-f0-9]{40}/);
});


test('committed brief corpus has no false absent file or title reports against the compiler source oracle', async t => {
  const root = await tempProject(t);
  const repo = join(root, 'corpus.git');
  const git = (...args: string[]) => execFileSync('git', ['-c', 'gc.auto=0', ...args], { cwd: root, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024 });
  // Only the scratch clone receives writes; the project is a read-only object source.
  git('clone', '--bare', '--shared', '--quiet', fileURLToPath(new URL('../../', import.meta.url)), repo);
  const dev = git('--git-dir', repo, 'for-each-ref', '--format=%(refname)', 'refs/heads/dev').trim();
  const sourceRef = dev || 'HEAD'; // Prepared executors may carry only a detached candidate.
  const sha = git('--git-dir', repo, 'rev-parse', sourceRef).trim();
  const files = git('--git-dir', repo, 'ls-tree', '-r', '--name-only', sha).trim().split('\n');
  const briefs = files.filter(file => file.startsWith('qa/briefs/') && file.endsWith('.md'));
  assert.ok(briefs.length > 0, 'committed corpus is nonempty');
  const selected = files.filter(file => briefs.includes(file) || file.startsWith('web/src/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
  const read = await treeSources(repo, sha, selected, fixtureEnvironment(root, process.env));
  const build = new Map(await Promise.all(selected.map(async file => [file, await read(file)] as const)));
  const oracle = new Map<string, Set<string>>();
  const declared = (file: string) => {
    if (oracle.has(file)) return oracle.get(file)!;
    const names = new Set<string>();
    const ast = ts.createSourceFile(file, build.get(file)!, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && /^(?:test|it|describe)(?:\.(?:only|skip|todo))?$/.test(node.expression.getText(ast))) {
        const title = node.arguments[0];
        if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) names.add(title.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast); oracle.set(file, names); return names;
  };
  const falseAbsences: string[] = [];
  let absent = 0;
  let unresolved = 0;
  let findings = 0;
  for (const brief of briefs) {
    const source = build.get(brief)!;
    const lines = source.split(/\r?\n/);
    for (const finding of lintQaBrief(source, build)) {
      findings++;
      if (/unresolved/.test(finding.message)) unresolved++;
      const missingFile = /^test file (.+) is absent/.exec(finding.message);
      if (missingFile) {
        const path = missingFile[1]!.replace(/^\.\//, '');
        if (files.some(file => file === path || !path.includes('/') && file.endsWith('/' + path))) falseAbsences.push(`${brief}:${finding.line}: ${finding.message}`);
      }
      const named = /^test title (.+) is absent/.exec(finding.message);
      if (!named) continue;
      absent++;
      const title = JSON.parse(named[1]!) as string;
      const refs = (text: string) => [...text.matchAll(/[\w./-]+\.(?:test|spec)\.[cm]?[jt]sx?/g)].flatMap(m => files.filter(file => file === m[0] || !m[0].includes('/') && file.endsWith('/' + m[0])));
      const local = refs(lines[finding.line - 1]!);
      const mentioned = refs(source);
      const scope = local.length ? local : mentioned.length ? mentioned : files.filter(file => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
      if (scope.some(file => declared(file).has(title))) falseAbsences.push(`${brief}:${finding.line}: ${finding.message}`);
    }
  }
  t.diagnostic(JSON.stringify({ commit: sha, sourceRef, briefs: briefs.length, findings, absentTitles: absent, unresolved, falseAbsentFilesOrTitles: falseAbsences.length, oracle: 'TypeScript 5.9.3 dev-only literal-call AST' }));
  assert.deepEqual(falseAbsences, []);
});
