import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { candidateTree } from '../verification-tree.ts';
import { selectPackageSuite, type SuiteRequest, type SuiteSelection } from '../suite-selection.ts';
import { lintHubShards, lintHubShardTree, shardRefusalLocations, ShardManifestError } from '../suite-shards.ts';
import { planTierReport, type TierPlan } from '../suite-tier-report.ts';
import { testLintPolicy, TestLintError } from '../test-lint-policy.ts';
import { fetchSuiteDev } from '../suite-dev-fetch.ts';
import { durationBase } from '../suite-duration-context.ts';

export class SuiteAdmissionError extends Error {
  readonly code: 'verify-tiers' | 'verify-test-lint';
  readonly files: string[];
  constructor(error: unknown, detail = '') {
    const code = error instanceof TestLintError ? 'verify-test-lint' : 'verify-tiers';
    super(`${code}: ${error instanceof Error ? error.message : String(error)}${detail}`);
    this.code = code;
    this.files = error instanceof ShardManifestError || error instanceof TestLintError ? error.files : [];
  }
}

/** Shared CLI preflight and hub admission; report-only diagnostics are excluded. */
export async function lintSuiteCandidate(cwd: string, at: string, env: NodeJS.ProcessEnv): Promise<void> {
  let immutable = at !== 'unknown';
  try {
    if (immutable) await lintHubShardTree(cwd, at, env);
    immutable = false;
    await lintHubShards(cwd);
    if (at !== 'unknown') {
      immutable = true;
      const findings = await testLintPolicy(cwd, { tree: at, head: at, env });
      if (findings.length) throw new TestLintError(findings);
    }
    immutable = false;
    const findings = await testLintPolicy(cwd, { head: at, env });
    if (findings.length) throw new TestLintError(findings);
  } catch (error) {
    const provenance = immutable ? `HEAD ${at}` : 'worktree';
    const source = immutable
      ? async (file: string) => (await promisify(execFile)('git', ['show', `${at}:${file}`], { cwd, env, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout
      : (file: string) => readFile(join(cwd, file), 'utf8');
    const locations = error instanceof ShardManifestError ? await shardRefusalLocations(error, source) : [];
    throw new SuiteAdmissionError(error, `\nsource: ${provenance}` + (locations.length ? '\n' + locations.join('\n') : ''));
  }
}

/** Build facts at admission; scheduler rules do not own Git or package discovery. */
export interface SuiteCandidate {
  git?(cwd: string, args: string[]): Promise<string>;
  isAncestor?(cwd: string, ancestor: string, descendant: string): Promise<boolean>;
  head(cwd: string): Promise<string>;
  tree(cwd: string, head?: string): Promise<string | null>;
  inspect(cwd: string, mode: SuiteRequest, workers: number, projectTest?: SuiteSelection, fetchDev?: boolean, historicalProbe?: boolean): Promise<{
    head: string; branch: string; tree: string | null; selection: SuiteSelection;
    tierPlan: TierPlan; budgetBase: string | undefined;
  }>;
}

export function suiteCandidate(env: NodeJS.ProcessEnv): SuiteCandidate {
  const git = (cwd: string, args: string[]) => promisify(execFile)('git', args, { cwd, env }).then(r => r.stdout.trim(), () => 'unknown');
  const head = (cwd: string) => git(cwd, ['rev-parse', 'HEAD']);
  const tree = (cwd: string, at?: string) => candidateTree(cwd, at, env);
  return {
    git: (cwd, args) => promisify(execFile)('git', ['-c', 'gc.auto=0', ...args], { cwd, env, timeout: 10_000, maxBuffer: 8 * 1024 * 1024 }).then(result => result.stdout),
    head, tree,
    isAncestor: (cwd, ancestor, descendant) => promisify(execFile)('git', ['-c', 'gc.auto=0', 'merge-base', '--is-ancestor', ancestor, descendant], { cwd, env, timeout: 30_000 }).then(() => true, () => false),
    async inspect(cwd, mode, workers, projectTest, fetchDev = false, historicalProbe = false) {
      // Historical diagnostics run the candidate's own checks, not today's admission lints.
      if (projectTest || historicalProbe) {
        const [at, branch] = await Promise.all([head(cwd), git(cwd, ['branch', '--show-current'])]);
        const selection: SuiteSelection = projectTest ? { ...projectTest } : { mode: 'full', files: [], reason: 'historical probe; hosting hub lint skipped' };
        if (fetchDev) selection.fetchedDev = await fetchSuiteDev(cwd, (...args) => promisify(execFile)('git', args, { cwd, env, timeout: 30000 }).then(result => result.stdout.trim()));
        return { head: at, branch, tree: await tree(cwd, at), selection, tierPlan: [], budgetBase: undefined };
      }
      const [at, branch, selection] = await Promise.all([head(cwd), git(cwd, ['branch', '--show-current']), selectPackageSuite(cwd, mode, env)]);
      const candidate = await tree(cwd, at);
      // Bind admission lint to both the captured commit and executing worktree.
      await lintSuiteCandidate(cwd, at, env);
      return { head: at, branch, selection, tree: candidate,
        tierPlan: await planTierReport(cwd, selection, workers), budgetBase: await durationBase(cwd, at, env) };
    },
  };
}
