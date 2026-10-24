import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { treeSources } from '../git-tree-sources.ts';
import { qaBriefNeedsBuild } from '../qa-lint-references.ts';
import { lintQaBrief } from '../qa-lint.ts';
import { QA_LINT_USAGE } from './usage.ts';

type Output = { out: (text: string) => void; err: (text: string) => void };

export async function runQaLint(args: string[], cwd = process.cwd(), io: Output = { out: text => process.stdout.write(text), err: text => process.stderr.write(text) }): Promise<number> {
  if ((args.length === 1 && ['--help', '-h'].includes(args[0]!)) || (args.length === 2 && args[0] === 'lint' && ['--help', '-h'].includes(args[1]!))) { io.out(QA_LINT_USAGE); return 0; }
  const commit = args.length === 4 && args[2] === '--commit' ? args[3] : args.length === 3 && args[2]!.startsWith('--commit=') ? args[2]!.slice('--commit='.length) : undefined;
  if ((args.length !== 2 && !commit) || args[0] !== 'lint' || args[1]!.startsWith('-') || commit?.startsWith('-')) {
    io.err(`usage: cland qa lint <brief>\n${QA_LINT_USAGE}`);
    return 2;
  }
  const path = args[1]!;
  let source: string;
  try { source = readFileSync(resolve(cwd, path), 'utf8'); }
  catch (error) { io.err(`${path}: ${error instanceof Error ? error.message : String(error)}\n`); return 2; }
  let build: Map<string, string> | undefined;
  let sha: string | undefined;
  if (commit || qaBriefNeedsBuild(source)) {
    try {
      const git = async (argv: string[]) => (await promisify(execFile)('git', ['-c', 'gc.auto=0', ...argv], { cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
      sha = (await git(['rev-parse', '--verify', '--end-of-options', `${commit ?? 'HEAD'}^{commit}`])).trim();
      const files = (await git(['ls-tree', '-r', '-z', '--name-only', sha])).split('\0').filter(file => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith('web/src/'));
      const read = await treeSources(cwd, sha, files);
      build = new Map(await Promise.all(files.map(async file => [file, await read(file)] as const)));
    } catch (error) {
      io.err(`${path}: cannot read build ${commit ?? 'HEAD'}: ${error instanceof Error ? error.message : String(error)}\n`);
      return 2;
    }
  }
  const findings = lintQaBrief(source, build);
  for (const finding of findings) io.err(`${path}:${finding.line}: ${finding.message}${finding.command ? `: ${finding.command}` : ''}\n`);
  if (!findings.length) io.out(`${path}: qa lint passes at the build${sha ? ` ${sha}` : ''}\n`);
  return findings.length ? 1 : 0;
}
