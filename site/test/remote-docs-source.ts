import { readFileSync } from 'node:fs';

export const guidePath = 'site/src/content/docs/docs/remote-control.md';
export const phonePath = 'site/src/content/docs/docs/web-and-phone.mdx';
export function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

export function remoteSection(text: string): string {
  return /^## Remotes\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(text)?.[1] ?? '';
}

/** The same visible shell lines are validated statically and executed by the hub test. */
export function commands(text: string): string[] {
  const inline = [...text.matchAll(/`(cland [^`\n]+)`/g)].map(match => match[1]!);
  const shell = [...text.matchAll(/^cland [^\n]+/gm)].map(match => match[0]);
  return [...inline, ...shell];
}

export function telegramSteps(text: string): string[] {
  return [...text.matchAll(/```sh telegram-pairing\n([\s\S]*?)\n```/g)]
    .flatMap(match => match[1]!.split('\n').filter(line => line.trim() && !line.startsWith('#')));
}
