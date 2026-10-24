// This entry executes only in the opaque-origin capability iframe.
import mermaid from 'mermaid';
import { listenForShortcuts } from '../keyboard.ts';
import '../tokens.css';
import s from './MermaidViewer.module.css';

const source = document.querySelector<HTMLPreElement>('[data-source]')!;
const diagram = document.createElement('main');
diagram.setAttribute('aria-label', 'Rendered Mermaid');
diagram.className = s.diagram!;
source.className = s.source!;
const toggle = document.createElement('button');
toggle.className = s.toggle!;
toggle.type = 'button';
toggle.title = 'Toggle source (s)';
document.body.className = s.viewer!;
document.body.prepend(toggle, diagram);
const showSource = (show: boolean) => {
  source.hidden = !show;
  diagram.hidden = show;
  toggle.textContent = show ? 'Show rendered' : 'Show source';
  toggle.setAttribute('aria-pressed', String(show));
};
showSource(false);
toggle.onclick = () => showSource(source.hidden === true);
listenForShortcuts(action => { if (action === 'artifact-source') showSource(source.hidden === true); }, () => 'artifact-viewer', action => action === 'artifact-source');
const tokens = getComputedStyle(document.documentElement);
const token = (name: string) => tokens.getPropertyValue(`--${name}`).trim();
mermaid.initialize({
  startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
  fontFamily: token('prose'),
  theme: 'base', themeVariables: {
    darkMode: true, background: token('ground'), primaryColor: token('selection'),
    primaryTextColor: token('text'), primaryBorderColor: token('muted'),
    secondaryColor: token('panel'), secondaryTextColor: token('text'),
    tertiaryColor: token('control'), tertiaryTextColor: token('text'),
    lineColor: token('muted'), textColor: token('text'),
    mainBkg: token('selection'), nodeBorder: token('muted'),
    clusterBkg: token('panel'), clusterBorder: token('muted'),
    titleColor: token('text'), edgeLabelBackground: token('ground'),
    fontFamily: token('prose'),
  },
});
void mermaid.render('diagram', source.textContent ?? '').then(({ svg }) => {
  // Strict Mermaid SVG stays inside this sandbox; never insert it in the shell.
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  diagram.replaceChildren(document.importNode(parsed.documentElement, true));
  toggle.focus();
}).catch((error: unknown) => {
  const message = document.createElement('pre');
  message.className = s.error!;
  message.setAttribute('role', 'alert');
  message.textContent = error instanceof Error ? error.message : String(error);
  diagram.before(message);
  showSource(true);
  toggle.focus();
});
