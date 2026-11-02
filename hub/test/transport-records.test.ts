// T2: persisted host rows validate kinds through the public records boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { HostRecords } from '../src/host/records.ts';

test('host get and list reject invalid persisted transport kinds without changing ssh rows', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const hosts = new HostRecords(db);
    const oldShape = { id: 'f1', transport: 'ssh', address: 'fixture', user: 'agent', state: 'registered' };
    hosts.insert({ id: 'f1', address: 'fixture', user: 'agent', clientKeyPath: '', knownHosts: '' }, 'synthetic');
    assert.deepEqual(hosts.get('f1'), oldShape);
    assert.deepEqual(hosts.list(), [oldShape]);
    for (const [kind, message] of [['outbound', /0\.4\.x/], ['tcp', /ssh.*only.*0\.4\.0/]] as const) {
      db.prepare('update hosts set transport=?').run(kind);
      assert.throws(() => hosts.get('f1'), message);
      assert.throws(() => hosts.list(), message);
    }
  } finally { db.close(); }
});
