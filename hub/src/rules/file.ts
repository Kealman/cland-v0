// One hub-owned write queue also orders refreshes, so an older read cannot replace a new write.
import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import type { Resumed } from '../hub/budget.ts';
import type { LogFn } from '../log.ts';
import { parseRulebook, parseScope, renderRulebook, RULEBOOK_HEADER, RulebookError, type Rule, type Rulebook } from './rulebook.ts';

export type RuleAdd = { text: string; scope: string; reason: string; title?: string; origin: string };
export type RuleEdit = { text?: string; scope?: string; reason?: string; origin?: string };
export class RulebookFile {
  readonly path: string;
  readonly #roles: () => Iterable<string>;
  readonly #log: LogFn;
  readonly #resumed: Resumed;
  readonly #listeners = new Set<(rules: readonly Rule[], previous: readonly Rule[]) => void>();
  #book = parseRulebook(RULEBOOK_HEADER);
  #seen: string | null = null;
  #tail: Promise<unknown> = Promise.resolve();
  #timer: NodeJS.Timeout | null = null;
  #stopped = false;
  constructor(path: string, roles: () => Iterable<string>, log: LogFn = () => {}, resumed: Resumed = work => work()) {
    this.path = path; this.#roles = roles; this.#log = log; this.#resumed = resumed;
  }
  get(): readonly Rule[] { return this.#book.rules; }
  subscribe(listener: (rules: readonly Rule[], previous: readonly Rule[]) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
  async start(): Promise<void> {
    try { await writeFile(this.path, RULEBOOK_HEADER, { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    await this.#refresh();
    this.#timer = setInterval(() => { void this.#refresh(); }, 500);
    this.#timer.unref();
  }
  async stop(): Promise<void> {
    this.#stopped = true;
    if (this.#timer) clearInterval(this.#timer);
    await this.#tail;
  }
  #enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(work);
    this.#tail = next.catch(() => {});
    return next;
  }
  #publish(book: Rulebook): void {
    const previous = this.#book.rules;
    this.#book = book;
    this.#seen = book.source;
    this.#warnCounter(book);
    this.#log({ event: 'rules-loaded', path: this.path, count: book.rules.length });
    for (const listener of this.#listeners) listener(book.rules, previous);
  }
  #warnCounter(book: Rulebook): void {
    const highest = book.rules.at(-1)?.number ?? 0;
    if (book.recordedHighWater !== null && book.recordedHighWater < highest) this.#log({ event: 'rules-counter-behind', path: this.path, recorded: book.recordedHighWater, highest, warning: 'rule high-water mark is below a number present; using the higher value' });
  }
  #refresh(): Promise<void> {
    return this.#enqueue(async () => {
      if (this.#stopped) return;
      try {
        const source = await this.#resumed(() => readFile(this.path, 'utf8'));
        this.#resumed(() => {
          if (this.#stopped || source === this.#seen) return;
          this.#seen = source;
          this.#publish(parseRulebook(source, this.#roles()));
        });
      } catch (error) {
        this.#resumed(() => this.#log({ event: 'rules-unreadable', path: this.path, ...(error instanceof RulebookError ? { line: error.line } : {}), error: error instanceof Error ? error.message : String(error), keeping: 'the last good rulebook' }));
      }
    });
  }
  #write(change: (book: Rulebook) => Rule[], resumed: Resumed, authorize: () => void): Promise<Rule> {
    return this.#enqueue(async () => {
      const source = await resumed(() => { authorize(); return readFile(this.path, 'utf8'); });
      const { text, book, rule } = resumed(() => {
        authorize();
        const original = parseRulebook(source, this.#roles()); // Never overwrite a broken hand edit.
        this.#warnCounter(original);
        const rules = change(original);
        const text = renderRulebook(original, rules);
        const book = parseRulebook(text, this.#roles());
        const changed = rules.find((rule, i) => rule !== original.rules[i])!;
        const rule = book.rules.find(rule => rule.number === changed.number)!;
        return { text, book, rule };
      });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await resumed(() => writeFile(temporary, text, { flag: 'wx' }));
        const current = await resumed(() => readFile(this.path, 'utf8'));
        await resumed(() => {
          authorize();
          if (current !== source) throw new Error('RULES.md changed while writing it; retry');
          return rename(temporary, this.path);
        });
        resumed(() => this.#publish(book));
        return rule;
      } finally {
        await resumed(() => unlink(temporary)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
    });
  }
  add(input: RuleAdd, resumed: Resumed = this.#resumed, authorize = () => {}): Promise<Rule> {
    return this.#write(book => {
      const number = book.highWater + 1;
      const text = nonempty(input.text, 'text');
      const rule: Rule = { number, title: singleLine(input.title ?? text.split('\n')[0]!.slice(0, 80), 'title'), scope: parseScope(input.scope, this.#roles()), date: today(), status: 'active', origin: input.origin, reason: singleLine(input.reason, 'reason'), text };
      return [...book.rules, rule];
    }, resumed, authorize);
  }
  edit(number: number, input: RuleEdit, resumed: Resumed = this.#resumed, authorize = () => {}): Promise<Rule> {
    return this.#write(book => {
      if (input.text === undefined && input.scope === undefined && input.reason === undefined) throw new Error('rule edit needs --text, --scope or --reason');
      return replace(book, number, rule => ({ ...rule, date: today(), ...(input.text !== undefined ? { text: nonempty(input.text, 'text') } : {}), ...(input.scope !== undefined ? { scope: parseScope(input.scope, this.#roles()) } : {}), ...(input.reason !== undefined ? { reason: singleLine(input.reason, 'reason') } : {}), ...(input.origin !== undefined ? { origin: input.origin } : {}) }));
    }, resumed, authorize);
  }
  retire(number: number, reason: string, resumed: Resumed = this.#resumed, authorize = () => {}, origin?: string): Promise<Rule> {
    return this.#write(book => replace(book, number, rule => {
      if (rule.status === 'retired') throw new Error(`rule ${number} is already retired`);
      return { ...rule, date: today(), status: 'retired', retired: today(), reason: `${rule.reason}; ${singleLine(reason, 'reason')}`, ...(origin !== undefined ? { origin } : {}) };
    }), resumed, authorize);
  }
}
function replace(book: Rulebook, number: number, update: (rule: Rule) => Rule): Rule[] {
  if (!book.rules.some(rule => rule.number === number)) throw new Error(`no rule ${number}`);
  return book.rules.map(rule => rule.number === number ? update(rule) : rule);
}
const today = () => new Date().toISOString().slice(0, 10);
function nonempty(text: string, name: string): string {
  if (name === 'text' && /^## /m.test(text)) throw new Error('rule text cannot contain a rule heading (##)');
  if (!text.trim()) throw new Error(`rule ${name} must not be empty`);
  return text.trim();
}
function singleLine(text: string, name: string): string {
  if (/[\r\n]/.test(text)) throw new Error(`rule ${name} must be one line`);
  return nonempty(text, name);
}
