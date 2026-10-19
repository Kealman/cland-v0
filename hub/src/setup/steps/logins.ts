import { HARNESS_ORDER } from './harnesses.ts';
import type { SetupStep } from '../types.ts';

export const logins: SetupStep = async ({ machine }) => {
  const required = await machine.requiredHarnesses();
  const found = await Promise.all(HARNESS_ORDER.map(id => machine.harness(id)));
  return found.filter(h => h.bin !== null).map(h => {
    const check = h.checks[1]!;
    if (check.verdict === 'ok') return { ...check, verdict: 'ok' };
    const unused = !required.includes(h.id);
    return { ...check, verdict: unused || h.id === 'opencode' ? 'skip' : 'open',
      detail: `${check.detail}${unused ? '; no role uses it' : h.id === 'opencode' ? '; optional: the free model needs none' : ''}`,
      ...(check.fix ? { fix: check.fix.startsWith('run ') ? check.fix : `run: ${check.fix}` } : {}),
    };
  });
};
