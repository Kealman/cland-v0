// T1: the public transport parser accepts only the shipped host carrier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTransportKind, type TransportKind } from '../src/host/transport-kind.ts';

test('transport parser accepts ssh and reserves outbound for 0.4.x', () => {
  const kind: TransportKind = parseTransportKind('ssh');
  assert.equal(kind, 'ssh');
  assert.throws(() => parseTransportKind('outbound'), /outbound.*0\.4\.x/);
  for (const value of ['tcp', '', 'SSH', 1, false, null, undefined, [], {}]) {
    assert.throws(() => parseTransportKind(value), /ssh.*only.*0\.4\.0/);
  }
});
