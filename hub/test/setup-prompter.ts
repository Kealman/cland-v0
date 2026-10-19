import assert from 'node:assert/strict';
import type { Prompter } from '../src/setup/prompter.ts';

type ExpectedQuestion = { question: string | RegExp };
export type PromptStep = ExpectedQuestion & (
  | { kind: 'confirm'; answer: boolean }
  | { kind: 'choose'; answer: string }
  | { kind: 'pause' }
);

/** A strict, ordered script for setup's T1 flow tests. An empty script forbids questions. */
export function scriptedPrompter(script: readonly PromptStep[]): Prompter & { asked: string[]; left(): PromptStep[] } {
  const remaining = [...script];
  const asked: string[] = [];
  const next = (question: string): PromptStep => {
    asked.push(question);
    const step = remaining.shift();
    assert.ok(step, `unexpected question: ${question}`);
    if (typeof step.question === 'string') assert.equal(question, step.question, `unexpected question: ${question}`);
    else assert.match(question, step.question, `unexpected question: ${question}`);
    return step;
  };
  return {
    asked,
    left: () => [...remaining],
    async confirm(question) {
      const step = next(question);
      assert.ok(step.kind === 'confirm', `unexpected confirm question: ${question}`);
      return step.answer;
    },
    async choose(question, choices) {
      const step = next(question);
      assert.ok(step.kind === 'choose', `unexpected choose question: ${question}`);
      const choice = choices.find((choice) => choice.value === step.answer);
      assert.ok(choice, `invalid scripted answer ${step.answer} for question: ${question}`);
      return choice.value;
    },
    async pause(message) {
      const step = next(message);
      assert.ok(step.kind === 'pause', `unexpected pause question: ${message}`);
    },
  };
}
