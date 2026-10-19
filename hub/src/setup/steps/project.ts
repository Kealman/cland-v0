import type { SetupStep } from '../types.ts';

export const project: SetupStep = async ({ machine, root }) => [await machine.projectExists()
  ? { name: 'project', verdict: 'ok', detail: root }
  : { name: 'project', verdict: 'fail', detail: 'no .cland/ directory', fix: 'run cland init first' }];
