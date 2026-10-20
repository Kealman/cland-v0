import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('./src/tokens.css', import.meta.url), 'utf8');
const tokens = new Map([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(m => [m[1]!, m[2]!]));
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
const names = ['text', 'text-strong', 'text-quiet', 'text-soft', 'muted', 'needs-human', 'watch', 'active', 'done-glyph', 'done-text', 'failed', 'link', 'link-hover', 'ask-quiet', ...[...tokens.keys()].filter(name => name.startsWith('role-'))];
for (const name of names) for (const background of ['ground', 'selection']) {
  assert.ok(tokens.has(name) && tokens.has(background), `missing ${name} or ${background}`);
  assert.ok(contrast(tokens.get(name)!, tokens.get(background)!) >= 4.5, `${name} on ${background} must reach 4.5:1`);
}
// Inverse ink is used only on its bright badge, never as text on ground/selection.
assert.ok(contrast(tokens.get('needs-human-ink')!, tokens.get('needs-human')!) >= 4.5);
assert.ok(contrast(tokens.get('link-ink')!, tokens.get('link')!) >= 4.5);
const lua = await readFile(new URL('../nvim/lua/cland/hl.lua', import.meta.url), 'utf8');
for (const [role, palette] of Object.entries({ human: 'blue', aide: 'blue', coordinator: 'teal', lead: 'teal', implementer: 'violet', reviewer: 'pink', qa: 'sky', hub: 'dim', other: 'dim' })) {
  assert.equal(tokens.get(`role-${role}`), new RegExp(`${palette} = '(#[\\da-f]{6})'`).exec(lua)?.[1], `role ${role} must match hl.lua`);
}
assert.equal(contrast('#000000', '#ffffff'), 21, 'contrast formula fixture');
console.log(`web tokens: ${names.length} text tokens ≥4.5:1 on ground and selection; role colours match hl.lua`);
