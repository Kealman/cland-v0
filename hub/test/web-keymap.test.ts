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
  assert.equal(shortcut(key('ArrowLeft')), 'fold-close');
  assert.equal(shortcut(key('ArrowRight')), 'fold-open');
  assert.equal(shortcut(key('ArrowLeft', { shiftKey: true })), undefined);
  for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey']) {
    assert.equal(shortcut(key('Digit3', { [modifier]: true })), undefined);
  }
});

test('focused contexts resolve before shell keys without changing Items or Plan chords', () => {
  assert.equal(shortcut(key('KeyD'), false, 'items'), 'plan-discuss');
  assert.equal(shortcut(key('KeyD'), false, 'sessions'), 'session-archive');
  assert.equal(shortcut(key('KeyK'), false, 'items'), 'tree-previous');
  assert.equal(shortcut(key('KeyK'), false, 'artifacts'), 'artifact-keep');
  assert.equal(shortcut(key('Enter'), false, 'composer'), 'composer-send');
  assert.equal(shortcut(key('Enter', { shiftKey: true }), false, 'composer'), 'composer-newline');
  assert.equal(shortcut(key('Enter', { metaKey: true }), false, 'composer'), 'composer-send-always');
  for (const context of ['shell', 'items', 'sessions', 'artifacts', 'composer'] as const) {
    assert.equal(shortcut(key('KeyK', { metaKey: true }), false, context), 'palette');
    for (const modifier of ['ctrlKey', 'altKey', 'shiftKey']) {
      assert.equal(shortcut(key('KeyD', { [modifier]: true, metaKey: true }), false, context), undefined);
    }
  }
  const existing = {
    KeyA: 'plan-approve', KeyD: 'plan-discuss', KeyS: 'tree-scope', KeyG: 'jump-leader',
    KeyX: 'tree-select', 'Shift+KeyJ': 'tree-extend-next', 'Shift+KeyK': 'tree-extend-previous',
    KeyM: 'tree-message', 'Shift+KeyM': 'tree-topic-message', KeyE: 'tree-edit-criteria',
    KeyJ: 'tree-next', KeyK: 'tree-previous', KeyL: 'tree-open', KeyH: 'tree-close',
    KeyZ: 'tree-leader', 'Shift+KeyD': 'tree-done', 'Shift+KeyA': 'tree-archive', Enter: 'accept',
  };
  for (const [chord, action] of Object.entries(existing)) {
    assert.equal(shortcut(key(chord.replace('Shift+', ''), { shiftKey: chord.startsWith('Shift+') }), false, 'items'), action, chord);
  }
  for (const [prefix, code, action] of [
    [true, 'Space', 'tree-back'], ['KeyG', 'KeyI', 'jump-item'], ['KeyG', 'KeyT', 'jump-topic'],
    ['KeyG', 'KeyS', 'jump-session'], ['KeyZ', 'KeyA', 'tree-toggle'],
  ] as const) assert.equal(shortcut(key(code), prefix, 'items'), action);
  for (const [index, area] of ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'].entries()) {
    assert.equal(shortcut(key(`Digit${index + 1}`), false, 'shell'), area);
    assert.equal(shortcut(key(`Digit${index + 1}`, { shiftKey: true }), false, 'shell'), undefined);
  }
  assert.equal(shortcut(key('KeyD'), false, 'shell'), undefined, 'Items bindings stay in Items');
  assert.equal(shortcut(key('KeyI'), 'KeyG', 'topics'), 'jump-item', 'the shared jump leader still works from Topics');
  assert.equal(shortcut(key('Enter'), false, 'thread'), 'thread-toggle');
  assert.equal(shortcut(key('KeyZ'), false, 'thread'), 'thread-leader');
  assert.equal(shortcut(key('KeyA'), 'KeyZ', 'thread'), 'thread-toggle');
  assert.equal(shortcut(key('Enter', { metaKey: true }), false, 'thread'), 'open-other');
  assert.equal(shortcut(key('KeyA'), 'KeyZ', 'topics'), undefined, 'run folding stays in the thread');
});
