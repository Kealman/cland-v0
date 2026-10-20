import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lintQaBrief } from '../qa-lint.ts';
import { QA_LINT_USAGE } from './usage.ts';

type Output = { out: (text: string) => void; err: (text: string) => void };

export function runQaLint(args: string[], cwd = process.cwd(), io: Output = { out: text => process.stdout.write(text), err: text => process.stderr.write(text) }): number {
  if ((args.length === 1 && ['--help', '-h'].includes(args[0]!)) || (args.length === 2 && args[0] === 'lint' && ['--help', '-h'].includes(args[1]!))) { io.out(QA_LINT_USAGE); return 0; }
  if (args.length !== 2 || args[0] !== 'lint' || args[1]!.startsWith('-')) {
    io.err(`usage: cland qa lint <brief>\n${QA_LINT_USAGE}`);
    return 2;
  }
  const path = args[1]!;
  let source: string;
  try { source = readFileSync(resolve(cwd, path), 'utf8'); }
  catch (error) { io.err(`${path}: ${error instanceof Error ? error.message : String(error)}\n`); return 2; }
  const findings = lintQaBrief(source);
  for (const finding of findings) io.err(`${path}:${finding.line}: ${finding.message}${finding.command ? `: ${finding.command}` : ''}\n`);
  if (!findings.length) io.out(`${path}: qa lint passes at the build\n`);
  return findings.length ? 1 : 0;
}
