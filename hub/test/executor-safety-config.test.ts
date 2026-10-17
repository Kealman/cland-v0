// T1: verification timeout and spend configuration is pure parsing/rendering.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConfig, renderConfig } from '../src/init/config.ts';

test('timeout and spend config validate and survive rendering', () => {
  assert.throws(() => parseConfig('[verification]\nlifetime="15m"\nrun_timeout="6m"', 'test'), /lifetime 15m.*run_timeout 6m/);
  for (const value of ['-1', '"5"', 'nan']) assert.throws(() => parseConfig(`[verification]\ndaily_spend_usd=${value}`, 'test'), /daily_spend_usd/);
  assert.throws(() => parseConfig('[verification]\nrun_timeout="oops"', 'test'), /run_timeout/);
  const config = parseConfig('[verification]\nlifetime="60m"\nrun_timeout="50m"\ndaily_spend_usd=3', 'test');
  assert.deepEqual(parseConfig(renderConfig(config), 'test'), config);
});

