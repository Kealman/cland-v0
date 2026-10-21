// T1: the shell's public shortcut resolver, independent of layout and browser globals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shortcut } from '../../web/src/keymap.ts';

const key = (code: string, modifiers: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers,
});

test('browser tab/window chords remain unbound and area shortcuts require exact modifiers', () => {
  for (const code of ['KeyT', 'KeyW', 'KeyN']) {
    assert.equal(shortcut(key(code, { metaKey: true })), undefined);
    assert.equal(shortcut(key(code, { ctrlKey: true })), undefined);
  }
  assert.equal(shortcut(key('KeyT', { metaKey: true, shiftKey: true })), undefined);
  assert.equal(shortcut(key('Digit3')), 'Sessions');
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey']) {
    assert.equal(shortcut(key('Digit3', { [modifier]: true })), undefined);
  }
});
