import { assertTestAdmission } from '../src/test-admission.ts';
import { before } from 'node:test';

// Register tests before waiting on the project hub. A failed admission prevents
// every test body and subsequent fixture hook, without failing module loading.
before(() => assertTestAdmission());
