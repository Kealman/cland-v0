import { requireTypeScript } from './typescript-capability.ts';
import type { SourceTestIdentity } from './suite-duration-budget.ts';
import type { DurationManifest } from './suite-durations.ts';

/** Literal/template titles are provable; computed titles remain uncertain. */
export async function sourceTestIdentities(file: string, text: string, topLevel = false): Promise<SourceTestIdentity> {
  const ts = requireTypeScript('duration source identities');
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
      if (topLevel) return; // Nested times belong to their parent.
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { patterns, dynamic };
}

/** The reader belongs to the boundary: checkout or immutable Git candidate. */
export async function lintDurationIdentities(manifest: DurationManifest, source: (file: string) => Promise<string | undefined>): Promise<void> {
  const identities = new Map<string, SourceTestIdentity | undefined>();
  for (const key of Object.keys(manifest.tests)) if (!key.includes('::')) throw new Error(`duration key has no matching test identity: ${key}`);
  for (const key of new Set([...Object.keys(manifest.files), ...Object.keys(manifest.tests), ...Object.keys(manifest.allow).filter(key => key !== 'T3')])) {
    const split = key.indexOf('::');
    const file = split < 0 ? key : key.slice(0, split);
    if (!identities.has(file)) {
      const text = await source(file);
      identities.set(file, text === undefined ? undefined : await sourceTestIdentities(file, text));
    }
    const identity = identities.get(file);
    if (!identity || (split >= 0 && !identity.dynamic && !identity.patterns.some(pattern => new RegExp(pattern, 's').test(key.slice(split + 2))))) {
      throw new Error(`duration key has no matching test identity: ${key}`);
    }
  }
}
