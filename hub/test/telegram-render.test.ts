// T1: the text conversion boundary; no sockets, processes or real clock.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainParts } from '../src/remote/telegram-render.ts';

test('Telegram text splits before the hundredth body entity and retains every style', () => {
  const parts = plainParts('agent · report', Array.from({ length: 101 }, (_, index) => `**item${index}**`).join('\n'));
  assert.equal(parts.length, 2);
  assert.equal(parts[0]!.text, `agent · report · 1/2\n${Array.from({ length: 99 }, (_, index) => `item${index}`).join('\n')}\n`);
  assert.equal(parts[1]!.text, 'agent · report · 2/2\nitem99\nitem100');
  assert.deepEqual(parts.map(part => part.entities.length), [100, 3]);
  assert.deepEqual(parts.flatMap(part => part.entities.slice(1).map(entity => part.text.slice(entity.offset, entity.offset + entity.length))),
    Array.from({ length: 101 }, (_, index) => `item${index}`));
});

test('Telegram text preserves oversized code as plain text without cutting any entity', () => {
  const body = '😀'.repeat(4100);
  const parts = plainParts('agent · report', `\`\`\`ts\n${body}\n\`\`\``);
  assert.equal(parts.length, 2);
  assert.equal(parts.map(part => part.text.slice(part.text.indexOf('\n') + 1)).join(''), body);
  for (const part of parts) {
    assert.ok([...part.text].length <= 4096);
    assert.equal(part.entities.length, 1, 'an impossible oversized style becomes plain, without clipped spans');
    assert.equal(part.text.includes('\ufffd'), false);
  }
});

test('Telegram text converts headings tables code quotes lists and links with literal offsets', () => {
  const [part] = plainParts('a · report', '# Ready\n\n| Name | State |\n| --- | --- |\n| A | OK |\n\n```ts\nlet a = 1;\n```\n\n> *fine*\n\n- [x] **done**\n[site](https://example.test)');
  assert.equal(part!.text, 'a · report\nReady\n\nName  State\nA     OK\n\nlet a = 1;\n\nfine\n\n☑ done\nsite');
  assert.deepEqual(part!.entities.map(entity => ({ type: entity.type, text: part!.text.slice(entity.offset, entity.offset + entity.length),
    ...(entity.url ? { url: entity.url } : {}), ...(entity.language ? { language: entity.language } : {}) })), [
    { type: 'bold', text: 'a · report' }, { type: 'bold', text: 'Ready' },
    { type: 'pre', text: 'Name  State\nA     OK' }, { type: 'pre', text: 'let a = 1;', language: 'ts' },
    { type: 'italic', text: 'fine' }, { type: 'blockquote', text: 'fine' }, { type: 'bold', text: 'done' },
    { type: 'text_link', text: 'site', url: 'https://example.test' },
  ]);
});

test('Telegram quoted code and links retain content without forbidden entity containment', () => {
  const [part] = plainParts('a · report', '> run `cmd`\n> see [docs](https://example.test) and *care*');
  assert.equal(part!.text, 'a · report\nrun cmd\nsee docs and care');
  assert.deepEqual(part!.entities, [
    { type: 'bold', offset: 0, length: 10 }, { type: 'code', offset: 15, length: 3 },
    { type: 'text_link', offset: 23, length: 4, url: 'https://example.test' },
    { type: 'italic', offset: 32, length: 4 },
  ]);
});

test('Telegram tables retain flag data rows instead of treating them as delimiters', () => {
  const [part] = plainParts('a · report', '| Flag | Meaning |\n| --- | --- |\n| --force | overwrite |\n| normal | keep |');
  assert.equal(part!.text, 'a · report\nFlag     Meaning\n--force  overwrite\nnormal   keep');
  assert.deepEqual(part!.entities, [{ type: 'bold', offset: 0, length: 10 }, { type: 'pre', offset: 11, length: 49 }]);
});

test('Telegram code fences preserve literal fence prefixes until a complete legal closing line', () => {
  const [part] = plainParts('a · report', '```ts\nalpha\n```not-a-close\nbeta\n~~~\n    ```\n  ````  \nafter');
  assert.equal(part!.text, 'a · report\nalpha\n```not-a-close\nbeta\n~~~\n    ```\nafter');
  assert.deepEqual(part!.entities, [{ type: 'bold', offset: 0, length: 10 }, { type: 'pre', offset: 11, length: 37, language: 'ts' }]);
  const [longer] = plainParts('a · report', '~~~~\nalpha\n~~~\nbeta\n~~~~~');
  assert.equal(longer!.text, 'a · report\nalpha\n~~~\nbeta');
  assert.deepEqual(longer!.entities, [{ type: 'bold', offset: 0, length: 10 }, { type: 'pre', offset: 11, length: 14 }]);
});
