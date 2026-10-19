// T1: injected child receipts and signal emitter; never starts a process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { terminalCommand, type TerminalSpawner } from '../src/setup/terminal.ts';

test('terminal child inherits stdio, returns exit or signal code and restores signal handlers', async () => {
  for (const [code, signal, expected] of [[7, null, 7], [null, 'SIGINT', 130], [null, 'SIGQUIT', 131], [null, 'SIGTERM', 143]] as const) {
    const signals = new EventEmitter();
    const existing = () => {};
    signals.on('SIGINT', existing);
    const spawn: TerminalSpawner = (bin, args, options) => {
      assert.equal(bin, 'login');
      assert.deepEqual(args, ['start']);
      assert.deepEqual(options, { env: { HOME: '/scratch' }, cwd: '/project', stdio: 'inherit' });
      assert.equal(signals.listenerCount('SIGINT'), 2);
      assert.equal(signals.listenerCount('SIGQUIT'), 1);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('close', code, signal));
      return child;
    };
    assert.equal(await terminalCommand('login', ['start'], { env: { HOME: '/scratch' }, cwd: '/project' }, { spawn, signals }), expected);
    assert.deepEqual(signals.listeners('SIGINT'), [existing]);
    assert.deepEqual(signals.listeners('SIGQUIT'), []);
  }
});

test('terminal child spawn errors still restore parent signal handlers', async () => {
  for (const sync of [false, true]) {
    const signals = new EventEmitter();
    const spawn: TerminalSpawner = () => {
      if (sync) throw new Error('spawn failed');
      const child = new EventEmitter();
      queueMicrotask(() => child.emit('error', new Error('spawn failed')));
      return child;
    };
    await assert.rejects(terminalCommand('missing', [], { env: {}, cwd: '/project' }, { spawn, signals }), /spawn failed/);
    assert.equal(signals.listenerCount('SIGINT'), 0);
    assert.equal(signals.listenerCount('SIGQUIT'), 0);
  }
});

test('JSON terminal child sends stdout to stderr while inheriting stdin and stderr', async () => {
  const spawn: TerminalSpawner = (_bin, _args, options) => {
    assert.deepEqual(options.stdio, [0, 2, 2]);
    const child = new EventEmitter();
    queueMicrotask(() => child.emit('close', 0, null));
    return child;
  };
  assert.equal(await terminalCommand('installer', [], { env: {}, cwd: '/project', stdout: 'stderr' }, { spawn, signals: new EventEmitter() }), 0);
});
