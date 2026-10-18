// Host-side snapshot: the ratchet compares immutable refs, never a droplet's stale dev.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DURATION_MANIFEST, type DurationManifest, type TestTiming } from './suite-durations.ts';
import { TIER_MANIFEST, type Tier, type TierManifest } from './suite-shards.ts';
import type { DurationBudgetContext, SourceTestIdentity } from './suite-duration-budget.ts';

export class DurationInspectionError extends Error {
  constructor(operation: string) { super(`duration inspection failed: ${operation}`); }
}

export async function durationBase(cwd: string, head: string, env = process.env): Promise<string | undefined> {
  try { return (await promisify(execFile)('git', ['merge-base', 'origin/dev', head], { cwd, env, timeout: 30_000 })).stdout.trim(); }
  catch { return undefined; }
}

export async function durationBudgetContext(cwd: string, options: { head?: string; base?: string; env?: NodeJS.ProcessEnv; git?: (...args: string[]) => Promise<string> } = {}): Promise<DurationBudgetContext | null> {
  const git = options.git ?? (async (...args: string[]) => (await promisify(execFile)('git', args, { cwd, env: options.env ?? process.env, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout);
  const source = (path: string) => options.head ? git('show', `${options.head}:${path}`) : readFile(join(cwd, path), 'utf8');
  // A failed show cannot distinguish an absent historical path from failed I/O.
  // Only a successful tree listing can establish absence at an immutable ref.
  const optional = async (ref: string, path: string) => {
    const paths = (await git('ls-tree', '-r', '--name-only', '-z', ref, '--', path)).split('\0');
    return paths.includes(path) ? git('show', `${ref}:${path}`) : null;
  };
  const assignments = (text: string): Record<string, Tier> => Object.fromEntries(Object.entries((JSON.parse(text) as TierManifest).tests).map(([file, value]) => [file, typeof value === 'string' ? value : value.tier]));
  let manifest: DurationManifest | undefined, tiers: Record<string, Tier>;
  let operation = 'candidate duration manifest';
  try {
    const text = options.head ? await optional(options.head, DURATION_MANIFEST) : await source(DURATION_MANIFEST).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (text === null) return null;
    manifest = JSON.parse(text) as DurationManifest;
    operation = 'candidate tier manifest';
    const tierText = options.head ? await optional(options.head, TIER_MANIFEST) : await source(TIER_MANIFEST);
    if (tierText === null) { if (manifest.budget.mode === 'enforce') throw new Error('missing required tiers'); return null; }
    tiers = assignments(tierText);
  } catch {
    if (manifest && manifest.budget.mode !== 'enforce') return null;
    throw new DurationInspectionError(operation);
  }
  const context: DurationBudgetContext = { manifest, tiers };
  if (!options.base) return context;
  try {
    operation = 'base duration manifest';
    const baseText = await optional(options.base, DURATION_MANIFEST);
    if (baseText === null) return context;
    const baseManifest = JSON.parse(baseText) as DurationManifest;
    operation = 'base tier manifest';
    const baseTierText = await optional(options.base, TIER_MANIFEST);
    if (baseTierText === null) return context;
    const baseTiers = assignments(baseTierText);
    operation = 'candidate/base diff';
    const changed = new Set((await git('diff', '--name-only', '--no-renames', options.base, ...(options.head ? [options.head] : []))).trim().split('\n'));
    const retained: string[] = [];
    const sources: Record<string, SourceTestIdentity> = {};
    operation = 'test source parser';
    const ts = await import('typescript');
    const identities = (file: string, text: string, topLevel = false): SourceTestIdentity => {
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
          if (topLevel) return; // Nested test times belong to their top-level parent.
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
      operation = `base source ${file}`;
      sources[file] = identities(file, await git('show', `${options.base}:${file}`));
      operation = `candidate source ${file}`;
      const current = identities(file, await source(file));
      retained.push(...keys.filter(key => current.dynamic || current.patterns.some(pattern => new RegExp(pattern, 's').test(key.slice(file.length + 2)))));
    }
    context.base = { manifest: baseManifest, tiers: baseTiers, retained, sources };
    if (manifest.budget.mode === 'enforce') {
      context.candidateSources = {};
      for (const [file, tier] of Object.entries(tiers)) {
        if (tier !== 'T3' || (baseTiers[file] === 'T3' && !changed.has(file))) continue;
        operation = `candidate source ${file}`;
        context.candidateSources[file] = identities(file, await source(file), true);
      }
    }
  } catch {
    if (manifest.budget.mode === 'enforce') throw new DurationInspectionError(operation);
    // Report mode retains its unavailable diagnostics, never a partial snapshot.
    delete context.base;
    delete context.candidateSources;
  }
  return context;
}

export function baselineTimings(context: DurationBudgetContext, files: string[]): TestTiming[] {
  const planned = new Set(files);
  return Object.entries(context.manifest.tests).flatMap(([key, seconds]) => {
    const at = key.indexOf('::'), file = key.slice(0, at);
    return planned.has(file) ? [{ file, name: key.slice(at + 2), seconds }] : [];
  });
}
