import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { candidateTree } from '../verification-tree.ts';
import { selectPackageSuite, type SuiteRequest, type SuiteSelection } from '../suite-selection.ts';
import { lintHubShards, lintHubShardTree, ShardManifestError } from '../suite-shards.ts';
import { planTierReport, type TierPlan } from '../suite-tier-report.ts';
import { durationBase } from '../suite-duration-context.ts';

export class SuiteAdmissionError extends Error {
  readonly code = 'verify-tiers';
  readonly files: string[];
  constructor(error: unknown) {
    super(`verify-tiers: ${error instanceof Error ? error.message : String(error)}`);
    this.files = error instanceof ShardManifestError ? error.files : [];
  }
}

/** Build facts at admission; scheduler rules do not own Git or package discovery. */
export interface SuiteCandidate {
  head(cwd: string): Promise<string>;
  tree(cwd: string, head?: string): Promise<string | null>;
  inspect(cwd: string, mode: SuiteRequest, workers: number): Promise<{
    head: string; branch: string; tree: string | null; selection: SuiteSelection;
    tierPlan: TierPlan; budgetBase: string | undefined;
  }>;
}

export function suiteCandidate(env: NodeJS.ProcessEnv): SuiteCandidate {
  const git = (cwd: string, args: string[]) => promisify(execFile)('git', args, { cwd, env }).then(r => r.stdout.trim(), () => 'unknown');
  const head = (cwd: string) => git(cwd, ['rev-parse', 'HEAD']);
  const tree = (cwd: string, at?: string) => candidateTree(cwd, at, env);
  return {
    head, tree,
    async inspect(cwd, mode, workers) {
      const [at, branch, selection] = await Promise.all([head(cwd), git(cwd, ['branch', '--show-current']), selectPackageSuite(cwd, mode, env)]);
      const candidate = await tree(cwd, at);
      // Bind admission lint to both the captured commit and executing worktree.
      try {
        if (at !== 'unknown') await lintHubShardTree(cwd, at, env);
        await lintHubShards(cwd);
      } catch (error) { throw new SuiteAdmissionError(error); }
      return { head: at, branch, selection, tree: candidate,
        tierPlan: await planTierReport(cwd, selection, workers), budgetBase: await durationBase(cwd, at, env) };
    },
  };
}
