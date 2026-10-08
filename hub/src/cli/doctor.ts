// `cland doctor [dir]` (spec 4.9): check the toolchain (the harnesses, gh, Neovim) and the project (the hub, its
// config, what `cland init` provisioned); one line per check, ok / warn / fail, each warn and fail naming the fix.
// Plain text, pasteable into an item comment; colour only on a terminal; --json for scripts. Exit 1 on any fail.
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkProject } from '../doctor/project.ts';
import { render, summarise } from '../doctor/report.ts';
import { checkToolchain } from '../doctor/toolchain.ts';
import { projectRoot } from '../project.ts';
import { VERSION } from '../version.ts';

export const DOCTOR_USAGE = `  doctor [dir]    check the harnesses, gh, Neovim, the hub and what cland init provisioned; one line per
                  check with the fix for each problem; exits 1 on a failure (--json for JSON)
`;

export async function runDoctor(args: string[], cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const json = args.includes('--json');
  const [dir, extra] = args.filter((a) => !a.startsWith('--'));
  if (extra !== undefined || args.some((a) => a.startsWith('--') && a !== '--json')) throw new Error('usage: cland doctor [dir] [--json]');
  const root = dir === undefined ? projectRoot(cwd) : resolve(cwd, dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`${root} is not a directory`);
  const [toolchain, project] = await Promise.all([checkToolchain(env), checkProject(root)]);
  const checks = [...toolchain, ...project];
  const summary = summarise(checks);
  if (json) process.stdout.write(`${JSON.stringify({ root, version: VERSION, checks, summary })}\n`);
  else {
    const colour = Boolean(process.stdout.isTTY) && env.NO_COLOR === undefined && env.TERM !== 'dumb';
    process.stdout.write(render(checks, `cland doctor ${VERSION} in ${root}`, colour));
  }
  return summary.fail > 0 ? 1 : 0;
}
