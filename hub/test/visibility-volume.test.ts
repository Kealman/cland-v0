// T4: retain hundreds of verdict events plus idle/death volume through the same assertions as the representative T2 case.
import { test } from 'node:test';
import { assertDefaultEventVisibility } from './visibility-events.ts';

test('hundreds of default verdict, death and idle events leave needsYou zero', async t => {
  await assertDefaultEventVisibility(t, 200);
});
