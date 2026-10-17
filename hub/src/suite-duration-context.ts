// Host-side snapshot: the ratchet compares immutable refs, never a droplet's stale dev.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DURATION_MANIFEST, type DurationManifest, type TestTiming } from './suite-durations.ts';
import { TIER_MANIFEST, type Tier, type TierManifest } from './suite-shards.ts';
import type { DurationBudgetContext, SourceTestIdentity } from './suite-duration-budget.ts';

export async function durationBase(cwd: string, head: string, env = process.env): Promise<string | undefined> {
  try { return (await promisify(execFile)('git', ['merge-base', 'origin/dev', head], { cwd, env, timeout: 30_000 })).stdout.trim(); }
  catch { return undefined; }
}

export async function durationBudgetContext(cwd: string, options: { head?: string; base?: string; env?: NodeJS.ProcessEnv } = {}): Promise<DurationBudgetContext | null> {
  const git = async (...args: string[]) => (await promisify(execFile)('git', args, { cwd, env: options.env ?? process.env, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  const source = (path: string) => options.head ? git('show', `${options.head}:${path}`) : readFile(join(cwd, path), 'utf8');
  const assignments = (text: string): Record<string, Tier> => Object.fromEntries(Object.entries((JSON.parse(text) as TierManifest).tests).map(([file, value]) => [file, typeof value === 'string' ? value : value.tier]));
  let manifest: DurationManifest, tiers: Record<string, Tier>;
  try { manifest = JSON.parse(await source(DURATION_MANIFEST)); tiers = assignments(await source(TIER_MANIFEST)); }
  catch { return null; }
  const context: DurationBudgetContext = { manifest, tiers };
  if (!options.base) return context;
  try {
    const baseManifest = JSON.parse(await git('show', `${options.base}:${DURATION_MANIFEST}`)) as DurationManifest;
    const baseTiers = assignments(await git('show', `${options.base}:${TIER_MANIFEST}`));
    const changed = new Set((await git('diff', '--name-only', '--no-renames', options.base, ...(options.head ? [options.head] : []))).trim().split('\n'));
    const retained: string[] = [];
    const sources: Record<string, SourceTestIdentity> = {};
    const ts = await import('typescript');
    const identities = (file: string, text: string): SourceTestIdentity => {
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const patterns: string[] = [];
      let dynamic = false;
      const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const visit = (node: import('typescript').Node) => {
        if (ts.isCallExpression(node) && /^(?:test|it|describe)(?:\.(?:skip|todo|only))?$/.test(node.expression.getText(ast))) {
          const title = node.arguments[0];
          if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) patterns.push(`^${escape(title.text)}$`);
          else if (title && ts.isTemplateExpression(title)) patterns.push(`^${escape(title.head.text)}${title.templateSpans.map(span => `.*?${escape(span.literal.text)}`).join('')}$`);
          else dynamic = true;
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      return { patterns, dynamic };
    };
    // Source coverage includes base files absent from the timing manifest.
    // Byte-identical files require no title inference; changed files compare
    // both pinned sources, retaining unresolved dynamic titles conservatively.
    for (const [file, tier] of Object.entries(baseTiers)) {
      if (tier !== 'T3' || tiers[file] !== 'T3') continue;
      const keys = Object.keys(baseManifest.tests).filter(key => key.startsWith(file + '::'));
      if (!changed.has(file)) {
        sources[file] = { patterns: [], dynamic: false, unchanged: true };
        retained.push(...keys);
        continue;
      }
      sources[file] = identities(file, await git('show', `${options.base}:${file}`));
      const current = identities(file, await source(file));
      retained.push(...keys.filter(key => current.dynamic || current.patterns.some(pattern => new RegExp(pattern, 's').test(key.slice(file.length + 2)))));
    }
    context.base = { manifest: baseManifest, tiers: baseTiers, retained, sources };
  } catch { /* A missing baseline reports unavailable; it never changes an exit. */ }
  return context;
}

export function baselineTimings(context: DurationBudgetContext, files: string[]): TestTiming[] {
  const planned = new Set(files);
  return Object.entries(context.manifest.tests).flatMap(([key, seconds]) => {
    const at = key.indexOf('::'), file = key.slice(0, at);
    return planned.has(file) ? [{ file, name: key.slice(at + 2), seconds }] : [];
  });
}
