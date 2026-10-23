// T1: documentation contracts; source inventory only, no CLI, sockets or processes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { defaultConfig, parseConfig } from '../src/init/config.ts';

const hubReadme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const webReadme = readFileSync(new URL('../../web/README.md', import.meta.url), 'utf8');

// Grep feature deferrals, not live request/approval states or the human's named
// stand-in attribution. Those words remain valid protocol and fixture terms.
function staleFeatureWording(text: string): string[] {
  const features = '(?:web(?: workbench| shell| edge)?|workbench|Inbox|Items|Sessions|Topics|Events|Artifacts|Accounts|phone|notifications?|composer|palette|drawer|split|Board|Graph|Plan|criteria|install(?:ation)?)';
  const stale = new RegExp(`\\b(?:not yet|later ticket)\\b|\\b${features} (?:(?:is|are|remains?|stays?) (?:a )?(?:stand-in|pending)\\b|(?:stand-in|pending)[.!])|\\bpending (?:implementation|a later ticket)\\b`, 'i');
  return text.split(/\n\s*\n/).map(paragraph => paragraph.replace(/\s+/g, ' ')).filter(paragraph =>
    stale.test(paragraph.replace(/not yet reported|does not yet list|not yet indexed/gi, 'awaiting observation')));
}

test('README grep rejects stale feature wording and keeps operational pending states', () => {
  for (const text of ['The web shell is not yet wired.', 'Events belongs to a later ticket.', 'Inbox is a stand-in.', 'Notifications are pending.']) {
    assert.equal(staleFeatureWording(text).length, 1, text);
  }
  assert.deepEqual(staleFeatureWording('A pending approval waits for the human.\n\nThe human stand-in answers the ask.\n\nItems pending plans.'), []);
  for (const [name, text] of [['web/README.md', webReadme], ['hub/README.md', hubReadme]]) {
    assert.deepEqual(staleFeatureWording(text!), [], `${name} must describe shipped features`);
  }
});

function property(object: ts.ObjectLiteralExpression, name: string): ts.Expression {
  const field = object.properties.find(field => ts.isPropertyAssignment(field) && field.name.getText().replace(/['"]/g, '') === name);
  assert.ok(field && ts.isPropertyAssignment(field), `parser must declare ${name}`);
  return field.initializer;
}

test('hub README documents exactly the web parser options, including short aliases', () => {
  const source = ts.createSourceFile('web.ts', readFileSync(new URL('../src/cli/web.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const accepted: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'parseArgs') {
      const argument = node.arguments[0];
      assert.ok(argument && ts.isObjectLiteralExpression(argument));
      const options = property(argument, 'options');
      assert.ok(ts.isObjectLiteralExpression(options));
      for (const option of options.properties) {
        assert.ok(ts.isPropertyAssignment(option) && ts.isObjectLiteralExpression(option.initializer));
        accepted.push(`--${option.name.getText(source).replace(/['"]/g, '')}`);
        for (const field of option.initializer.properties) {
          if (ts.isPropertyAssignment(field) && field.name.getText(source) === 'short') {
            assert.ok(ts.isStringLiteral(field.initializer));
            accepted.push(`-${field.initializer.text}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(accepted.length > 0, 'inventory must find the actual parseArgs call');
  const section = hubReadme.split('### cland web options\n')[1]?.split('\n### ')[0];
  assert.ok(section, 'one complete web option reference belongs in hub/README.md');
  const documented = [...new Set(section.match(/--[a-z][a-z-]*|(?<![-\w])-h\b/g))];
  assert.deepEqual(documented.sort(), accepted.sort());
});

test('hub README documents exactly the accepted web config keys and executable values', () => {
  const section = hubReadme.split('### [web] configuration\n')[1]?.split('\n### ')[0];
  assert.ok(section, 'one complete web config reference belongs in hub/README.md');
  const documented = [...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map(match => match[1]!);
  const source = readFileSync(new URL('../src/init/config.ts', import.meta.url), 'utf8');
  const accepted = [...new Set([...source.matchAll(/\bweb\.([a-z_]+) !== undefined/g)].map(match => match[1]!))];
  assert.ok(accepted.length > 0);
  assert.deepEqual(documented.sort(), accepted.sort(), 'no missing or invented keys');
  assert.deepEqual(documented.sort(), Object.keys(defaultConfig('fixture').web).sort(), 'defaults and parser inventory agree');
  const snippets = [...section.matchAll(/```toml\n([\s\S]*?)```/g)];
  assert.equal(snippets.length, 1);
  const parsed = parseConfig(snippets[0]![1]!, 'fixture', {}, { strict: true });
  assert.deepEqual(Object.keys(parsed.web).sort(), documented.sort());
  for (const key of documented) assert.match(section, new RegExp(`^\\| \x60${key}\x60 \\| .+ \\| .+ \\|$`, 'm'), 'each key has a default and a description');
});
