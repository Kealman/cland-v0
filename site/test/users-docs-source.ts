import { commands, source } from './remote-docs-source.ts';
export { commands, source };
export const usersPath = 'site/src/content/docs/docs/users.md';
export function usersSection(text: string): string {
  return /^## Multi-user sign-in\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(text)?.[1] ?? '';
}
export function inviteSteps(text: string): string[] {
  return [...text.matchAll(/```sh users-invite\n([\s\S]*?)\n```/g)]
    .flatMap(match => match[1]!.split('\n').filter(line => line.trim() && !line.startsWith('#')));
}
