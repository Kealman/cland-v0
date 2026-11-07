import test from 'node:test';
import assert from 'node:assert/strict';
import { listenerFailure } from './tcp-listener-census.ts';

test('listener attribution retains metadata only across a stable native birth', async () => {
  const message = await listenerFailure(42, ['worker', 'control-socket holder'], {
    identity: async () => 'linux:boot:123', listeners: async () => 'TCP 127.0.0.1:4567 (LISTEN)',
    description: async () => ({ parent: 7, command: 'node fake-master' }),
  });
  assert.match(message!, /pid=42 source=worker, control-socket holder nativeStart=linux:boot:123 parent=7 command=node fake-master/);
  assert.match(message!, /127.0.0.1:4567/);
});

for (const boundary of ['listeners', 'description'] as const) {
  test(`listener attribution suppresses replacement metadata when birth changes during ${boundary}`, async () => {
    let birth = 'linux:boot:123';
    const message = await listenerFailure(42, ['control-socket holder'], {
      identity: async () => birth,
      listeners: async () => { if (boundary === 'listeners') birth = 'linux:boot:999'; return 'old listener 127.0.0.1:4567'; },
      description: async () => { birth = 'linux:boot:999'; return { parent: 88, command: 'replacement-command' }; },
    });
    assert.match(message!, /pid=42 source=control-socket holder/);
    assert.match(message!, /nativeStart=unavailable \(changed or unreadable native birth\)/);
    assert.match(message!, /parent=unavailable command=unavailable/);
    assert.doesNotMatch(message!, /replacement-command|parent=88/);
    assert.match(message!, /old listener 127.0.0.1:4567/);
  });
}

for (const missingAt of [0, 1, 2]) {
  test(`listener attribution stays unavailable when native birth observation ${missingAt} is missing`, async () => {
    let observation = 0;
    const message = await listenerFailure(42, ['worker'], {
      identity: async () => observation++ === missingAt ? null : 'darwin:123:456',
      listeners: async () => 'TCP listener', description: async () => ({ parent: 7, command: 'unproven-command' }),
    });
    assert.match(message!, /nativeStart=unavailable/);
    assert.doesNotMatch(message!, /unproven-command|parent=7/);
    assert.match(message!, /TCP listener/);
  });
}

test('empty listener census returns no failure', async () => {
  assert.equal(await listenerFailure(42, ['worker'], {
    identity: async () => 'linux:boot:123', listeners: async () => '',
    description: async () => { throw new Error('no diagnostic metadata needed'); },
  }), null);
});
