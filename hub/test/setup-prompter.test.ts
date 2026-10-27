// T1: readline prompts over in-memory streams; no processes, sockets or real-time waits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { Cancelled, readlinePrompter } from '../src/setup/prompter.ts';
import { scriptedPrompter } from './setup-prompter.ts';

/** Reply as the question is printed, including before the caller starts waiting for its answer. */
function rig(answers: string[]) {
  const input = new PassThrough();
  const output = new PassThrough();
  let said = '';
  output.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    said += text;
    if (text.endsWith(' ') && answers.length) input.write(`${answers.shift()}\n`);
  });
  return { input, output, said: () => said, prompter: readlinePrompter({ input, output }) };
}

test('confirm accepts yes or no, defaults on Enter and repeats invalid answers', async () => {
  for (const [answer, expected] of [['y', true], [' YES ', true], ['n', false], ['No', false]] as const) {
    const r = rig([answer]);
    assert.equal(await r.prompter.confirm('Install Codex now?', false), expected);
    assert.equal(r.said(), 'Install Codex now? [y/N] ');
  }
  for (const def of [false, true]) {
    const r = rig(['maybe', '']);
    assert.equal(await r.prompter.confirm('Proceed?', def), def);
    const prompt = def ? 'Proceed? [Y/n] ' : 'Proceed? [y/N] ';
    assert.equal(r.said(), prompt + prompt);
  }
});

const choices = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'codex', label: 'Codex' },
] as const;

test('choose accepts a number or value, defaults on Enter and repeats invalid answers', async () => {
  for (const [answers, expected] of [
    [['2'], 'codex'],
    [['claude-code'], 'claude-code'],
    [[''], 'codex'],
    [['7', 'unknown', '1'], 'claude-code'],
  ] as const) {
    const r = rig([...answers]);
    assert.equal(await r.prompter.choose('Favourite harness?', choices, 'codex'), expected);
    assert.equal(r.said(), '  1) Claude Code\n  2) Codex\n' + 'Favourite harness? [2] '.repeat(answers.length));
  }
});

test('pause waits for Enter without consuming the next reader\'s input', async () => {
  const r = rig([]);
  let finished = false;
  const paused = r.prompter.pause('Press Enter to attach').then(() => { finished = true; });
  assert.equal(r.said(), 'Press Enter to attach ');
  assert.equal(finished, false);
  r.input.write('\n');
  await paused;
  assert.equal(r.input.isPaused(), true, 'the prompter releases the input between questions');
  // These bytes arrive while the input is paused, before the terminal child attaches.
  r.input.write('keys for the child\n');
  r.input.write('including a second line\n');
  const received: Buffer[] = [];
  r.input.on('data', (chunk: Buffer) => received.push(chunk));
  const ended = new Promise<void>((resolve) => r.input.once('end', resolve));
  r.input.resume();
  r.input.end();
  await ended;
  assert.equal(Buffer.concat(received).toString(), 'keys for the child\nincluding a second line\n');
});

test('end of input cancels the active question and every later question', async () => {
  for (const question of ['confirm', 'choose', 'pause'] as const) {
    const r = rig([]);
    const pending = question === 'confirm' ? r.prompter.confirm('Proceed?', true)
      : question === 'choose' ? r.prompter.choose('Favourite?', choices, 'codex')
      : r.prompter.pause('Press Enter');
    r.input.end();
    await assert.rejects(pending, { name: 'Cancelled', message: 'input ended' });
    const said = r.said();
    await assert.rejects(r.prompter.confirm('Later confirm?', false), Cancelled);
    await assert.rejects(r.prompter.choose('Later choose?', choices, 'codex'), Cancelled);
    await assert.rejects(r.prompter.pause('Later pause'), Cancelled);
    assert.equal(r.said(), said, 'no questions are printed after input ends');
  }
});

test('the fake prompter follows a question script through the common interface', async () => {
  const p = scriptedPrompter([
    { kind: 'confirm', question: 'Install Codex?', answer: true },
    { kind: 'choose', question: /^Favourite/, answer: 'codex' },
    { kind: 'pause', question: 'Press Enter' },
  ]);
  assert.equal(await p.confirm('Install Codex?', false), true);
  assert.equal(await p.choose('Favourite harness?', choices, 'claude-code'), 'codex');
  await p.pause('Press Enter');
  assert.deepEqual(p.asked, ['Install Codex?', 'Favourite harness?', 'Press Enter']);
  assert.deepEqual(p.left(), []);
});

test('the fake prompter reports the text of an unexpected question', async () => {
  await assert.rejects(scriptedPrompter([]).confirm('Unexpected install?', false), /Unexpected install\?/);
  await assert.rejects(scriptedPrompter([
    { kind: 'confirm', question: 'Expected install?', answer: false },
  ]).confirm('Unexpected install?', false), /Unexpected install\?/);
  await assert.rejects(scriptedPrompter([
    { kind: 'confirm', question: /Expected install/, answer: false },
  ]).pause('Unexpected pause'), /Unexpected pause/);
  await assert.rejects(scriptedPrompter([
    { kind: 'confirm', question: 'Wrong kind', answer: true },
  ]).pause('Wrong kind'), /unexpected pause question: Wrong kind/);
  await assert.rejects(scriptedPrompter([
    { kind: 'choose', question: 'Favourite?', answer: 'missing' },
  ]).choose('Favourite?', choices, 'codex'), /invalid scripted answer missing.*Favourite\?/);
});

test('secret questions hide input and release raw mode before the next question', { timeout: 500 }, async () => {
  const input = Object.assign(new PassThrough(), {
    isTTY: true, isRaw: false,
    setRawMode(value: boolean) { this.isRaw = value; return this; },
  });
  const output = new PassThrough();
  let said = '';
  output.on('data', (chunk: Buffer) => { said += String(chunk); });
  const prompter = readlinePrompter({ input, output });
  const hidden = prompter.secret('Telegram token:');
  assert.equal(input.isRaw, true);
  input.write('made-up-x\x7ftoken\r');
  assert.ok(await hidden === 'made-up-token', 'the hidden question returns edited input');
  assert.ok(String(said) === 'Telegram token: \n', 'the hidden question prints only its prompt and newline');
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('keypress'), 0);
  assert.equal(input.isPaused(), true);
  const next = prompter.confirm('Continue?', false);
  input.write('yes\n');
  assert.equal(await next, true);
  assert.ok(String(said) === 'Telegram token: \nContinue? [y/N] ', 'only the prompts are printed');
  input.destroy();
  output.destroy();
});

for (const ending of ['cancel', 'eof'] as const) test(`a hidden question releases the terminal after ${ending}`, { timeout: 500 }, async () => {
  const input = Object.assign(new PassThrough(), {
    isTTY: true, isRaw: false,
    setRawMode(value: boolean) { this.isRaw = value; return this; },
  });
  const output = new PassThrough();
  let said = '';
  output.on('data', (chunk: Buffer) => { said += String(chunk); });
  const pending = readlinePrompter({ input, output }).secret('Telegram token:');
  input.write('partial-input');
  if (ending === 'cancel') input.write('\x03');
  else input.end();
  await assert.rejects(pending, Cancelled);
  assert.ok(String(said) === 'Telegram token: \n', 'the hidden question prints only its prompt and newline');
  assert.equal(input.isRaw, false);
  assert.equal(input.listenerCount('keypress'), 0);
  input.destroy();
  output.destroy();
});
