import { commands, source } from './remote-docs-source.ts';
export { commands, source };
export const hostsPath = 'site/src/content/docs/docs/hosts.md';
export function poolSteps(text: string): string[] {
  return [...text.matchAll(/```sh host-pool\n([\s\S]*?)\n```/g)]
    .flatMap(match => match[1]!.split('\n').filter(line => line.trim() && !line.startsWith('#')));
}
