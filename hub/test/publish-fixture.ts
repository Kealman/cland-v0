// In-memory Git adapter for the marketing publication component. Literal fixture commits
// model a released base, private dev work and two marketing commits; no process starts.
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { tempProject } from './harness.ts';
import { defaultConfig } from '../src/init/config.ts';
import { publishGit } from '../src/territory-publish.ts';
import { territoryPath, type territoryGitAsync } from '../src/territory.ts';

export const tips = { base: '1'.repeat(40), private: '2'.repeat(40), first: '3'.repeat(40), source: '4'.repeat(40), publicFirst: '5'.repeat(40), public: '6'.repeat(40), mergedSource: '7'.repeat(40), dev: '8'.repeat(40) };
const resumed = <T>(work: () => T): T => work();

export async function publishFixture(t: TestContext) {
  const root = await tempProject(t, 'cland-publish-component-');
  const territory = territoryPath(root), github = join(root, 'fake-github');
  await mkdir(territory, { recursive: true });
  const rootRefs = new Map([['refs/heads/main', tips.base], ['refs/heads/dev', tips.private], ['refs/heads/marketing', tips.source]]);
  const territoryRefs = new Map([['refs/heads/main', tips.base], ['refs/heads/dev', tips.private]]);
  const githubRefs = new Map([['refs/heads/main', tips.base], ['refs/heads/site', tips.base]]);
  const repos = new Map([[root, rootRefs], [territory, territoryRefs], [github, githubRefs]]);
  const scratchHeads = new Map<string, string>();
  const changed = new Map([[tips.first, ['site/index.html']], [tips.source, ['site/style.css']]]);
  let index = `${tips.private}-tree`;
  const faults = { rejectPush: false, loseReply: false, localRefs: false };
  let pushes = 0;
  const run: typeof territoryGitAsync = async (cwd, rawArgs, _marked, input) => {
    const args = [...rawArgs];
    while (args[0] === '-c') args.splice(0, 2);
    const refs = repos.get(cwd);
    switch (args[0]) {
      case 'config': return args.at(-1) === 'cland.managed' ? 'true' : 'main';
      case 'symbolic-ref': return args.includes('--short') ? 'dev' : 'refs/heads/dev';
      case 'status': case 'check-ref-format': case 'fetch': case 'diff-files': case 'ls-files': return '';
      case 'remote': return github;
      case 'ls-remote': return [...githubRefs].filter(([ref]) => args.includes(ref)).map(([ref, sha]) => `${sha}\t${ref}`).join('\n');
      case 'merge-base': return ''; // Every ancestry check in this fixture is true.
      case 'rev-list': return `${tips.first}\n${tips.source}`;
      case 'show':
        if (args.includes('--format=%P')) return args.at(-1) === tips.first ? tips.private : tips.first;
        if (args.includes('--format=%cI')) return '2026-10-20T00:00:00+00:00';
        return args.at(-1) === tips.first ? 'First marketing change' : 'Second marketing change';
      case 'diff-tree': return changed.get(args.at(-1)!)!.join('\0') + '\0';
      case 'rev-parse': {
        if (args.includes('--git-path')) return args.filter((_, i) => args[i - 1] === '--git-path').map(path => `.git/${path}`).join('\n');
        const name = args.at(-1)!;
        if (name === 'HEAD') return scratchHeads.get(cwd)!;
        if (name.endsWith('^{tree}')) return `${name.slice(0, -7)}-tree`;
        const sha = refs?.get(name);
        assert.ok(sha, `unknown fixture ref ${cwd}: ${name}`);
        return sha;
      }
      case 'worktree':
        if (args[1] === 'list') return 'branch refs/heads/dev\0';
        if (args[1] === 'add') scratchHeads.set(args.at(-2)!, args.at(-1)!);
        if (args[1] === 'remove') { scratchHeads.delete(args.at(-1)!); await rm(args.at(-1)!, { recursive: true, force: true }); }
        return '';
      case 'cherry-pick': scratchHeads.set(cwd, args.at(-1) === tips.first ? tips.publicFirst : tips.public); return '';
      case 'checkout': scratchHeads.set(cwd, args.at(-1)!); return '';
      case 'merge': scratchHeads.set(cwd, args.at(-1) === tips.source ? tips.mergedSource : tips.dev); return '';
      case 'write-tree': return index;
      case 'read-tree': index = `${args.at(-1)!}-tree`; return '';
      case 'update-ref':
        if (faults.localRefs) throw new Error('fixture ref lock');
        if (args[1] === '--stdin') for (const line of input!.split('\n')) {
          const [command, ref, sha] = line.split(' ');
          if (command === 'update') rootRefs.set(ref!, sha!);
        }
        else rootRefs.set(args[1]!, args[2]!);
        return '';
      case 'push': {
        const target = args.includes(github) ? githubRefs : territoryRefs;
        if (target === githubRefs) {
          pushes++;
          if (faults.rejectPush) throw new Error('fixture atomic push rejected');
        }
        for (const arg of args) {
          const match = /^([a-f0-9]{40}):(refs\/heads\/.+)$/.exec(arg);
          if (match) target.set(match[2]!, match[1]!);
        }
        if (target === githubRefs && faults.loseReply) { faults.loseReply = false; throw new Error('fixture lost push reply'); }
        return '';
      }
      default: throw new Error(`unexpected fixture Git: ${args.join(' ')}`);
    }
  };
  const publish = (dryRun = false, allowPaths = defaultConfig('').publish.allowPaths, item = 'T-1') => publishGit(root, 'marketing', item, dryRun, allowPaths, resumed, () => {}, {}, run);
  return { root, rootRefs, territoryRefs, githubRefs, changed, faults, publish, pushes: () => pushes };
}
