// T1: run the site's public-documentation contract in the repository suite.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configKeys } from '../src/init/config-set.ts';
import { SECRET_NAMES } from '../src/remote/secrets.ts';
import { configNames, secretNames } from '../../site/test/remote-docs.test.ts';

test('site vocabulary extraction matches the runtime config and secret names', () => {
  assert.deepEqual(configNames, configKeys().filter(key => key.startsWith('remote.')));
  assert.deepEqual(secretNames, SECRET_NAMES);
});
