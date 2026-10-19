import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

export class Cancelled extends Error {
  override name = 'Cancelled';
}

export type Choice<T extends string> = { value: T; label: string };

/** The only three questions setup asks, also implemented by the scripted test prompter. */
export type Prompter = {
  confirm(question: string, def: boolean): Promise<boolean>;
  choose<T extends string>(question: string, choices: readonly Choice<T>[], def: T): Promise<T>;
  pause(message: string): Promise<void>;
};

/** Typed-ahead input in the answer's chunk is consumed; type a child's input after its prompt appears. */
export function readlinePrompter(io: { input: Readable; output: Writable }): Prompter {
  const checkInput = () => {
    if (io.input.readableEnded || io.input.destroyed) throw new Cancelled('input ended');
  };
  const ask = async (question: string): Promise<string> => {
    checkInput();
    const rl = createInterface({ input: io.input, terminal: false });
    // Register before writing: an answer can arrive before we start awaiting it.
    const lines = rl[Symbol.asyncIterator]();
    try {
      io.output.write(question);
      const line = await lines.next();
      if (line.done) throw new Cancelled('input ended');
      return String(line.value).trim();
    } finally {
      // Pause input before a terminal child takes over the stream.
      rl.close();
    }
  };
  return {
    async confirm(question: string, def: boolean): Promise<boolean> {
      for (;;) {
        const answer = (await ask(`${question} [${def ? 'Y/n' : 'y/N'}] `)).toLowerCase();
        if (answer === '') return def;
        if (answer === 'y' || answer === 'yes') return true;
        if (answer === 'n' || answer === 'no') return false;
      }
    },
    async choose<T extends string>(question: string, choices: readonly Choice<T>[], def: T): Promise<T> {
      checkInput();
      choices.forEach((choice, i) => io.output.write(`  ${i + 1}) ${choice.label}\n`));
      const index = choices.findIndex((choice) => choice.value === def) + 1;
      for (;;) {
        const answer = await ask(`${question} [${index}] `);
        if (answer === '') return def;
        const hit = choices[Number(answer) - 1] ?? choices.find((choice) => choice.value === answer);
        if (hit) return hit.value;
      }
    },
    async pause(message) {
      await ask(`${message} `);
    },
  };
}
